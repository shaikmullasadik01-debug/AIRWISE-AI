import type {
  AirQualityPayload,
  AlertPreferences,
  AlertSeverityLevel,
  AqiCategoryInfo,
  FamilyProfileId,
  TriggeredAlertItem,
} from '../types/airwise';

export interface FamilyProfileMeta {
  id: FamilyProfileId;
  label: string;
  shortDescription: string;
}

export const FAMILY_PROFILE_META: FamilyProfileMeta[] = [
  {
    id: 'adults',
    label: 'Adults',
    shortDescription: 'General adult household members & commuters',
  },
  {
    id: 'children',
    label: 'Children',
    shortDescription: 'Developing lungs & higher breathing rate per body weight',
  },
  {
    id: 'older-adults',
    label: 'Older Adults',
    shortDescription: 'Adults 65+ with higher cardiovascular & respiratory sensitivity',
  },
  {
    id: 'respiratory',
    label: 'Respiratory Sensitivities',
    shortDescription: 'People sensitive to asthma triggers, bronchitis, or smoke',
  },
  {
    id: 'outdoor-workers',
    label: 'Outdoor Workers',
    shortDescription: 'Extended multi-hour outdoor shifts and physical tasks',
  },
  {
    id: 'students',
    label: 'Students',
    shortDescription: 'School commutes, campus transit, and playground recess',
  },
  {
    id: 'athletes',
    label: 'Athletes',
    shortDescription: 'High-ventilation endurance training & outdoor sports',
  },
];

export function getSeverityStyle(level: AqiCategoryInfo['level']) {
  switch (level) {
    case 'good':
      return {
        textClass: 'text-emerald-700 dark:text-emerald-300',
        bgClass: 'bg-emerald-50 dark:bg-emerald-950/50',
        borderClass: 'border-emerald-200 dark:border-emerald-800/80',
        barColor: '#10b981',
        markerText: 'Low Risk',
      };
    case 'moderate':
      return {
        textClass: 'text-sky-700 dark:text-sky-300',
        bgClass: 'bg-sky-50 dark:bg-sky-950/50',
        borderClass: 'border-sky-200 dark:border-sky-800/80',
        barColor: '#0284c7',
        markerText: 'Moderate Risk',
      };
    case 'sensitive':
      return {
        textClass: 'text-amber-800 dark:text-amber-300',
        bgClass: 'bg-amber-50 dark:bg-amber-950/50',
        borderClass: 'border-amber-200 dark:border-amber-800/80',
        barColor: '#d97706',
        markerText: 'Sensitive Alert',
      };
    case 'unhealthy':
      return {
        textClass: 'text-orange-800 dark:text-orange-300',
        bgClass: 'bg-orange-50 dark:bg-orange-950/50',
        borderClass: 'border-orange-200 dark:border-orange-800/80',
        barColor: '#ea580c',
        markerText: 'Poor Air',
      };
    case 'very-unhealthy':
      return {
        textClass: 'text-rose-800 dark:text-rose-300',
        bgClass: 'bg-rose-50 dark:bg-rose-950/50',
        borderClass: 'border-rose-200 dark:border-rose-800/80',
        barColor: '#e11d48',
        markerText: 'Severe Air',
      };
    case 'hazardous':
      return {
        textClass: 'text-red-900 dark:text-red-200',
        bgClass: 'bg-red-100 dark:bg-red-950/70',
        borderClass: 'border-red-300 dark:border-red-800',
        barColor: '#b91c1c',
        markerText: 'Hazardous',
      };
    default:
      return {
        textClass: 'text-slate-700 dark:text-slate-300',
        bgClass: 'bg-slate-100 dark:bg-slate-800/70',
        borderClass: 'border-slate-200 dark:border-slate-700',
        barColor: '#64748b',
        markerText: 'Unavailable',
      };
  }
}

export interface FamilyGuidanceCategory {
  category: string;
  recommendation: string;
  rationale: string;
}

export interface FamilyProfileGuidance {
  profileId: FamilyProfileId;
  label: string;
  riskTier: 'Routine' | 'Watchful' | 'Elevated' | 'Restrict Outdoor';
  items: FamilyGuidanceCategory[];
}

