import { useMemo, useState } from 'react';
import { Table2, TrendingUp } from 'lucide-react';
import type { AirQualityPayload, CompletedActionRecord } from '../types/airwise';

interface AnalyticsChartsProps {
  telemetry: AirQualityPayload;
  completedActions: CompletedActionRecord[];
}

type ChartMetricMode = 'pm' | 'aqi';

export function AnalyticsCharts({ telemetry, completedActions }: AnalyticsChartsProps) {
  const [metricMode, setMetricMode] = useState<ChartMetricMode>('pm');
  const [showDataTable, setShowDataTable] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Sample down to ~36 legible hourly points (past 24h + next 12h forecast)
  const series = useMemo(() => {
    const all = telemetry.hourlySeries;
    if (all.length <= 36) return all;
    const firstForecastIdx = all.findIndex((p) => p.isForecast);
    if (firstForecastIdx === -1) return all.slice(-36);
    const start = Math.max(0, firstForecastIdx - 24);
    return all.slice(start, start + 36);
  }, [telemetry.hourlySeries]);

  const activeHoverIdx =
    hoverIdx !== null && hoverIdx >= 0 && hoverIdx < series.length ? hoverIdx : series.length - 1;
  const activePoint = series[activeHoverIdx];

  // SVG dimensions
  const width = 760;
  const height = 260;
  const padL = 48;
  const padR = 16;
  const padT = 20;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const { maxY, yUnit, primaryPath, secondaryPath, forecastSplitX, pointsCoords, whoLimitY } =
    useMemo(() => {
      if (series.length === 0) {
        return {
          maxY: 100,
          yUnit: 'µg/m³',
          primaryPath: '',
          secondaryPath: '',
          forecastSplitX: null as number | null,
          pointsCoords: [] as Array<{ x: number; y1: number | null; y2: number | null }>,
          whoLimitY: null as number | null,
        };
      }

      const vals = series.flatMap((pt) =>
        metricMode === 'pm' ? [pt.pm25 ?? 0, pt.pm10 ?? 0] : [pt.usAqi ?? 0, pt.euAqi ?? 0],
      );
      const rawMax = Math.max(...vals, metricMode === 'pm' ? 25 : 60);
      const computedMax = Math.ceil((rawMax * 1.15) / 10) * 10;

      const xFor = (i: number) =>
        series.length === 1 ? padL + plotW / 2 : padL + (i / (series.length - 1)) * plotW;
      const yFor = (val: number | null) => {
        if (val === null || !Number.isFinite(val)) return null;
        const clamped = Math.max(0, Math.min(computedMax, val));
        return padT + plotH - (clamped / computedMax) * plotH;
      };

      const coords = series.map((pt, i) => ({
        x: xFor(i),
        y1: yFor(metricMode === 'pm' ? pt.pm25 : pt.usAqi),
        y2: yFor(metricMode === 'pm' ? pt.pm10 : pt.euAqi),
      }));

      const buildLine = (key: 'y1' | 'y2') =>
        coords
          .map((c, idx) => {
            const y = c[key];
            if (y === null) return '';
            const prevValid = idx > 0 && coords[idx - 1][key] !== null;
            return `${prevValid ? 'L' : 'M'}${c.x.toFixed(1)},${y.toFixed(1)}`;
          })
          .filter(Boolean)
          .join(' ');

      const firstForecast = series.findIndex((p) => p.isForecast);
      const splitX = firstForecast > 0 ? xFor(firstForecast) : null;
      const whoY = metricMode === 'pm' ? yFor(15) : yFor(50);

      return {
        maxY: computedMax,
        yUnit: metricMode === 'pm' ? 'µg/m³' : 'Index',
        primaryPath: buildLine('y1'),
        secondaryPath: buildLine('y2'),
        forecastSplitX: splitX,
        pointsCoords: coords,
        whoLimitY: whoY,
      };
    }, [series, metricMode, plotH, plotW]);

  const totalActionCo2 = useMemo(() => {
    const known = completedActions.filter((a) => a.estimatedCo2SavedKg !== null);
    if (known.length === 0) return null;
    return Number(known.reduce((sum, item) => sum + (item.estimatedCo2SavedKg ?? 0), 0).toFixed(2));
  }, [completedActions]);

  return (
    <div className="space-y-6">
      {/* Main Time-Series Chart */}
      <section
        aria-labelledby="trend-chart-heading"
        className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
          <div>
            <h2
              id="trend-chart-heading"
              className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              <TrendingUp className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span>Hourly Air Quality History &amp; 12-Hour Forecast</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {telemetry.location.name} ·{' '}
              {telemetry.dataStatus === 'unavailable-sample'
                ? 'Reference baseline series (live API unavailable)'
                : 'Solid region: historical model analysis · Shaded region: short-term forecast'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Chart metric selector"
              className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-950"
            >
              <button
                type="button"
                onClick={() => setMetricMode('pm')}
                aria-pressed={metricMode === 'pm'}
                className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  metricMode === 'pm'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                PM2.5 &amp; PM10 (µg/m³)
              </button>
              <button
                type="button"
                onClick={() => setMetricMode('aqi')}
                aria-pressed={metricMode === 'aqi'}
                className={`whitespace-nowrap shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  metricMode === 'aqi'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                US &amp; EU AQI
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowDataTable((prev) => !prev)}
              aria-expanded={showDataTable}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{showDataTable ? 'Hide Table' : 'View Data Table'}</span>
            </button>
          </div>
        </div>

        {/* Legend & Crosshair Readout */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 bg-sky-600 dark:bg-sky-400" aria-hidden="true" />
              <span>{metricMode === 'pm' ? 'PM2.5 (µg/m³)' : 'US EPA AQI'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 border-t-2 border-dashed border-teal-600 dark:border-teal-400"
                aria-hidden="true"
              />
              <span>{metricMode === 'pm' ? 'PM10 (µg/m³)' : 'European EAQI'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 border-t border-dotted border-emerald-600 dark:border-emerald-400"
                aria-hidden="true"
              />
              <span>
                {metricMode === 'pm' ? 'WHO 24h PM2.5 Limit (15 µg/m³)' : 'Good AQI Boundary (50)'}
              </span>
            </span>
          </div>

          {activePoint && (
            <div
              aria-live="polite"
              className="font-mono text-xs text-slate-700 dark:text-slate-200"
            >
              <span>{activePoint.timestamp.replace('T', ' ')}</span>
              <span aria-hidden="true"> · </span>
              <span>{activePoint.isForecast ? 'Forecast' : 'Historical'}</span>
              <span aria-hidden="true"> · </span>
              {metricMode === 'pm' ? (
                <span>
                  PM2.5: {activePoint.pm25 ?? '—'} µg/m³ | PM10: {activePoint.pm10 ?? '—'} µg/m³
                </span>
              ) : (
                <span>
                  US AQI: {activePoint.usAqi ?? '—'} | EU AQI: {activePoint.euAqi ?? '—'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* SVG Chart (keyboard-scrubbable with Left/Right arrows) */}
        <div className="mt-3 w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            tabIndex={0}
            role="img"
            aria-label={`Hourly ${
              metricMode === 'pm' ? 'PM2.5 and PM10 particulate concentration' : 'US and EU AQI'
            } trend chart for ${telemetry.location.name}. Use left and right arrow keys to inspect individual hours.`}
            onKeyDown={(e) => {
              if (series.length === 0) return;
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                setHoverIdx((prev) => Math.max(0, (prev ?? series.length - 1) - 1));
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                setHoverIdx((prev) => Math.min(series.length - 1, (prev ?? series.length - 1) + 1));
              } else if (e.key === 'Home') {
                e.preventDefault();
                setHoverIdx(0);
              } else if (e.key === 'End') {
                e.preventDefault();
                setHoverIdx(series.length - 1);
              }
            }}
            className="h-60 w-full min-w-[540px] select-none rounded-lg focus-visible:outline-2 focus-visible:outline-sky-600"
            onMouseLeave={() => setHoverIdx(null)}
          >
            {/* Forecast shaded band */}
            {forecastSplitX !== null && (
              <rect
                x={forecastSplitX}
                y={padT}
                width={width - padR - forecastSplitX}
                height={plotH}
                className="fill-sky-50/70 dark:fill-sky-950/25"
              />
            )}

            {/* Horizontal grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
              const y = padT + plotH - frac * plotH;
              const val = Math.round(frac * maxY);
              return (
                <g key={frac}>
                  <line
                    x1={padL}
                    x2={width - padR}
                    y1={y}
                    y2={y}
                    className="stroke-slate-200 dark:stroke-slate-800"
                    strokeWidth="1"
                  />
                  <text
                    x={padL - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            <text
              x={padL}
              y={12}
              className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
            >
              {yUnit}
            </text>

            {/* WHO / Good reference line */}
            {whoLimitY !== null && whoLimitY >= padT && whoLimitY <= padT + plotH && (
              <line
                x1={padL}
                x2={width - padR}
                y1={whoLimitY}
                y2={whoLimitY}
                stroke="#059669"
                strokeWidth="1.25"
                strokeDasharray="3 3"
              />
            )}

            {/* Forecast split line */}
            {forecastSplitX !== null && (
              <g>
                <line
                  x1={forecastSplitX}
                  x2={forecastSplitX}
                  y1={padT}
                  y2={padT + plotH}
                  className="stroke-slate-400 dark:stroke-slate-600"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={forecastSplitX + 6}
                  y={padT + 12}
                  className="fill-sky-700 font-mono text-[10px] font-medium dark:fill-sky-300"
                >
                  Forecast →
                </text>
              </g>
            )}

            {/* Data lines */}
            {secondaryPath && (
              <path
                d={secondaryPath}
                fill="none"
                stroke="#0d9488"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
            )}
            {primaryPath && (
              <path d={primaryPath} fill="none" stroke="#0284c7" strokeWidth="2.5" />
            )}

            {/* Interactive Hover / Focus Columns */}
            {pointsCoords.map((pt, idx) => {
              const colWidth = plotW / Math.max(1, pointsCoords.length - 1);
              const isActive = idx === activeHoverIdx;
              return (
                <g key={series[idx]?.timestamp ?? idx}>
                  {isActive && (
                    <line
                      x1={pt.x}
                      x2={pt.x}
                      y1={padT}
                      y2={padT + plotH}
                      className="stroke-slate-400 dark:stroke-slate-500"
                      strokeWidth="1"
                    />
                  )}
                  {isActive && pt.y1 !== null && (
                    <circle cx={pt.x} cy={pt.y1} r="4.5" fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
                  )}
                  {isActive && pt.y2 !== null && (
                    <circle cx={pt.x} cy={pt.y2} r="4" fill="#0d9488" stroke="#ffffff" strokeWidth="1.5" />
                  )}
                  <rect
                    x={pt.x - colWidth / 2}
                    y={padT}
                    width={Math.max(10, colWidth)}
                    height={plotH}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={() => setHoverIdx(idx)}
                  />
                </g>
              );
            })}

            {/* X-axis timestamps */}
            {series.map((pt, idx) => {
              if (idx % 6 !== 0 && idx !== series.length - 1) return null;
              const x = pointsCoords[idx]?.x ?? padL;
              const label = pt.timestamp.slice(11, 16) || pt.timestamp.slice(5, 10);
              return (
                <text
                  key={pt.timestamp}
                  x={x}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                >
                  {label}
                </text>
              );
            })}
          </svg>
        </div>

        {/* Accessible Screen-Reader / Precision Data Table */}
        {showDataTable && (
          <div className="mt-4 overflow-x-auto border-t border-slate-100 pt-4 dark:border-slate-800">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <th scope="col" className="py-2 pr-4 font-semibold">Timestamp</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">Type</th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">US AQI</th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">EU AQI</th>
                  <th scope="col" className="py-2 pr-4 text-right font-semibold">PM2.5 (µg/m³)</th>
                  <th scope="col" className="py-2 text-right font-semibold">PM10 (µg/m³)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono dark:divide-slate-800">
                {series.slice(-12).map((row) => (
                  <tr key={row.timestamp} className="text-slate-700 dark:text-slate-200">
                    <td className="py-1.5 pr-4">{row.timestamp.replace('T', ' ')}</td>
                    <td className="py-1.5 pr-4 font-sans">
                      {row.isForecast ? 'Forecast' : 'Historical'}
                    </td>
                    <td className="py-1.5 pr-4 text-right">{row.usAqi ?? '—'}</td>
                    <td className="py-1.5 pr-4 text-right">{row.euAqi ?? '—'}</td>
                    <td className="py-1.5 pr-4 text-right">{row.pm25 ?? '—'}</td>
                    <td className="py-1.5 text-right">{row.pm10 ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 2-Column Analytics: WHO Guideline Ratios & Daily Comparison + Action Tracker */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* WHO Guideline Ratio Bar Chart */}
        <section
          aria-labelledby="who-ratio-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3
            id="who-ratio-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Pollutant Levels vs. WHO 2021 Guideline
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            1.0× indicates the World Health Organization 24-hour (or 8-hour O3) air quality benchmark.
          </p>

          <div className="mt-4 space-y-3">
            {telemetry.pollutants.map((p) => {
              const ratio = p.whoExceedanceRatio;
              const widthPct = ratio !== null ? Math.min(100, Math.round((ratio / 4) * 100)) : 0;
              const exceeds = ratio !== null && ratio > 1;
              return (
                <div key={p.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {p.formula}{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        ({p.label})
                      </span>
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {p.value !== null ? `${p.value} ${p.unit}` : 'Not reported'}{' '}
                      {ratio !== null ? `· ${ratio}× WHO` : ''}
                    </span>
                  </div>
                  <div
                    className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                    role="progressbar"
                    aria-label={`${p.formula} relative to WHO guideline`}
                    aria-valuenow={ratio ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={4}
                  >
                    {/* 1.0x marker at 25% of 4x scale */}
                    <div
                      className="absolute bottom-0 top-0 left-1/4 z-10 w-px bg-slate-400 dark:bg-slate-500"
                      aria-hidden="true"
                    />
                    <div
                      className={`h-full rounded-full transition-all ${
                        exceeds ? 'bg-amber-600 dark:bg-amber-500' : 'bg-teal-600 dark:bg-teal-500'
                      }`}
                      style={{ width: `${Math.max(ratio !== null ? 4 : 0, widthPct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Daily Comparison & Action Tracker */}
        <section
          aria-labelledby="daily-comparison-heading"
          className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
        >
          <h3
            id="daily-comparison-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Multi-Day Air Quality &amp; Action Tracking
          </h3>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Daily mean and peak US AQI alongside your logged low-emission household actions.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Avg AQI</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Peak AQI</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Mean PM2.5</th>
                  <th scope="col" className="py-2 font-medium">Peak Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {telemetry.dailyComparison.map((day) => (
                  <tr key={day.date} className="text-slate-700 dark:text-slate-200">
                    <td className="py-2 pr-3 font-mono">{day.date}</td>
                    <td className="py-2 pr-3 text-right font-mono">{day.avgUsAqi ?? '—'}</td>
                    <td className="py-2 pr-3 text-right font-mono font-semibold">
                      {day.maxUsAqi ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">
                      {day.avgPm25 !== null ? `${day.avgPm25} µg/m³` : '—'}
                    </td>
                    <td className="py-2">{day.dominantCategory}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                Logged Sustainable Actions
              </span>
              <span className="font-mono text-teal-700 dark:text-teal-300">
                {completedActions.length} completed
                {totalActionCo2 !== null ? ` · ~${totalActionCo2} kg CO₂e avoided` : ''}
              </span>
            </div>
            {completedActions.length === 0 ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Complete actions in the Daily Routine or Indoor Advisor tabs to track your household progress here.
              </p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                {completedActions.slice(-3).reverse().map((act) => (
                  <li key={act.id} className="flex items-center justify-between">
                    <span className="truncate">{act.title}</span>
                    <span className="ml-2 shrink-0 font-mono text-slate-500 dark:text-slate-400">
                      {act.date}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
