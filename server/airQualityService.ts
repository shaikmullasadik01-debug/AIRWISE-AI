import {
  buildHealthPrecautions,
  calculateUsAqiFromPm25,
  classifyUsAqi,
  computeInversionRisk,
  findBestOutdoorWindow,
} from './aqi.ts';
import type {
  AirQualityPayload,
  CityLocation,
  DailySummaryPoint,
  HourlyAirQualityPoint,
  PollutantReading,
} from './types.ts';

export const PRESET_CITIES: CityLocation[] = [
  {
    id: 'san-francisco',
    name: 'San Francisco',
    region: 'California',
    country: 'United States',
    latitude: 37.77,
    longitude: -122.42,
    timezone: 'America/Los_Angeles',
    recommendedStandard: 'us-epa',
  },
  {
    id: 'london',
    name: 'London',
    region: 'Greater London',
    country: 'United Kingdom',
    latitude: 51.51,
    longitude: -0.13,
    timezone: 'Europe/London',
    recommendedStandard: 'eu-eaqi',
  },
  {
    id: 'new-delhi',
    name: 'New Delhi',
    region: 'Delhi NCR',
    country: 'India',
    latitude: 28.61,
    longitude: 77.21,
    timezone: 'Asia/Kolkata',
    recommendedStandard: 'us-epa',
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    region: 'Kanto',
    country: 'Japan',
    latitude: 35.68,
    longitude: 139.77,
    timezone: 'Asia/Tokyo',
    recommendedStandard: 'us-epa',
  },
  {
    id: 'paris',
    name: 'Paris',
    region: 'Île-de-France',
    country: 'France',
    latitude: 48.86,
    longitude: 2.35,
    timezone: 'Europe/Paris',
    recommendedStandard: 'eu-eaqi',
  },
  {
    id: 'beijing',
    name: 'Beijing',
    region: 'Beijing',
    country: 'China',
    latitude: 39.9,
    longitude: 116.41,
    timezone: 'Asia/Shanghai',
    recommendedStandard: 'us-epa',
  },
  {
    id: 'cairo',
    name: 'Cairo',
    region: 'Cairo',
    country: 'Egypt',
    latitude: 30.04,
    longitude: 31.24,
    timezone: 'Africa/Cairo',
    recommendedStandard: 'who-2021',
  },
  {
    id: 'sao-paulo',
    name: 'São Paulo',
    region: 'São Paulo',
    country: 'Brazil',
    latitude: -23.55,
    longitude: -46.63,
    timezone: 'America/Sao_Paulo',
    recommendedStandard: 'who-2021',
  },
];

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const telemetryCache = new Map<string, CacheEntry<AirQualityPayload>>();
const inFlightTelemetry = new Map<string, Promise<AirQualityPayload>>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;