export function buildFamilySafetyGuidance(
  telemetry: AirQualityPayload,
  selectedProfiles: FamilyProfileId[],
): FamilyProfileGuidance[] {
  const aqi = telemetry.usAqi ?? 50;
  const pm25 = telemetry.pollutants.find((p) => p.key === 'pm25')?.value ?? null;
  const o3 = telemetry.pollutants.find((p) => p.key === 'o3')?.value ?? null;
  const highAqi = aqi > 150;
  const moderateOrSensitive = aqi > 50 && aqi <= 150;
  const usg = aqi > 100;

  return selectedProfiles.map((profileId) => {
    switch (profileId) {
      case 'children':
        return {
          profileId,
          label: 'Children',
          riskTier: highAqi ? 'Restrict Outdoor' : usg ? 'Elevated' : moderateOrSensitive ? 'Watchful' : 'Routine',
          items: [
            {
              category: 'Outdoor Play & School Recess',
              recommendation: highAqi
                ? 'Move recess, P.E., and playground time indoors with HEPA filtration.'
                : usg
                  ? 'Shorten vigorous outdoor play to 20–30 min intervals away from main roads.'
                  : 'Normal outdoor play is appropriate; prefer parks buffered by trees away from traffic.',
              rationale: 'Children breathe faster per kilogram of body weight and absorb higher doses of fine particles.',
            },
            {
              category: 'Commuting & Drop-off',
              recommendation: usg
                ? 'Avoid waiting near idling school pickup queues; turn off car engines while parked.'
                : 'Walk along quieter side streets rather than arterial roads during morning drop-off.',
              rationale: 'Tailpipe NO2 and ultrafine particles spike within 50 meters of congested pickup lanes.',
            },
            {
              category: 'Indoor Protection',
              recommendation: usg
                ? 'Keep bedroom windows closed and run a clean-filter HEPA purifier overnight.'
                : 'Refresh bedrooms when outdoor AQI is low and keep soft toys dust-free.',
              rationale: 'Clean sleeping air reduces cumulative 24-hour respiratory irritation.',
            },
          ],
        };
      case 'respiratory':
        return {
          profileId,
          label: 'People with Respiratory Sensitivities',
          riskTier: aqi > 100 ? 'Restrict Outdoor' : aqi > 50 ? 'Elevated' : 'Routine',
          items: [
            {
              category: 'Outdoor Activity & Exercise',
              recommendation:
                aqi > 100
                  ? 'Shift exercise indoors and carry your clinician-prescribed reliever plan if going outside.'
                  : aqi > 50
                    ? 'Reduce prolonged high-intensity exertion and avoid cold-air smog peaks.'
                    : 'Light to moderate outdoor activity is generally well tolerated; monitor personal comfort.',
              rationale: `PM2.5 (${pm25 ?? 'current'} µg/m³) and ozone (${o3 ?? 'current'} µg/m³) can trigger airway inflammation even below general population thresholds.`,
            },
            {
              category: 'Commute & Masking',
              recommendation:
                aqi > 100
                  ? 'Wear a well-fitting N95/FFP2 respirator outdoors and use cabin recirculation in vehicles.'
                  : 'Avoid areas with visible wood smoke, construction dust, or heavy diesel traffic.',
              rationale: 'Certified particulate respirators filter ≥95% of fine aerosols when sealed properly.',
            },
            {
              category: 'Severe Smog Precaution',
              recommendation:
                'Establish one clean-air room at home with closed windows and a correctly sized HEPA purifier; consult a healthcare professional promptly if breathing symptoms worsen.',
              rationale: 'AIRWISE AI provides environmental exposure guidance and does not replace medical care.',
            },
          ],
        };
      case 'older-adults':
        return {
          profileId,
          label: 'Older Adults (65+)',
          riskTier: highAqi ? 'Restrict Outdoor' : usg ? 'Elevated' : moderateOrSensitive ? 'Watchful' : 'Routine',
          items: [
            {
              category: 'Daily Walks & Errands',
              recommendation: highAqi
                ? 'Postpone outdoor errands or use indoor walking spaces; wear an N95 mask if travel is essential.'
                : usg
                  ? 'Take shorter walks during mid-morning or mid-afternoon when winter inversions often ease.'
                  : 'Daily outdoor walking is supportive; choose low-traffic neighborhood routes.',
              rationale: 'Fine PM2.5 particles cross into systemic circulation and can add cardiovascular strain.',
            },
            {
              category: 'Indoor Air & Hydration',
              recommendation:
                'Keep indoor air clean with HEPA filtration, avoid burning candles or incense, and maintain comfortable indoor humidity (40–55%).',
              rationale: 'Eliminating indoor combustion particles prevents compounding outdoor smog exposure.',
            },
          ],
        };
      case 'outdoor-workers':
        return {
          profileId,
          label: 'Outdoor Workers',
          riskTier: highAqi ? 'Restrict Outdoor' : usg ? 'Elevated' : 'Watchful',
          items: [
            {
              category: 'Shift Pacing & Breaks',
              recommendation: highAqi
                ? 'Rotate heavy physical tasks, schedule frequent indoor filtered-air breaks, and use N95/FFP2 respirators.'
                : usg
                  ? 'Hydrate regularly, pace heavy lifting, and take breaks away from diesel generators or road dust.'
                  : 'Use standard dust protection near construction or roadwork zones.',
              rationale: 'Multi-hour shifts multiply total inhaled particle dose compared with short errands.',
            },
            {
              category: 'Dust & Exhaust Controls',
              recommendation:
                'Wet down dry cutting/sweeping surfaces where applicable and stay upwind of idling machinery.',
              rationale: 'Source suppression reduces coarse PM10 and silica exposure at the breathing zone.',
            },
          ],
        };
      case 'students':
        return {
          profileId,
          label: 'Students',
          riskTier: highAqi ? 'Restrict Outdoor' : usg ? 'Elevated' : 'Routine',
          items: [
            {
              category: 'School Commute & Campus Transit',
              recommendation: usg
                ? 'Use transit or carpool rather than heavy-breathing bike sprints along busy avenues.'
                : 'Walk or cycle on dedicated greenways or quieter parallel streets.',
              rationale: 'Classroom concentration and respiratory comfort benefit from lower morning commute exposure.',
            },
            {
              category: 'Sports & After-School Practice',
              recommendation: highAqi
                ? 'Move practice to a filtered indoor gym or reschedule until AQI drops below 150.'
                : usg
                  ? 'Lower scrimmage intensity and build in frequent water/rest intervals.'
                  : 'Full outdoor sports schedule is appropriate under current air conditions.',
              rationale: 'Sustained athletic breathing switches from nasal filtration to deeper mouth breathing.',
            },
          ],
        };
      case 'athletes':
        return {
          profileId,
          label: 'Athletes',
          riskTier: highAqi ? 'Restrict Outdoor' : usg ? 'Elevated' : moderateOrSensitive ? 'Watchful' : 'Routine',
          items: [
            {
              category: 'Training Window & Intensity',
              recommendation: highAqi
                ? 'Move endurance intervals indoors to a clean-air facility.'
                : usg
                  ? 'Swap high-intensity intervals for lower-intensity base training away from traffic.'
                  : 'Check hourly forecast: train during lower-ozone morning hours on sunny days or after wind picks up.',
              rationale: 'Minute ventilation increases 10–15x during vigorous running/cycling, driving particles deeper into lungs.',
            },
            {
              category: 'Route Selection',
              recommendation:
                'Pick waterfronts, parks, or tracks >150m from multi-lane highways.',
              rationale: 'Traffic-related NO2 and ultrafine soot fall sharply with distance from roadways.',
            },
          ],
        };
      default:
        return {
          profileId: 'adults',
          label: 'Adults',
          riskTier: highAqi ? 'Restrict Outdoor' : usg ? 'Elevated' : 'Routine',
          items: [
            {
              category: 'Outdoor Activity & Exercise',
              recommendation: highAqi
                ? 'Avoid prolonged outdoor exertion and shift workouts indoors.'
                : usg
                  ? 'Opt for moderate activity and monitor how you feel; reduce duration if throat irritation occurs.'
                  : 'Normal outdoor routines, walking, and exercise are safe.',
              rationale: 'Adjusting exertion intensity keeps inhaled particulate dose proportional to risk.',
            },
            {
              category: 'Commute & Daily Actions',
              recommendation:
                'Combine errands, avoid engine idling, and run kitchen exhaust fans while cooking.',
              rationale: 'Reducing everyday combustion helps protect both household air and neighborhood AQI.',
            },
          ],
        };
    }
  });
}

