import type {
  AqiCategoryInfo,
  AqiStandard,
  FamilyProfileId,
  HourlyAirQualityPoint,
  OptimalOutdoorWindow,
} from './types.ts';

export const ALLOWED_FAMILY_PROFILES: readonly FamilyProfileId[] = [
  'adults',
  'children',
  'older-adults',
  'respiratory',
  'outdoor-workers',
  'students',
  'athletes',
] as const;

export const DEFRA_PASSENGER_CAR_KG_CO2E_PER_KM = 0.171;
export const DEFRA_BUS_KG_CO2E_PER_KM = 0.102;
export const DEFRA_RAIL_KG_CO2E_PER_KM = 0.035;

/**
 * Computes US EPA AQI from PM2.5 (ug/m3) using official EPA 2024 revised breakpoints.
 */
export function calculateUsAqiFromPm25(pm25: number | null): number | null {
  if (pm25 === null || !Number.isFinite(pm25) || pm25 < 0) return null;
  const c = Math.floor(pm25 * 10) / 10;
  const breakpoints: Array<[number, number, number, number]> = [
    [0.0, 9.0, 0, 50],
    [9.1, 35.4, 51, 100],
    [35.5, 55.4, 101, 150],
    [55.5, 125.4, 151, 200],
    [125.5, 225.4, 201, 300],
    [225.5, 325.4, 301, 400],
    [325.5, 500.4, 401, 500],
  ];

  for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
    if (c >= cLow && c <= cHigh) {
      return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (c - cLow) + iLow);
    }
  }
  return 500;
}

export function classifyUsAqi(aqi: number | null): AqiCategoryInfo {
  if (aqi === null || !Number.isFinite(aqi) || aqi < 0) {
    return {
      level: 'unknown',
      label: 'Unavailable',
      shortCode: 'N/A',
      summary: 'No verified AQI measurement is currently available for this station.',
      usAqiRange: '—',
    };
  }
  if (aqi <= 50) {
    return {
      level: 'good',
      label: 'Good',
      shortCode: 'CAT 1',
      summary: 'Air quality is satisfactory and poses little or no risk for general outdoor activity.',
      usAqiRange: '0–50',
    };
  }
  if (aqi <= 100) {
    return {
      level: 'moderate',
      label: 'Moderate',
      shortCode: 'CAT 2',
      summary: 'Acceptable air quality; unusually sensitive individuals may experience mild respiratory discomfort.',
      usAqiRange: '51–100',
    };
  }
  if (aqi <= 150) {
    return {
      level: 'sensitive',
      label: 'Unhealthy for Sensitive Groups',
      shortCode: 'CAT 3',
      summary: 'Children, older adults, and people with asthma or heart/lung conditions should limit prolonged exertion.',
      usAqiRange: '101–150',
    };
  }
  if (aqi <= 200) {
    return {
      level: 'unhealthy',
      label: 'Unhealthy',
      shortCode: 'CAT 4',
      summary: 'Everyone may begin to experience health effects; sensitive groups should avoid outdoor exertion.',
      usAqiRange: '151–200',
    };
  }
  if (aqi <= 300) {
    return {
      level: 'very-unhealthy',
      label: 'Very Unhealthy',
      shortCode: 'CAT 5',
      summary: 'Health alert: risk of respiratory irritation increases for the entire population. Stay indoors with filtered air.',
      usAqiRange: '201–300',
    };
  }
  return {
    level: 'hazardous',
    label: 'Hazardous',
    shortCode: 'CAT 6',
    summary: 'Emergency conditions: everyone should avoid all outdoor physical exertion and seal indoor spaces with HEPA filtration.',
    usAqiRange: '301+',
  };
}

export function classifyEuAqi(euAqi: number | null): { label: string; description: string } {
  if (euAqi === null || !Number.isFinite(euAqi)) {
    return { label: 'Unavailable', description: 'European AQI index not reported.' };
  }
  if (euAqi <= 20) return { label: 'Good (EU 1)', description: 'Minimal exposure risk under EEA scale.' };
  if (euAqi <= 40) return { label: 'Fair (EU 2)', description: 'Low exposure; standard outdoor activity is suitable.' };
  if (euAqi <= 60) return { label: 'Moderate (EU 3)', description: 'Consider reducing intense outdoor exertion if sensitive.' };
  if (euAqi <= 80) return { label: 'Poor (EU 4)', description: 'Sensitive groups should reduce outdoor physical activities.' };
  if (euAqi <= 100) return { label: 'Very Poor (EU 5)', description: 'Reduce outdoor activity for all groups; ventilate carefully.' };
  return { label: 'Extremely Poor (EU 6)', description: 'Avoid outdoor physical exertion and protect indoor air.' };
}

