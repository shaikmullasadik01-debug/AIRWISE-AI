import { useState } from 'react';
import { BookOpen, Layers } from 'lucide-react';

const PARTICULATE_IMG_SRC = '/src/assets/images/particulate_scale_science_1794923511282.jpg';

const EDUCATION_TOPICS = [
  {
    id: 'pm-scale',
    title: '01. PM2.5 vs. PM10 Particulate Matter',
    summary:
      'PM10 particles (≤10 µm) settle mostly in the nose and upper airways, whereas PM2.5 (≤2.5 µm—about 30× thinner than a human hair) reaches deep lung alveoli and can enter the bloodstream.',
    example:
      'Example: Road dust kicked up by tires is largely PM10; diesel exhaust soot, wood smoke, and secondary winter haze are predominantly PM2.5.',
  },
  {
    id: 'traffic',
    title: '02. Traffic-Related Air Pollution',
    summary:
      'Motor vehicles emit nitrogen oxides (NO2), carbon monoxide (CO), ultrafine tailpipe soot, and non-exhaust particles from brake pads and tire abrasion.',
    example:
      'Example: Concentrations of NO2 and ultrafine soot are typically highest within 50–150 meters of congested intersections and drop sharply along side streets.',
  },
  {
    id: 'industrial',
    title: '03. Industrial & Power Emissions',
    summary:
      'Manufacturing boilers, refineries, and fossil-fuel power plants release sulfur dioxide (SO2), nitrogen oxides, and heavy particulates that react in damp air to form fine sulfates and nitrates.',
    example:
      'Example: Plumes emitted miles upwind can convert chemically overnight into regional PM2.5 haze affecting entire metropolitan basins.',
  },
  {
    id: 'construction',
    title: '04. Construction & Resuspended Dust',
    summary:
      'Excavation, demolition, concrete cutting, and uncovered haul trucks release coarse mineral dust (PM10) and crystalline silica near active work zones.',
    example:
      'Example: Dry, windy afternoons around active building sites cause sharp short-term PM10 spikes even when regional PM2.5 is moderate.',
  },
  {
    id: 'inversions',
    title: '05. Winter Temperature Inversions',
    summary:
      'Normally, warm air near the ground rises and disperses pollutants upward. During clear, calm winter nights, the ground cools rapidly, trapping a cold polluted layer beneath a warmer "lid" aloft.',
    example:
      'Example: Valley cities such as Salt Lake City, Milan, or Delhi NCR often record multi-day winter smog episodes whenever high pressure suppresses wind.',
  },
  {
    id: 'smog',
    title: '06. Photochemical & Winter Smog Formation',
    summary:
      'Summer photochemical smog forms when sunlight drives reactions between NOx and volatile organic compounds (VOCs) to create ground-level ozone (O3); winter smog is dominated by trapped primary smoke and secondary ammonium nitrate particles.',
    example:
      'Example: Ground-level ozone usually peaks in mid-afternoon on hot sunny days, whereas winter particulate smog peaks overnight and early morning.',
  },
  {
    id: 'indoor-outdoor',
    title: '07. Indoor vs. Outdoor Air Dynamics',
    summary:
      'Indoor air reflects both outdoor infiltration through cracks/windows and indoor sources—principally high-heat frying, unvented gas stoves, incense, candles, and cleaning aerosols.',
    example:
      'Example: Frying on a gas stove without an externally vented range hood can temporarily elevate kitchen PM2.5 above severe outdoor smog levels.',
  },
  {
    id: 'long-term',
    title: '08. Long-Term Environmental & Community Impacts',
    summary:
      'Chronic air pollution harms cardiovascular and respiratory resilience across communities, reduces crop photosynthesis via ozone leaf damage, and acidifies soils and urban waterways.',
    example:
      'Example: Shifting short urban car trips, electrifying heating/cooking, and protecting urban tree canopies yield compounding community health and climate gains.',
  },
];