export function computeIndoorAdvisory(
  telemetry: AirQualityPayload,
  roomSqm: number,
  filterInstalledDate: string,
) {
  const aqi = telemetry.usAqi ?? 50;
  const pm25 = telemetry.pollutants.find((p) => p.key === 'pm25')?.value ?? 12;
  const wind = telemetry.weather.windSpeedKmh ?? 10;

  let ventilationDecision: {
    status: 'open-windows' | 'brief-purge' | 'keep-closed';
    headline: string;
    detail: string;
  };

  if (aqi <= 50 && pm25 <= 15) {
    ventilationDecision = {
      status: 'open-windows',
      headline: 'Cross-ventilate with outdoor air now',
      detail: `Outdoor air is clean (US AQI ${aqi}, PM2.5 ${pm25} µg/m³). Opening opposite windows for 15–30 minutes flushes indoor CO₂ and cooking/cleaning VOCs effectively.`,
    };
  } else if (aqi <= 100 && wind >= 10) {
    ventilationDecision = {
      status: 'brief-purge',
      headline: 'Use brief, timed window ventilation away from busy streets',
      detail: `Outdoor air is moderate (US AQI ${aqi}). Open windows on the quiet side of your home for 10 minutes after cooking, then close and run HEPA filtration.`,
    };
  } else {
    ventilationDecision = {
      status: 'keep-closed',
      headline: 'Keep windows closed & recirculate via HEPA filtration',
      detail: `Outdoor pollution is elevated (US AQI ${aqi}, PM2.5 ${pm25} µg/m³). Keep windows sealed, seal obvious door drafts, and run true HEPA purifiers continuously.`,
    };
  }

  // Standard AHAM 2/3 rule approximation for 2.4m ceiling (~4.8 ACH): CADR (m3/h) ≈ roomSqm * 2.4 * 4.8 ≈ roomSqm * 11.5
  const validSqm = Math.max(5, Math.min(250, Number.isFinite(roomSqm) ? roomSqm : 25));
  const recommendedCadrM3h = Math.round(validSqm * 11.5);
  const recommendedCadrCfm = Math.round(recommendedCadrM3h / 1.699);

  // Filter age calculation
  let filterDaysRemaining: number | null = null;
  let filterStatusText = 'Set installation date to track 6-month (180-day) HEPA filter schedule.';
  if (filterInstalledDate) {
    const installedMs = Date.parse(filterInstalledDate);
    if (Number.isFinite(installedMs)) {
      const elapsedDays = Math.max(0, Math.floor((Date.now() - installedMs) / 86_400_000));
      filterDaysRemaining = Math.max(0, 180 - elapsedDays);
      if (filterDaysRemaining === 0) {
        filterStatusText = `Installed ${elapsedDays} days ago — replacement due now (inspect pre-filter and HEPA media).`;
      } else if (filterDaysRemaining <= 30) {
        filterStatusText = `${filterDaysRemaining} days remaining in 180-day cycle — order replacement filter soon.`;
      } else {
        filterStatusText = `${filterDaysRemaining} days remaining in standard 180-day cycle (vacuum pre-filter monthly).`;
      }
    }
  }

  return {
    ventilationDecision,
    recommendedCadrM3h,
    recommendedCadrCfm,
    filterDaysRemaining,
    filterStatusText,
  };
}

