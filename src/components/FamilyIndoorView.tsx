import { useState } from 'react';
import {
  CheckSquare,
  Fan,
  Home,
  Shield,
  Sprout,
  Square,
  Users,
} from 'lucide-react';
import type { AirQualityPayload, FamilyProfileId } from '../types/airwise';
import {
  FAMILY_PROFILE_META,
  buildFamilySafetyGuidance,
  computeIndoorAdvisory,
} from '../utils/airQualityHelpers';

interface FamilyIndoorViewProps {
  telemetry: AirQualityPayload | null;
  selectedProfiles: FamilyProfileId[];
  onToggleProfile: (id: FamilyProfileId) => void;
  checkedChecklistIds: string[];
  onToggleChecklistItem: (id: string, title: string) => void;
}

const INDOOR_CUTAWAY_SRC = '/src/assets/images/indoor_airflow_cutaway_1794923509861.jpg';

const ROOM_CHECKLIST = [
  {
    id: 'kitchen-exhaust',
    room: 'Kitchen',
    title: 'Run externally vented range hood before and during frying/gas cooking',
    evidence: 'High evidence: cooking aerosols & NO2 are the leading indoor PM2.5 source.',
  },
  {
    id: 'bedroom-hepa',
    room: 'Bedrooms',
    title: 'Place HEPA purifier away from walls/curtains and keep running overnight on sleep mode',
    evidence: 'High evidence: lowers sleeping-zone PM2.5 by 40–70% in closed rooms.',
  },
  {
    id: 'entryway-mat',
    room: 'Entryway',
    title: 'Remove outdoor shoes at the door and use a washable walk-off mat',
    evidence: 'Moderate-high evidence: prevents tracking settled road dust & heavy metals indoors.',
  },
  {
    id: 'living-dust',
    room: 'Living Area',
    title: 'Use a damp microfiber cloth or HEPA-filtered vacuum instead of dry sweeping',
    evidence: 'High evidence: prevents resuspending settled PM10 back into breathing height.',
  },
  {
    id: 'low-voc-clean',
    room: 'Utility & Bath',
    title: 'Choose fragrance-free, low-VOC cleaners and avoid aerosol sprays or incense',
    evidence: 'High evidence: eliminates indoor secondary organic aerosols and irritant fumes.',
  },
];