export function getStandardDisplayLabel(standard: AqiStandard): string {
  switch (standard) {
    case 'us-epa':
      return 'US EPA AQI (0–500 scale)';
    case 'eu-eaqi':
      return 'European AQI (EEA 0–100+ scale)';
    case 'who-2021':
      return 'WHO 2021 Air Quality Guidelines (µg/m³)';
  }
}

export function computeInversionRisk(
  windSpeedKmh: number | null,
  humidityPct: number | null,
  temperatureC: number | null,
  pm25: number | null,
): { risk: 'low' | 'moderate' | 'elevated' | 'unknown'; explanation: string } {
  if (windSpeedKmh === null && humidityPct === null) {
    return {
      risk: 'unknown',
      explanation: 'Insufficient wind and humidity telemetry to evaluate atmospheric stagnation.',
    };
  }
  const lowWind = windSpeedKmh !== null && windSpeedKmh < 8;
  const calmWind = windSpeedKmh !== null && windSpeedKmh < 14;
  const coolOrDamp = (temperatureC !== null && temperatureC < 12) || (humidityPct !== null && humidityPct > 72);
  const highPm = pm25 !== null && pm25 > 35;

  if (lowWind && (coolOrDamp || highPm)) {
    return {
      risk: 'elevated',
      explanation: 'Calm surface winds (< 8 km/h) combined with cool or humid surface conditions reduce vertical dispersion and can trap urban emissions near ground level.',
    };
  }
  if (calmWind || highPm) {
    return {
      risk: 'moderate',
      explanation: 'Light winds slow pollutant dispersion; concentrations may accumulate during peak traffic or evening heating hours.',
    };
  }
  return {
    risk: 'low',
    explanation: 'Surface wind speed supports active atmospheric mixing and faster dispersion of local emissions.',
  };
}

export function buildHealthPrecautions(
  aqi: number | null,
  pm25: number | null,
): string[] {
  const cat = classifyUsAqi(aqi);
  if (cat.level === 'good') {
    return [
      'Outdoor exercise, cycling, and school play are generally safe for all groups.',
      'Use open-window cross-ventilation when outdoor traffic is light to refresh indoor air.',
      'Prefer walking or transit for short errands to help keep local emissions low.',
    ];
  }
  if (cat.level === 'moderate') {
    return [
      'Unusually sensitive individuals (including people with asthma) should watch for coughing or shortness of breath during vigorous exercise.',
      'Avoid exercising directly alongside congested roads where NO2 and ultrafine particles peak.',
      'Run kitchen exhaust fans while cooking so indoor pollutants do not compound outdoor haze.',
    ];
  }
  if (cat.level === 'sensitive') {
    return [
      'Children, older adults, and people with respiratory or cardiovascular conditions should shorten or reschedule vigorous outdoor activities.',
      'Keep windows closed during peak traffic hours and operate a true HEPA purifier in bedrooms and living areas.',
      'Move school sports or intense workouts indoors or to lower-pollution morning/midday windows.',
    ];
  }
  if (cat.level === 'unhealthy') {
    return [
      'Everyone should reduce prolonged or heavy outdoor exertion; sensitive groups should remain indoors as much as possible.',
      'Wear a well-fitting N95/FFP2 respirator if commuting outdoors or working outside.',
      'Recirculate indoor air and verify air purifier filters are clean and unblocked.',
    ];
  }
  return [
    'Avoid all strenuous outdoor activity and keep vulnerable household members indoors in filtered rooms.',
    'Seal gaps around windows/doors if outdoor smoke or winter smog is visible, and run HEPA filtration continuously on high.',
    `Current PM2.5 (${pm25 !== null ? `${pm25.toFixed(1)} µg/m³` : 'elevated'}) poses acute exposure risk; consult a qualified clinician if anyone develops wheezing or chest tightness.`,
  ];
}