export function EducationView() {
  const [imgFailed, setImgFailed] = useState(false);
  const [windSpeed, setWindSpeed] = useState(6);
  const [inversionLidStrength, setInversionLidStrength] = useState(75);

  const dispersionScore = Math.max(5, Math.min(100, windSpeed * 4 - inversionLidStrength * 0.4 + 45));
  const estimatedTrapping =
    dispersionScore < 35
      ? 'Severe Trapping (Cold smog stays pinned near street level)'
      : dispersionScore < 65
        ? 'Moderate Stagnation (Slow vertical mixing)'
        : 'Active Mixing (Wind breaks inversion lid and dilutes pollutants)';

  return (
    <div className="space-y-8">
      {/* Editorial Header + Particulate Scale Visual */}
      <section className="grid items-stretch gap-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h1 className="font-display flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
              <BookOpen className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span>Air Pollution Science &amp; Impact Explainer</span>
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              Understanding particle size, emission sources, and winter weather physics makes it much easier to decide when to ventilate, where to exercise, and which daily habits reduce urban pollution most effectively.
            </p>
          </div>

          {/* Interactive Winter Inversion Simulator */}
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Layers className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
              <span>Interactive Winter Temperature Inversion Explorer</span>
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Adjust surface wind speed and warm-air lid intensity to see why winter smog lingers on calm days.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs">
                  <label htmlFor="sim-wind-slider" className="font-medium text-slate-700 dark:text-slate-300">
                    Surface Wind Speed
                  </label>
                  <span className="font-mono text-slate-900 dark:text-slate-100">{windSpeed} km/h</span>
                </div>
                <input
                  id="sim-wind-slider"
                  type="range"
                  min={1}
                  max={25}
                  value={windSpeed}
                  onChange={(e) => setWindSpeed(Number(e.target.value))}
                  className="mt-1 w-full accent-sky-700 dark:accent-sky-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs">
                  <label htmlFor="sim-lid-slider" className="font-medium text-slate-700 dark:text-slate-300">
                    Warm Air Lid Strength (Night Cooling)
                  </label>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {inversionLidStrength}%
                  </span>
                </div>
                <input
                  id="sim-lid-slider"
                  type="range"
                  min={10}
                  max={100}
                  value={inversionLidStrength}
                  onChange={(e) => setInversionLidStrength(Number(e.target.value))}
                  className="mt-1 w-full accent-teal-600 dark:accent-teal-400"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  Dispersion Outcome: {estimatedTrapping}
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-sky-600 transition-all dark:bg-sky-400"
                    style={{ width: `${dispersionScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scientific Particulate Scale Illustration */}
        <figure className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
          {!imgFailed ? (
            <img
              src={PARTICULATE_IMG_SRC}
              alt="Scientific scale comparison of PM2.5 and PM10 microscopic spheres beside a human hair and HEPA filter mesh"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="h-72 w-full object-cover lg:flex-1"
            />
          ) : (
            <div className="flex flex-1 items-center justify-center bg-slate-100 p-8 text-center text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
              Scale reference: Human hair (50–70 µm) vs. PM10 (≤10 µm) vs. PM2.5 (≤2.5 µm) captured by HEPA fiber mesh.
            </div>
          )}
          <figcaption className="border-t border-slate-100 p-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <strong>Scale Comparison:</strong> A single human hair is 50–70 micrometers wide—roughly 5–7× wider than PM10 and 20–28× wider than fine PM2.5 particles trapped by HEPA fiber mesh.
          </figcaption>
        </figure>
      </section>

      {/* 8 Core Educational Modules */}
      <section aria-labelledby="topics-grid-heading">
        <h2
          id="topics-grid-heading"
          className="mb-4 text-base font-semibold text-slate-900 dark:text-slate-100"
        >
          Urban Pollution Mechanisms &amp; Real-World Examples
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {EDUCATION_TOPICS.map((topic) => (
            <article
              key={topic.id}
              className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {topic.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {topic.summary}
              </p>
              <p className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-teal-800 dark:border-slate-800 dark:text-teal-300">
                {topic.example}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