export function FamilyIndoorView({
  telemetry,
  selectedProfiles,
  onToggleProfile,
  checkedChecklistIds,
  onToggleChecklistItem,
}: FamilyIndoorViewProps) {
  const [roomSqm, setRoomSqm] = useState<number>(28);
  const [filterDate, setFilterDate] = useState<string>('');
  const [cutawayFailed, setCutawayFailed] = useState(false);

  if (!telemetry) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Loading location telemetry for personalized safety &amp; indoor guidance…
      </div>
    );
  }

  const familyGuidance = buildFamilySafetyGuidance(telemetry, selectedProfiles);
  const indoor = computeIndoorAdvisory(telemetry, roomSqm, filterDate);

  return (
    <div className="space-y-8">
      {/* Section 1: Personalized Family Safety Intelligence */}
      <section aria-labelledby="family-safety-heading" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1
              id="family-safety-heading"
              className="font-display flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white"
            >
              <Users className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span>Personalized Family Safety Intelligence</span>
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Select everyone in your household to calibrate outdoor activity, school play, commuting, and indoor precautions for{' '}
              {telemetry.location.name} (US AQI {telemetry.usAqi ?? 'N/A'}).
            </p>
          </div>
        </div>

        {/* Household Profile Selector */}
        <div
          role="group"
          aria-label="Household member profiles"
          className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FAMILY_PROFILE_META.map((profile) => {
            const active = selectedProfiles.includes(profile.id);
            return (
              <button
                key={profile.id}
                type="button"
                aria-pressed={active}
                onClick={() => onToggleProfile(profile.id)}
                className={`rounded-xl border p-3.5 text-left transition-colors ${
                  active
                    ? 'border-sky-600 bg-sky-50 text-sky-950 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{profile.label}</span>
                  <span className="font-mono text-[11px]">
                    {active ? 'Selected' : 'Add'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {profile.shortDescription}
                </p>
              </button>
            );
          })}
        </div>

        {/* Profile-Specific Precaution Cards */}
        <div className="grid gap-4 lg:grid-cols-2">
          {familyGuidance.map((group) => (
            <article
              key={group.profileId}
              className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {group.label}
                </h2>
                <span className="font-mono text-xs font-medium text-teal-700 dark:text-teal-300">
                  Posture: {group.riskTier}
                </span>
              </div>

              <div className="mt-3 space-y-3">
                {group.items.map((item) => (
                  <div key={item.category} className="space-y-0.5 text-xs">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {item.category}
                    </div>
                    <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                      {item.recommendation}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      Why: {item.rationale}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Shield className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            AIRWISE AI provides exposure-reduction guidance only and does not diagnose respiratory conditions or prescribe medication.
          </span>
        </p>
      </section>

      {/* Section 2: Smart Indoor Air Quality Advisor */}
      <section
        aria-labelledby="indoor-advisor-heading"
        className="space-y-5 border-t border-slate-200 pt-8 dark:border-slate-800"
      >
        <div>
          <h2
            id="indoor-advisor-heading"
            className="font-display flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white"
          >
            <Home className="h-5 w-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span>Smart Indoor Air Quality Advisor</span>
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Evidence-based ventilation timing, purifier sizing, cooking/dust controls, and room-by-room verification.
          </p>
        </div>

        {/* Ventilation Status + Architectural Cutaway */}
        <div className="grid items-stretch gap-6 lg:grid-cols-12">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-7 dark:border-slate-800 dark:bg-slate-900">
            <div>
              <div className="text-xs font-medium text-teal-700 dark:text-teal-300">
                Current Window &amp; Ventilation Guidance
              </div>
              <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
                {indoor.ventilationDecision.headline}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {indoor.ventilationDecision.detail}
              </p>
            </div>

            {/* HEPA CADR & Filter Tracker */}
            <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 dark:border-slate-800">
              <div>
                <label
                  htmlFor="room-size-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Room Floor Area (m²)
                </label>
                <input
                  id="room-size-input"
                  type="number"
                  min={5}
                  max={250}
                  value={roomSqm}
                  onChange={(e) => setRoomSqm(Number(e.target.value) || 20)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-900 focus:border-sky-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                  Target True HEPA CADR (4.8 ACH):{' '}
                  <span className="font-mono font-semibold text-sky-700 dark:text-sky-300">
                    {indoor.recommendedCadrM3h} m³/h ({indoor.recommendedCadrCfm} CFM)
                  </span>
                </p>
              </div>

              <div>
                <label
                  htmlFor="filter-date-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  HEPA Filter Installed Date
                </label>
                <input
                  id="filter-date-input"
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-900 focus:border-sky-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {indoor.filterStatusText}
                </p>
              </div>
            </div>

            {/* Realistic Expectations on Indoor Plants */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
                <Sprout className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>Indoor Plants: Realistic Scientific Expectations</span>
              </div>
              <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
                While houseplants improve visual comfort and indoor humidity slightly, controlled building-science studies show normal residential plant counts remove negligible PM2.5 or VOCs compared with real ventilation and HEPA filtration. Do not rely on houseplants to protect against urban smog; keep soil dry enough to avoid mold spores.
              </p>
            </div>
          </div>

          {/* Airflow Diagram */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-5 dark:border-slate-800 dark:bg-slate-900">
            {!cutawayFailed ? (
              <img
                src={INDOOR_CUTAWAY_SRC}
                alt="Isometric apartment diagram showing HEPA circulation, cross-ventilation, and kitchen exhaust airflow"
                referrerPolicy="no-referrer"
                onError={() => setCutawayFailed(true)}
                className="h-64 w-full object-cover lg:h-full"
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center bg-slate-100 p-6 text-center dark:bg-slate-950">
                <Fan className="h-8 w-8 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  Indoor Airflow Zones: Kitchen Exhaust → HEPA Recirculation → Cross-Ventilation
                </p>
              </div>
            )}
            <div className="border-t border-slate-100 p-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Prioritize source exhaust in kitchens first, mechanical HEPA filtration in sleeping zones second, and outdoor cross-ventilation when outdoor AQI ≤ 50.
            </div>
          </div>
        </div>

        {/* Room-by-Room Improvement Checklist */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Room-by-Room Indoor Air Checklist
            </h3>
            <span className="font-mono text-xs text-teal-700 dark:text-teal-300">
              {checkedChecklistIds.length} / {ROOM_CHECKLIST.length} verified
            </span>
          </div>

          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {ROOM_CHECKLIST.map((item) => {
              const checked = checkedChecklistIds.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => onToggleChecklistItem(item.id, item.title)}
                  className="flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-950/60"
                >
                  {checked ? (
                    <CheckSquare
                      className="mt-0.5 h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <Square
                      className="mt-0.5 h-5 w-5 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                  )}
                  <div>
                    <div className="text-xs font-medium text-sky-700 dark:text-sky-400">
                      {item.room}
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        checked
                          ? 'text-slate-500 line-through dark:text-slate-400'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {item.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {item.evidence}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