/**
 * Calculates verified CO2e savings ONLY when a positive trip distance (km) is provided.
 * Uses UK DEFRA 2024 average passenger car (0.171 kg CO2e/km) vs active/transit mode.
 */
export function calculateCommuteSavingsKg(
  distanceKm: number | null | undefined,
  mode: 'walk-cycle' | 'public-bus' | 'rail-metro',
): { savedKg: number | null; note: string } {
  if (distanceKm === null || distanceKm === undefined || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return {
      savedKg: null,
      note: 'Enter a round-trip or one-way distance in km to calculate an emission-factor estimate (no savings are invented without activity distance).',
    };
  }
  const boundedKm = Math.min(distanceKm, 500);
  const modeFactor =
    mode === 'walk-cycle'
      ? 0
      : mode === 'public-bus'
        ? DEFRA_BUS_KG_CO2E_PER_KM
        : DEFRA_RAIL_KG_CO2E_PER_KM;
  const saved = Math.max(0, Number(((DEFRA_PASSENGER_CAR_KG_CO2E_PER_KM - modeFactor) * boundedKm).toFixed(2)));
  return {
    savedKg: saved,
    note: `Estimated from ${boundedKm} km replacing an average petrol/diesel passenger car (${DEFRA_PASSENGER_CAR_KG_CO2E_PER_KM} kg CO₂e/km vs ${modeFactor} kg CO₂e/km, DEFRA 2024).`,
  };
}

/**
 * Finds the lowest-pollution 3-hour window across the upcoming 24h forecast
 * to help families time outdoor exercise, school walks, or window ventilation.
 */
export function findBestOutdoorWindow(
  hourlySeries: HourlyAirQualityPoint[],
): OptimalOutdoorWindow | null {
  const upcoming = hourlySeries.filter((pt) => pt.isForecast).slice(0, 24);
  if (upcoming.length < 3) return null;

  let bestStartIdx = -1;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestAvgPm25: number | null = null;
  let bestAvgAqi: number | null = null;

  for (let i = 0; i <= upcoming.length - 3; i += 1) {
    const slice = upcoming.slice(i, i + 3);
    const aqis = slice.map((s) => s.usAqi).filter((v): v is number => v !== null);
    const pm25s = slice.map((s) => s.pm25).filter((v): v is number => v !== null);
    if (aqis.length === 0 && pm25s.length === 0) continue;

    const avgAqi = aqis.length > 0 ? aqis.reduce((a, b) => a + b, 0) / aqis.length : null;
    const avgPm = pm25s.length > 0 ? pm25s.reduce((a, b) => a + b, 0) / pm25s.length : null;
    const score = avgAqi ?? (avgPm !== null ? avgPm * 2 : Number.POSITIVE_INFINITY);

    if (score < bestScore) {
      bestScore = score;
      bestStartIdx = i;
      bestAvgAqi = avgAqi !== null ? Math.round(avgAqi) : null;
      bestAvgPm25 = avgPm !== null ? Math.round(avgPm * 10) / 10 : null;
    }
  }

  if (bestStartIdx === -1) return null;
  const startLabel = upcoming[bestStartIdx].timestamp.slice(11, 16) || upcoming[bestStartIdx].timestamp;
  const endLabel = upcoming[bestStartIdx + 2].timestamp.slice(11, 16) || upcoming[bestStartIdx + 2].timestamp;

  const rationale =
    bestAvgAqi !== null && bestAvgAqi > 150
      ? 'Forecast remains unhealthy across the next 24h; keep strenuous exercise indoors even during this relative dip.'
      : bestAvgAqi !== null && bestAvgAqi > 100
        ? 'Relative dip in forecast pollution—suitable for brief essential errands or gentle walks for non-sensitive adults.'
        : 'Lowest forecasted particulate window over the next 24h; best time for outdoor exercise or brief home cross-ventilation.';

  return {
    windowLabel: `${startLabel} – ${endLabel}`,
    avgPm25: bestAvgPm25,
    avgUsAqi: bestAvgAqi,
    rationale,
  };
}

