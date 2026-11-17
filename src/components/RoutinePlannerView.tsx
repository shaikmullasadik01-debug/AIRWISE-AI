import { type FormEvent, useState } from 'react';
import { CalendarClock, Check, Leaf, Loader2 } from 'lucide-react';
import type {
  AirQualityPayload,
  CompletedActionRecord,
  FamilyProfileId,
  RoutinePlanResponse,
} from '../types/airwise';

interface RoutinePlannerViewProps {
  telemetry: AirQualityPayload | null;
  profiles: FamilyProfileId[];
  completedActions: CompletedActionRecord[];
  onLogCompletedAction: (record: CompletedActionRecord) => void;
}

export function RoutinePlannerView({
  telemetry,
  profiles,
  completedActions,
  onLogCompletedAction,
}: RoutinePlannerViewProps) {
  const [commuteMode, setCommuteMode] = useState<'walk-cycle' | 'public-bus' | 'rail-metro'>(
    'walk-cycle',
  );
  const [distanceKm, setDistanceKm] = useState<string>('');
  const [hasGasStove, setHasGasStove] = useState<boolean>(true);
  const [plan, setPlan] = useState<RoutinePlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateRoutine(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!telemetry) return;

    setLoading(true);
    setError(null);
    try {
      const parsedDist = distanceKm.trim() === '' ? null : Number(distanceKm);
      const res = await fetch('/api/routine/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: telemetry.location,
          profiles,
          commuteMode,
          commuteDistanceKm: Number.isFinite(parsedDist) ? parsedDist : null,
          hasGasStove,
          simulateOutage: telemetry.dataStatus === 'unavailable-sample',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not generate routine.');
      }
      setPlan(data as RoutinePlanResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate daily routine.');
    } finally {
      setLoading(false);
    }
  }

  const todayDate = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header + Configuration Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="max-w-2xl">
          <h1 className="font-display flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
            <CalendarClock className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span>Low-Emission Daily Routine Generator</span>
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Generate Morning, Afternoon, and Evening plans balanced for both lower emissions and lower personal pollution exposure in{' '}
            {telemetry?.location.name ?? 'your city'}.
          </p>
        </div>

        <form
          onSubmit={generateRoutine}
          className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800"
        >
          <div>
            <label
              htmlFor="commute-mode-select"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Low-Emission Travel Option
            </label>
            <select
              id="commute-mode-select"
              value={commuteMode}
              onChange={(e) =>
                setCommuteMode(e.target.value as 'walk-cycle' | 'public-bus' | 'rail-metro')
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-sky-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="walk-cycle">Walk or Cycle</option>
              <option value="public-bus">Public Bus</option>
              <option value="rail-metro">Metro / Commuter Rail</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="commute-distance-input"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Daily Trip Replaced (km, optional)
            </label>
            <input
              id="commute-distance-input"
              type="number"
              min={0}
              max={500}
              step="0.5"
              value={distanceKm}
              onChange={(e) => setDistanceKm(e.target.value)}
              placeholder="e.g. 6"
              className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Leave blank to avoid unverified carbon estimates.
            </p>
          </div>

          <div className="flex flex-col justify-between">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Home Cooking Fuel
            </span>
            <label className="mt-1.5 flex h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
              <input
                type="checkbox"
                checked={hasGasStove}
                onChange={(e) => setHasGasStove(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
              />
              <span>Gas stove / burner used</span>
            </label>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading || !telemetry}
              className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-sky-700 px-4 text-sm font-medium text-white transition-colors hover:bg-sky-800 disabled:opacity-50 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Leaf className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Generate Daily Routine</span>
            </button>
          </div>
        </form>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-900 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-100"
          >
            {error}
          </div>
        )}
      </section>

      {/* Generated Routine Output */}
      {!plan ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            Configure your travel preference above and select Generate Daily Routine
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Each Morning, Afternoon, and Evening recommendation adapts to live AQI safety limits so you never trade lower vehicle emissions for unsafe smog inhalation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>
              Plan for <strong>{plan.locationName}</strong> · {plan.aqiContext}
            </span>
            <span className="font-mono font-semibold text-teal-700 dark:text-teal-300">
              {plan.totalEstimatedCo2SavedKg !== null
                ? `Estimated commute reduction: ${plan.totalEstimatedCo2SavedKg} kg CO₂e/day`
                : 'CO₂e estimate shown only when trip distance (km) is entered'}
            </span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {plan.actions.map((item) => {
              const actionId = `routine-${todayDate}-${item.period}-${item.title.slice(0, 18)}`;
              const isCompleted = completedActions.some((a) => a.id === actionId);

              return (
                <article
                  key={item.period}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                      <span className="font-mono text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
                        {item.period}
                      </span>
                      {item.estimatedCo2SavedKg !== null && (
                        <span className="font-mono text-xs text-emerald-700 dark:text-emerald-300">
                          −{item.estimatedCo2SavedKg} kg CO₂e
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                      {item.title}
                    </h2>

                    <dl className="space-y-2 text-xs leading-relaxed">
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-slate-200">
                          What to do
                        </dt>
                        <dd className="text-slate-600 dark:text-slate-300">{item.whatToDo}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-slate-200">
                          Why it matters
                        </dt>
                        <dd className="text-slate-600 dark:text-slate-300">{item.whyItMatters}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-slate-200">
                          Expected environmental benefit
                        </dt>
                        <dd className="text-slate-600 dark:text-slate-300">
                          {item.environmentalBenefit}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-slate-200">
                          Practical implementation
                        </dt>
                        <dd className="text-slate-600 dark:text-slate-300">
                          {item.practicalImplementation}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-slate-200">
                          Limitations &amp; context
                        </dt>
                        <dd className="text-slate-500 dark:text-slate-400">
                          {item.limitations} {item.co2CalculationNote}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <button
                    type="button"
                    disabled={isCompleted}
                    onClick={() =>
                      onLogCompletedAction({
                        id: actionId,
                        date: todayDate,
                        title: `${item.period}: ${item.title}`,
                        category: item.period === 'Evening' ? 'energy' : 'mobility',
                        estimatedCo2SavedKg: item.estimatedCo2SavedKg,
                      })
                    }
                    className={`mt-5 inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isCompleted ? 'Logged for Today' : 'Mark Completed Today'}</span>
                  </button>
                </article>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Methodology: {plan.emissionFactorCitation}
          </p>
        </div>
      )}
    </div>
  );
}