export function evaluatePollutionAlerts(
  telemetry: AirQualityPayload,
  prefs: AlertPreferences,
  profiles: FamilyProfileId[],
): TriggeredAlertItem[] {
  const aqi = telemetry.usAqi;
  if (aqi === null || telemetry.dataStatus === 'unavailable-sample') {
    return [];
  }

  const profileLabels = profiles
    .map((id) => FAMILY_PROFILE_META.find((m) => m.id === id)?.label ?? id)
    .join(', ');

  const alerts: TriggeredAlertItem[] = [];

  const checkThreshold = (
    level: AlertSeverityLevel,
    minAqi: number,
    maxAqi: number | null,
    title: string,
    whyItMatters: string,
    practicalAction: string,
  ) => {
    if (!prefs.enabledLevels[level]) return;
    const matches = aqi >= minAqi && (maxAqi === null || aqi <= maxAqi);
    if (!matches) return;
    alerts.push({
      level,
      title,
      whatChanged: `${telemetry.location.name} reached US AQI ${aqi} (${telemetry.category.label}), driven primarily by ${telemetry.dominantPollutant}.`,
      whyItMatters,
      whoNeedsPrecautions: `Selected household profiles (${profileLabels}) — especially children, older adults, and people with respiratory sensitivities.`,
      practicalAction,
    });
  };

  checkThreshold(
    'moderate',
    51,
    100,
    'Moderate Air Pollution Notice',
    'Moderate particulate or ozone concentrations can irritate unusually sensitive airways during sustained exertion.',
    'Choose lower-traffic routes for walks and run exhaust ventilation while cooking indoors.',
  );

  checkThreshold(
    'poor',
    101,
    150,
    'Poor Air Quality Alert (Sensitive Groups)',
    'Fine particles and traffic pollutants exceed healthy benchmarks for developing lungs and sensitive cardiovascular or respiratory systems.',
    'Shorten vigorous outdoor activity, move school play indoors if symptoms appear, and close windows facing busy streets.',
  );

  checkThreshold(
    'severe',
    151,
    200,
    'Severe Air Pollution Alert',
    'At AQI 151–200, prolonged outdoor exposure affects the general public as well as vulnerable household members.',
    'Move workouts indoors, wear a well-fitting N95/FFP2 respirator for essential outdoor commutes, and run HEPA purifiers continuously.',
  );

  checkThreshold(
    'hazardous',
    201,
    null,
    'Hazardous Pollution Emergency Alert',
    'Very high particulate concentration poses acute respiratory and cardiovascular exposure risk across all age groups.',
    'Remain indoors in a filtered clean-air room, seal window/door gaps, avoid all outdoor exertion, and monitor vulnerable family members closely.',
  );

  return alerts;
}