function writeTelemetryCache(key: string, value: AirQualityPayload): void {
  if (telemetryCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = telemetryCache.keys().next().value;
    if (oldest !== undefined) telemetryCache.delete(oldest);
  }
  telemetryCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 6000, retries = 1): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AIRWISE-AI/1.0',
        },
      });
      if (!response.ok) {
        throw new Error(`Upstream HTTP ${response.status}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Upstream fetch failed');
}

function inferRecommendedStandard(country: string): 'us-epa' | 'eu-eaqi' | 'who-2021' {
  const euCountries = new Set([
    'United Kingdom',
    'France',
    'Germany',
    'Italy',
    'Spain',
    'Netherlands',
    'Belgium',
    'Poland',
    'Sweden',
    'Austria',
    'Switzerland',
    'Norway',
    'Denmark',
    'Finland',
    'Ireland',
    'Portugal',
    'Greece',
  ]);
  if (euCountries.has(country)) return 'eu-eaqi';
  if (country === 'United States' || country === 'Canada') return 'us-epa';
  return 'who-2021';
}

interface OpenMeteoGeoResult {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export async function searchCities(query: string): Promise<{
  results: CityLocation[];
  source: 'open-meteo-geocoding' | 'local-presets-fallback';
}> {
  const q = query.trim();
  if (q.length < 2) {
    return { results: PRESET_CITIES, source: 'local-presets-fallback' };
  }

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;
    const data = await fetchJsonWithTimeout<{ results?: OpenMeteoGeoResult[] }>(url, 5000, 1);
    const list = (data.results ?? []).map((item): CityLocation => {
      const country = item.country ?? 'Unknown';
      return {
        id: `geo-${item.id}`,
        name: item.name,
        region: item.admin1,
        country,
        latitude: Math.round(item.latitude * 100) / 100,
        longitude: Math.round(item.longitude * 100) / 100,
        timezone: item.timezone ?? 'UTC',
        recommendedStandard: inferRecommendedStandard(country),
      };
    });
    return { results: list, source: 'open-meteo-geocoding' };
  } catch {
    const lower = q.toLowerCase();
    const matched = PRESET_CITIES.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.country.toLowerCase().includes(lower) ||
        (c.region ?? '').toLowerCase().includes(lower),
    );
    return { results: matched, source: 'local-presets-fallback' };
  }
}

interface OpenMeteoAirResponse {
  utc_offset_seconds?: number;
  timezone?: string;
  current?: {
    time?: string;
    pm10?: number | null;
    pm2_5?: number | null;
    carbon_monoxide?: number | null;
    nitrogen_dioxide?: number | null;
    sulphur_dioxide?: number | null;
    ozone?: number | null;
    us_aqi?: number | null;
    european_aqi?: number | null;
  };
  hourly?: {
    time?: string[];
    pm10?: Array<number | null>;
    pm2_5?: Array<number | null>;
    nitrogen_dioxide?: Array<number | null>;
    ozone?: Array<number | null>;
    us_aqi?: Array<number | null>;
    european_aqi?: Array<number | null>;
  };
}

interface OpenMeteoWeatherResponse {
  current?: {
    time?: string;
    temperature_2m?: number | null;
    relative_humidity_2m?: number | null;
    wind_speed_10m?: number | null;
    surface_pressure?: number | null;
  };
}

function roundOrNull(val: number | null | undefined, decimals = 1): number | null {
  if (val === null || val === undefined || !Number.isFinite(val)) return null;
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

function determineDominantPollutant(pollutants: PollutantReading[]): string {
  const ranked = pollutants
    .filter((p) => p.whoExceedanceRatio !== null)
    .sort((a, b) => (b.whoExceedanceRatio ?? 0) - (a.whoExceedanceRatio ?? 0));
  if (ranked.length === 0) return 'PM2.5';
  return ranked[0].formula;
}

function buildPollutants(raw: {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  coUgM3: number | null;
  o3: number | null;
}): PollutantReading[] {
  // Open-Meteo CO is returned in ug/m3; convert to mg/m3 for standard readability (WHO 24h = 4 mg/m3)
  const coMgM3 = raw.coUgM3 !== null && Number.isFinite(raw.coUgM3) ? roundOrNull(raw.coUgM3 / 1000, 2) : null;

  return [
    {
      key: 'pm25',
      label: 'Fine Particulate Matter',
      formula: 'PM2.5',
      value: roundOrNull(raw.pm25, 1),
      unit: 'µg/m³',
      whoGuideline24h: 15,
      whoExceedanceRatio: raw.pm25 !== null ? roundOrNull(raw.pm25 / 15, 2) : null,
    },
    {
      key: 'pm10',
      label: 'Coarse Particulate Matter',
      formula: 'PM10',
      value: roundOrNull(raw.pm10, 1),
      unit: 'µg/m³',
      whoGuideline24h: 45,
      whoExceedanceRatio: raw.pm10 !== null ? roundOrNull(raw.pm10 / 45, 2) : null,
    },
    {
      key: 'no2',
      label: 'Nitrogen Dioxide',
      formula: 'NO2',
      value: roundOrNull(raw.no2, 1),
      unit: 'µg/m³',
      whoGuideline24h: 25,
      whoExceedanceRatio: raw.no2 !== null ? roundOrNull(raw.no2 / 25, 2) : null,
    },
    {
      key: 'o3',
      label: 'Ground-Level Ozone',
      formula: 'O3',
      value: roundOrNull(raw.o3, 1),
      unit: 'µg/m³',
      whoGuideline8h: 100,
      whoExceedanceRatio: raw.o3 !== null ? roundOrNull(raw.o3 / 100, 2) : null,
    },
    {
      key: 'so2',
      label: 'Sulfur Dioxide',
      formula: 'SO2',
      value: roundOrNull(raw.so2, 1),
      unit: 'µg/m³',
      whoGuideline24h: 40,
      whoExceedanceRatio: raw.so2 !== null ? roundOrNull(raw.so2 / 40, 2) : null,
    },
    {
      key: 'co',
      label: 'Carbon Monoxide',
      formula: 'CO',
      value: coMgM3,
      unit: 'mg/m³',
      whoGuideline24h: 4,
      whoExceedanceRatio: coMgM3 !== null ? roundOrNull(coMgM3 / 4, 2) : null,
    },
  ];
}

function buildDailyComparison(hourly: HourlyAirQualityPoint[]): DailySummaryPoint[] {
  const grouped = new Map<string, HourlyAirQualityPoint[]>();
  for (const pt of hourly) {
    const dateKey = pt.timestamp.slice(0, 10);
    const arr = grouped.get(dateKey) ?? [];
    arr.push(pt);
    grouped.set(dateKey, arr);
  }

  return Array.from(grouped.entries()).map(([date, points]) => {
    const aqis = points.map((p) => p.usAqi).filter((v): v is number => v !== null);
    const pm25s = points.map((p) => p.pm25).filter((v): v is number => v !== null);
    const avgUsAqi = aqis.length > 0 ? Math.round(aqis.reduce((s, x) => s + x, 0) / aqis.length) : null;
    const maxUsAqi = aqis.length > 0 ? Math.max(...aqis) : null;
    const avgPm25 = pm25s.length > 0 ? roundOrNull(pm25s.reduce((s, x) => s + x, 0) / pm25s.length, 1) : null;
    const maxPm25 = pm25s.length > 0 ? roundOrNull(Math.max(...pm25s), 1) : null;
    return {
      date,
      avgUsAqi,
      maxUsAqi,
      avgPm25,
      maxPm25,
      dominantCategory: classifyUsAqi(maxUsAqi ?? avgUsAqi).label,
    };
  });
}

export function buildUnavailableFallbackPayload(location: CityLocation, reason: string): AirQualityPayload {
  const now = new Date();
  const baseHour = new Date(now);
  baseHour.setMinutes(0, 0, 0);

  const sampleHourly: HourlyAirQualityPoint[] = [];
  for (let offset = -24; offset <= 12; offset += 1) {
    const t = new Date(baseHour.getTime() + offset * 3600_000);
    const diurnal = Math.sin(((t.getHours() - 4) / 24) * Math.PI * 2);
    const pm25 = roundOrNull(22 + diurnal * 6, 1);
    const pm10 = roundOrNull(40 + diurnal * 10, 1);
    const usAqi = calculateUsAqiFromPm25(pm25);
    sampleHourly.push({
      timestamp: t.toISOString().slice(0, 16),
      isForecast: offset > 0,
      usAqi,
      euAqi: usAqi !== null ? Math.round(usAqi * 0.55) : null,
      pm25,
      pm10,
      no2: roundOrNull(24 + diurnal * 5, 1),
      o3: roundOrNull(56 - diurnal * 12, 1),
    });
  }

  const pollutants = buildPollutants({
    pm25: 22.4,
    pm10: 41.0,
    no2: 24.5,
    so2: 6.2,
    coUgM3: 480,
    o3: 54.0,
  });

  const usAqi = calculateUsAqiFromPm25(22.4);
  const inversion = computeInversionRisk(9.5, 64, 14.2, 22.4);

  return {
    location,
    dataStatus: 'unavailable-sample',
    dataStatusNotice: `Live air-quality API is temporarily unreachable (${reason}). Displaying clearly marked offline reference sample data — do not treat these values as current outdoor measurements.`,
    sourceAttribution: 'Offline Reference Baseline (Not Live Telemetry)',
    measurementTimestamp: now.toISOString(),
    fetchedAt: now.toISOString(),
    usAqi,
    euAqi: 36,
    dominantPollutant: 'PM2.5',
    category: classifyUsAqi(usAqi),
    pollutants,
    weather: {
      temperatureC: 14.2,
      relativeHumidityPct: 64,
      windSpeedKmh: 9.5,
      surfacePressureHpa: 1015.4,
      inversionRisk: inversion.risk,
      inversionExplanation: inversion.explanation,
    },
    hourlySeries: sampleHourly,
    dailyComparison: buildDailyComparison(sampleHourly),
    healthPrecautions: buildHealthPrecautions(usAqi, 22.4),
    bestOutdoorWindow: findBestOutdoorWindow(sampleHourly),
  };
}

export async function getAirQualityForLocation(
  location: CityLocation,
  options?: { bypassCache?: boolean; simulateOutage?: boolean },
): Promise<AirQualityPayload> {
  if (options?.simulateOutage) {
    return buildUnavailableFallbackPayload(location, 'Simulated API outage test');
  }

  const cacheKey = `${location.latitude.toFixed(2)},${location.longitude.toFixed(2)}`;
  if (!options?.bypassCache) {
    const cached = telemetryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    const pending = inFlightTelemetry.get(cacheKey);
    if (pending) {
      return pending;
    }
  }

  const fetchPromise = (async (): Promise<AirQualityPayload> => {

  const airUrl =
    `https://air-quality-api.open-meteo.com/v1/air-quality` +
    `?latitude=${location.latitude}&longitude=${location.longitude}` +
    `&current=pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,us_aqi,european_aqi` +
    `&hourly=pm10,pm2_5,nitrogen_dioxide,ozone,us_aqi,european_aqi` +
    `&past_days=2&forecast_days=2&timezone=auto`;

  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${location.latitude}&longitude=${location.longitude}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,surface_pressure` +
    `&timezone=auto`;

  try {
    const [airData, weatherData] = await Promise.all([
      fetchJsonWithTimeout<OpenMeteoAirResponse>(airUrl, 6000, 1),
      fetchJsonWithTimeout<OpenMeteoWeatherResponse>(weatherUrl, 6000, 1).catch(() => null),
    ]);

    const currentAir = airData.current ?? {};
    const currentWeather = weatherData?.current ?? {};

    const pm25 = currentAir.pm2_5 ?? null;
    const pm10 = currentAir.pm10 ?? null;
    const no2 = currentAir.nitrogen_dioxide ?? null;
    const so2 = currentAir.sulphur_dioxide ?? null;
    const coUgM3 = currentAir.carbon_monoxide ?? null;
    const o3 = currentAir.ozone ?? null;

    const usAqi =
      currentAir.us_aqi !== null && currentAir.us_aqi !== undefined
        ? Math.round(currentAir.us_aqi)
        : calculateUsAqiFromPm25(pm25);
    const euAqi =
      currentAir.european_aqi !== null && currentAir.european_aqi !== undefined
        ? Math.round(currentAir.european_aqi)
        : null;

    const pollutants = buildPollutants({ pm25, pm10, no2, so2, coUgM3, o3 });

    const times = airData.hourly?.time ?? [];
    const currentTimeStr = currentAir.time ?? new Date().toISOString().slice(0, 16);
    const currentMs = Date.parse(currentTimeStr);

    const hourlySeries: HourlyAirQualityPoint[] = times.map((ts, idx) => {
      const tsMs = Date.parse(ts);
      const isForecast = Number.isFinite(currentMs) && Number.isFinite(tsMs) ? tsMs > currentMs : false;
      const hPm25 = roundOrNull(airData.hourly?.pm2_5?.[idx], 1);
      const rawUs = airData.hourly?.us_aqi?.[idx];
      return {
        timestamp: ts,
        isForecast,
        usAqi:
          rawUs !== null && rawUs !== undefined
            ? Math.round(rawUs)
            : calculateUsAqiFromPm25(hPm25),
        euAqi:
          airData.hourly?.european_aqi?.[idx] !== null &&
          airData.hourly?.european_aqi?.[idx] !== undefined
            ? Math.round(airData.hourly.european_aqi[idx]!)
            : null,
        pm25: hPm25,
        pm10: roundOrNull(airData.hourly?.pm10?.[idx], 1),
        no2: roundOrNull(airData.hourly?.nitrogen_dioxide?.[idx], 1),
        o3: roundOrNull(airData.hourly?.ozone?.[idx], 1),
      };
    });

    const tempC = roundOrNull(currentWeather.temperature_2m, 1);
    const humidity = roundOrNull(currentWeather.relative_humidity_2m, 0);
    const windKmh = roundOrNull(currentWeather.wind_speed_10m, 1);
    const pressure = roundOrNull(currentWeather.surface_pressure, 1);
    const inversion = computeInversionRisk(windKmh, humidity, tempC, pm25);

    const payload: AirQualityPayload = {
      location: {
        ...location,
        timezone: airData.timezone ?? location.timezone,
      },
      dataStatus: 'live-model',
      dataStatusNotice:
        'Live regional atmospheric model & observation telemetry via Open-Meteo (Copernicus CAMS / NOAA). Past timestamps reflect historical model analysis; future timestamps are forecasts.',
      sourceAttribution: 'Open-Meteo Air Quality (Copernicus CAMS) & Weather Telemetry',
      measurementTimestamp: currentTimeStr,
      fetchedAt: new Date().toISOString(),
      usAqi,
      euAqi,
      dominantPollutant: determineDominantPollutant(pollutants),
      category: classifyUsAqi(usAqi),
      pollutants,
      weather: {
        temperatureC: tempC,
        relativeHumidityPct: humidity,
        windSpeedKmh: windKmh,
        surfacePressureHpa: pressure,
        inversionRisk: inversion.risk,
        inversionExplanation: inversion.explanation,
      },
      hourlySeries,
      dailyComparison: buildDailyComparison(hourlySeries),
      healthPrecautions: buildHealthPrecautions(usAqi, pm25),
      bestOutdoorWindow: findBestOutdoorWindow(hourlySeries),
    };

    writeTelemetryCache(cacheKey, payload);

    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network timeout';
    return buildUnavailableFallbackPayload(location, message);
  }
  })();

  if (!options?.bypassCache) {
    inFlightTelemetry.set(cacheKey, fetchPromise);
  }

  try {
    return await fetchPromise;
  } finally {
    inFlightTelemetry.delete(cacheKey);
  }
}
