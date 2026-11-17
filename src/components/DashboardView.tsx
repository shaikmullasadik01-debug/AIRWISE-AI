import { useState } from 'react';
import {
  AlertTriangle,
  CloudSun,
  Compass,
  Droplets,
  Gauge,
  MessageSquare,
  ShieldCheck,
  Thermometer,
  Wind,
} from 'lucide-react';
import type {
  AirQualityPayload,
  AqiStandard,
  CompletedActionRecord,
  TriggeredAlertItem,
} from '../types/airwise';
import { getSeverityStyle } from '../utils/airQualityHelpers';
import { AnalyticsCharts } from './AnalyticsCharts';
import { SeverityIndicator } from './SeverityIndicator';

interface DashboardViewProps {
  telemetry: AirQualityPayload | null;
  loading: boolean;
  error: string | null;
  standard: AqiStandard;
  activeAlerts: TriggeredAlertItem[];
  completedActions: CompletedActionRecord[];
  onRetry: () => void;
  onNavigateToAssistant: (prefillQuestion?: string) => void;
  onNavigateToFamily: () => void;
}

const URBAN_PANORAMA_SRC = '/src/assets/images/urban_air_panorama_1794923508904.jpg';

export function DashboardView({
  telemetry,
  loading,
  error,
  standard,
  activeAlerts,
  completedActions,
  onRetry,
  onNavigateToAssistant,
  onNavigateToFamily,
}: DashboardViewProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  if (loading && !telemetry) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading air quality dashboard">
        <div className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error && !telemetry) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100"
      >
        <h2 className="text-lg font-semibold">Unable to Load Air Quality Telemetry</h2>
        <p className="mt-1 text-sm">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (!telemetry) return null;

  const severityStyle = getSeverityStyle(telemetry.category.level);
  const pm25 = telemetry.pollutants.find((p) => p.key === 'pm25');
  const displayPrimaryIndex =
    standard === 'eu-eaqi'
      ? telemetry.euAqi ?? '—'
      : standard === 'who-2021'
        ? pm25?.value ?? '—'
        : telemetry.usAqi ?? '—';

  const displayPrimaryUnit =
    standard === 'eu-eaqi'
      ? 'EU EAQI'
      : standard === 'who-2021'
        ? 'µg/m³ PM2.5'
        : 'US EPA AQI';

  const standardSubtitle =
    standard === 'eu-eaqi'
      ? 'European Environment Agency Index (0–100+)'
      : standard === 'who-2021'
        ? 'WHO 2021 24h Benchmark: 15 µg/m³ PM2.5'
        : `US EPA Scale (${telemetry.category.usAqiRange})`;

  return (
    <div className="space-y-6">
      {/* Honest Data Integrity Banner */}
      <div
        role={telemetry.dataStatus === 'unavailable-sample' ? 'alert' : 'status'}
        className={`flex flex-col gap-2 rounded-xl border px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between ${
          telemetry.dataStatus === 'unavailable-sample'
            ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100'
            : 'border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
        }`}
      >
        <div className="flex items-start gap-2.5">
          {telemetry.dataStatus === 'unavailable-sample' ? (
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300"
              aria-hidden="true"
            />
          ) : (
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400"
              aria-hidden="true"
            />
          )}
          <div>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {telemetry.dataStatus === 'unavailable-sample'
                ? 'Offline Reference Sample Mode'
                : 'Verified Telemetry Source'}
            </span>
            <span aria-hidden="true"> · </span>
            <span>{telemetry.dataStatusNotice}</span>
          </div>
        </div>
        <div className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-slate-400">
          Updated {new Date(telemetry.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Active Pollution Alert Strip (when configured thresholds are exceeded) */}
      {activeAlerts.length > 0 && (
        <section
          aria-label="Active pollution alerts"
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
        >
          {activeAlerts.slice(0, 1).map((alert) => (
            <div key={alert.level} className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{alert.title}</span>
                </h2>
                <button
                  type="button"
                  onClick={onNavigateToFamily}
                  className="text-xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
                >
                  View Household Protections
                </button>
              </div>
              <p className="text-xs text-amber-900 dark:text-amber-200">
                <strong>What changed:</strong> {alert.whatChanged}{' '}
                <strong>Action:</strong> {alert.practicalAction}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Hero Split: Primary AQI Readout + Urban Environment Visual */}
      <div className="grid items-stretch gap-6 lg:grid-cols-12">
        <section
          aria-labelledby="location-aqi-heading"
          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900"
        >
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                <span>
                  {telemetry.location.name}
                  {telemetry.location.region ? `, ${telemetry.location.region}` : ''} ·{' '}
                  {telemetry.location.country}
                </span>
              </span>
              <span className="font-mono">
                {telemetry.location.latitude.toFixed(2)}°, {telemetry.location.longitude.toFixed(2)}°
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <h1
                  id="location-aqi-heading"
                  className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white"
                >
                  <span className="font-mono">{displayPrimaryIndex}</span>{' '}
                  <span className="text-base font-medium text-slate-500 dark:text-slate-400">
                    {displayPrimaryUnit}
                  </span>
                </h1>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {standardSubtitle} · Primary driver: {telemetry.dominantPollutant}
                </p>
              </div>

              <div
                className={`rounded-lg border px-3 py-2 ${severityStyle.bgClass} ${severityStyle.borderClass}`}
              >
                <SeverityIndicator
                  level={telemetry.category.level}
                  label={telemetry.category.label}
                />
                <div className="mt-0.5 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  {telemetry.category.shortCode} · US AQI {telemetry.usAqi ?? '—'}
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {telemetry.category.summary}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Source: {telemetry.sourceAttribution}
            </span>
            <button
              type="button"
              onClick={() =>
                onNavigateToAssistant(
                  `Is it safe for my household to spend time outdoors in ${telemetry.location.name} right now?`,
                )
              }
              className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-sky-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ask AirWise AI About Today</span>
            </button>
          </div>
        </section>

        {/* Visual Frame with Fallback Container */}
        <div className="relative min-h-[240px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
          {!heroImgFailed ? (
            <img
              src={URBAN_PANORAMA_SRC}
              alt="Clean sustainable urban skyline illustrating atmospheric air quality monitoring"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-sky-900 via-teal-800 to-slate-900 p-6 text-center text-white">
              <CloudSun className="h-10 w-10 text-teal-300" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium">{telemetry.location.name} Airshed</p>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/45 to-transparent p-4 text-white">
            <p className="text-xs font-medium text-sky-200">
              Atmospheric Dispersion &amp; Local Weather
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
              <span>
                Temp:{' '}
                {telemetry.weather.temperatureC !== null
                  ? `${telemetry.weather.temperatureC}°C`
                  : 'N/A'}
              </span>
              <span>
                Humidity:{' '}
                {telemetry.weather.relativeHumidityPct !== null
                  ? `${telemetry.weather.relativeHumidityPct}%`
                  : 'N/A'}
              </span>
              <span>
                Wind:{' '}
                {telemetry.weather.windSpeedKmh !== null
                  ? `${telemetry.weather.windSpeedKmh} km/h`
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pollutant Telemetry Grid (6 core pollutants) */}
      <section aria-labelledby="pollutant-grid-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2
            id="pollutant-grid-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Pollutant Concentrations
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Measurement time: <span className="font-mono">{telemetry.measurementTimestamp}</span>
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {telemetry.pollutants.map((p) => {
            const exceedsWho = p.whoExceedanceRatio !== null && p.whoExceedanceRatio > 1;
            return (
              <div
                key={p.key}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {p.formula}
                  </span>
                  <span>
                    {p.whoGuideline24h
                      ? `WHO ${p.whoGuideline24h}`
                      : p.whoGuideline8h
                        ? `WHO ${p.whoGuideline8h}`
                        : ''}
                  </span>
                </div>
                <div className="mt-2 font-mono text-2xl font-bold text-slate-900 dark:text-white">
                  {p.value !== null ? p.value : '—'}
                  <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                    {p.value !== null ? p.unit : 'Not reported'}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {p.label}
                </p>
                {p.whoExceedanceRatio !== null && (
                  <p
                    className={`mt-1.5 font-mono text-[11px] font-medium ${
                      exceedsWho
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-teal-700 dark:text-teal-300'
                    }`}
                  >
                    {p.whoExceedanceRatio}× WHO limit
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Meteorology & Immediate Health Precautions */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section
          aria-labelledby="weather-inversion-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <h2
            id="weather-inversion-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Meteorology &amp; Smog Trapping Risk
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Temperature</span>
              </div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-white">
                {telemetry.weather.temperatureC !== null
                  ? `${telemetry.weather.temperatureC} °C`
                  : 'Unavailable'}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Relative Humidity</span>
              </div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-white">
                {telemetry.weather.relativeHumidityPct !== null
                  ? `${telemetry.weather.relativeHumidityPct} %`
                  : 'Unavailable'}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Wind className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Surface Wind</span>
              </div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 dark:text-white">
                {telemetry.weather.windSpeedKmh !== null
                  ? `${telemetry.weather.windSpeedKmh} km/h`
                  : 'Unavailable'}
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-950">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Inversion Risk</span>
              </div>
              <div className="mt-1 font-mono text-lg font-semibold capitalize text-slate-900 dark:text-white">
                {telemetry.weather.inversionRisk}
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {telemetry.weather.inversionExplanation}
          </p>

          {telemetry.bestOutdoorWindow && (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50/70 p-3 text-xs dark:border-teal-800/80 dark:bg-teal-950/40">
              <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-teal-900 dark:text-teal-200">
                <span>Best Forecast Window (Next 24h)</span>
                <span className="font-mono">{telemetry.bestOutdoorWindow.windowLabel}</span>
              </div>
              <p className="mt-1 text-teal-800 dark:text-teal-300">
                {telemetry.bestOutdoorWindow.avgUsAqi !== null
                  ? `Mean US AQI ~${telemetry.bestOutdoorWindow.avgUsAqi}`
                  : ''}
                {telemetry.bestOutdoorWindow.avgPm25 !== null
                  ? ` · PM2.5 ~${telemetry.bestOutdoorWindow.avgPm25} µg/m³`
                  : ''}
                {' — '}
                {telemetry.bestOutdoorWindow.rationale}
              </p>
            </div>
          )}
        </section>

        <section
          aria-labelledby="precautions-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2
              id="precautions-heading"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Immediate Everyday Precautions
            </h2>
            <button
              type="button"
              onClick={onNavigateToFamily}
              className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-400"
            >
              Customize by Household Profile →
            </button>
          </div>

          <ul className="mt-4 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
            {telemetry.healthPrecautions.map((tip, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-950"
              >
                <span className="mt-0.5 font-mono text-xs font-semibold text-teal-700 dark:text-teal-400">
                  0{idx + 1}
                </span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            Environmental health guidance supports everyday exposure reduction and does not replace advice from a licensed clinician.
          </p>
        </section>
      </div>

      {/* Interactive Visual Analytics */}
      <AnalyticsCharts telemetry={telemetry} completedActions={completedActions} />
    </div>
  );
}
