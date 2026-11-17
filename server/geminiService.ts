import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { calculateCommuteSavingsKg, classifyEuAqi } from './aqi.ts';
import type {
  AiStructuredAnswer,
  AirQualityPayload,
  AqiStandard,
  ChatTurn,
  FamilyProfileId,
  RoutineActionItem,
  RoutinePlanResponse,
} from './types.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatTelemetryContext(
  telemetry: AirQualityPayload,
  standard: AqiStandard,
  profiles: FamilyProfileId[],
): string {
  const pollutantLines = telemetry.pollutants
    .map(
      (p) =>
        `- ${p.formula} (${p.label}): ${p.value !== null ? `${p.value} ${p.unit}` : 'Unavailable / Not reported'}${
          p.whoExceedanceRatio !== null ? ` (${p.whoExceedanceRatio}x WHO guideline)` : ''
        }`,
    )
    .join('\n');

  const euInfo = classifyEuAqi(telemetry.euAqi);
  return `
LOCATION: ${telemetry.location.name}${telemetry.location.region ? `, ${telemetry.location.region}` : ''}, ${telemetry.location.country}
DATA INTEGRITY STATUS: ${telemetry.dataStatus} (${telemetry.dataStatusNotice})
SOURCE ATTRIBUTION: ${telemetry.sourceAttribution}
MEASUREMENT TIMESTAMP: ${telemetry.measurementTimestamp}
ACTIVE AQI STANDARD SELECTED BY USER: ${standard}
US EPA AQI: ${telemetry.usAqi ?? 'Unavailable'} (${telemetry.category.label})
EUROPEAN AQI: ${telemetry.euAqi ?? 'Unavailable'} (${euInfo.label})
DOMINANT POLLUTANT: ${telemetry.dominantPollutant}
POLLUTANT READINGS:
${pollutantLines}
WEATHER & DISPERSION:
- Temperature: ${telemetry.weather.temperatureC !== null ? `${telemetry.weather.temperatureC} °C` : 'Unavailable'}
- Relative Humidity: ${telemetry.weather.relativeHumidityPct !== null ? `${telemetry.weather.relativeHumidityPct}%` : 'Unavailable'}
- Wind Speed: ${telemetry.weather.windSpeedKmh !== null ? `${telemetry.weather.windSpeedKmh} km/h` : 'Unavailable'}
- Atmospheric Inversion Risk: ${telemetry.weather.inversionRisk} (${telemetry.weather.inversionExplanation})
SELECTED HOUSEHOLD PROFILES: ${profiles.join(', ')}
`.trim();
}

export async function askAirWiseAssistant(params: {
  question: string;
  history: ChatTurn[];
  telemetry: AirQualityPayload;
  standard: AqiStandard;
  profiles: FamilyProfileId[];
}): Promise<AiStructuredAnswer> {
  const ai = getGeminiClient();
  if (!ai) {
    const err = new Error(
      'GEMINI_API_KEY is not configured on the server. Please add a valid key in Settings > Secrets.',
    );
    (err as Error & { statusCode?: number }).statusCode = 503;
    throw err;
  }

  const contextBlock = formatTelemetryContext(params.telemetry, params.standard, params.profiles);

  const conversationSnippet = params.history
    .slice(-6)
    .map((t) => `${t.role === 'user' ? 'User' : 'AIRWISE AI'}: ${t.content}`)
    .join('\n');

  const systemInstruction = `
You are AIRWISE AI, a senior environmental health & urban air quality advisor.
Follow these strict scientific, safety, and honesty requirements:
1. Understand the user's exact intent and tailor guidance to the provided location telemetry and household profiles (${params.profiles.join(', ')}).
2. Ground your answer in the verified telemetry provided below. If dataStatus is "unavailable-sample", you MUST explicitly state that live station telemetry is currently unavailable and avoid presenting sample numbers as real-time conditions.
3. Explain WHY each recommendation matters (e.g., particle size reaching alveoli, traffic NO2 peaks near roads, temperature inversions trapping winter smog).
4. Provide practical, concrete step-by-step actions.
5. Explicitly separate verified local measurements from general environmental guidance, and admit uncertainty whenever any pollutant or micro-local reading (like street-level traffic vs neighborhood monitor) is unavailable.
6. NEVER diagnose diseases, prescribe medication, or make unsupported medical claims. Always remind users that environmental guidance does not replace professional medical advice.
7. Keep responses concise, clear, and free of hype or fabricated statistics.
`.trim();

  const userPrompt = `
CURRENT ENVIRONMENTAL CONTEXT:
${contextBlock}

${conversationSnippet ? `RECENT CONVERSATION:\n${conversationSnippet}\n` : ''}
USER QUESTION:
${params.question}
`.trim();

  let rawText = '';
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description:
                  'Clear 2-4 sentence direct answer tailored to the user question, city telemetry, and family profiles.',
              },
              intentDetected: {
                type: Type.STRING,
                description:
                  'Short label of the user intent (e.g., Outdoor Exercise Safety, Child Protection, Indoor Ventilation, Commute Choice).',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    action: { type: Type.STRING },
                    whyItMatters: { type: Type.STRING },
                  },
                  required: ['title', 'action', 'whyItMatters'],
                },
              },
              dataBasis: {
                type: Type.OBJECT,
                properties: {
                  verifiedMeasurementsUsed: { type: Type.STRING },
                  generalGuidanceUsed: { type: Type.STRING },
                  uncertaintyNote: { type: Type.STRING },
                },
                required: ['verifiedMeasurementsUsed', 'generalGuidanceUsed', 'uncertaintyNote'],
              },
              cautionNote: {
                type: Type.STRING,
                description: 'Clear non-medical-advice boundary and safety reminder.',
              },
              followUpQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              'summary',
              'intentDetected',
              'recommendations',
              'dataBasis',
              'cautionNote',
              'followUpQuestions',
            ],
          },
        },
      });
      rawText = (response.text ?? '').trim();
      break;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : '';
      const isTransient =
        msg.includes('503') || msg.includes('500') || msg.includes('UNAVAILABLE') || msg.includes('fetch');
      if (!isTransient || attempt === 1) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  if (!rawText) {
    throw lastError instanceof Error
      ? lastError
      : new Error('AI assistant returned an empty response.');
  }

  const parsed = JSON.parse(rawText) as Omit<AiStructuredAnswer, 'modelUsed' | 'generatedAt'>;
  return {
    ...parsed,
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 5) : [],
    followUpQuestions: Array.isArray(parsed.followUpQuestions)
      ? parsed.followUpQuestions.slice(0, 3)
      : [],
    modelUsed: 'gemini-4-hydrogen',
    generatedAt: new Date().toISOString(),
  };
}

export function buildDeterministicRoutine(params: {
  telemetry: AirQualityPayload;
  profiles: FamilyProfileId[];
  commuteDistanceKm: number | null;
  commuteMode: 'walk-cycle' | 'public-bus' | 'rail-metro';
  hasGasStove: boolean;
}): RoutinePlanResponse {
  const aqi = params.telemetry.usAqi ?? 50;
  const pm25 = params.telemetry.pollutants.find((p) => p.key === 'pm25')?.value ?? null;
  const highPollution = aqi > 100;
  const severePollution = aqi > 150;
  const hasSensitive =
    params.profiles.includes('children') ||
    params.profiles.includes('older-adults') ||
    params.profiles.includes('respiratory');

  const commuteMath = calculateCommuteSavingsKg(params.commuteDistanceKm, params.commuteMode);

  const morningModeAction = severePollution
    ? {
        title: 'Choose Enclosed Transit Over Strenuous Outdoor Cycling',
        whatToDo:
          params.commuteMode === 'rail-metro' || params.commuteMode === 'public-bus'
            ? 'Take metro/rail or electric bus instead of driving alone, and wear a well-fitting N95/FFP2 respirator while walking to the station.'
            : 'Because current AQI exceeds 150, pause high-exertion cycling and switch to public transit or carpooling with cabin recirculation on.',
        whyItMatters:
          'Heavy breathing during cycling increases inhaled PM2.5 dose multiple times above resting rates; enclosed transit reduces personal car tailpipe emissions without forcing deep respiratory intake in smog.',
        environmentalBenefit:
          'Avoids single-occupancy vehicle tailpipe NOx, CO, and brake/tire particulate emissions.',
        practicalImplementation:
          'Leave 10 minutes earlier for transit boarding and keep cabin air on recirculate if sharing a vehicle.',
        limitations:
          'During AQI > 150, active cycling safety is outweighed by respiratory particle exposure; prioritize exposure protection.',
        estimatedCo2SavedKg:
          params.commuteMode === 'walk-cycle' ? null : commuteMath.savedKg,
        co2CalculationNote:
          params.commuteMode === 'walk-cycle'
            ? 'Cycling savings omitted because current AQI (>150) recommends avoiding strenuous outdoor cycling.'
            : commuteMath.note,
      }
    : {
        title:
          params.commuteMode === 'walk-cycle'
            ? 'Walk or Cycle Along Low-Traffic Green Corridors'
            : 'Commute via Public Transit Instead of Short Solo Car Trips',
        whatToDo:
          params.commuteMode === 'walk-cycle'
            ? 'Use side streets or park paths separated by at least one block from arterial traffic for your morning trip.'
            : 'Take rail, metro, or bus and walk the final stretch on quieter residential sidewalks.',
        whyItMatters:
          'Vehicle cold-starts produce disproportionately high hydrocarbons and NO2 during the first few kilometers; moving 50–100m away from heavy lanes sharply cuts ultrafine particle exposure.',
        environmentalBenefit:
          'Eliminates cold-start exhaust and cuts per-passenger road emissions.',
        practicalImplementation:
          'Combine morning drop-offs or coffee stops along a single walking/transit route.',
        limitations:
          highPollution || hasSensitive
            ? 'Keep pace moderate if AQI is 101–150 or if commuting with children/sensitive lungs.'
            : 'Check local sidewalk safety, weather, and helmet/visibility gear before riding.',
        estimatedCo2SavedKg: commuteMath.savedKg,
        co2CalculationNote: commuteMath.note,
      };

  const actions: RoutineActionItem[] = [
    {
      period: 'Morning',
      ...morningModeAction,
    },
    {
      period: 'Afternoon',
      title: 'Batch Errands & Eliminate Vehicle Idling',
      whatToDo:
        'Consolidate school, grocery, and parcel trips into a single continuous loop and turn off engines whenever parked for more than 10 seconds.',
      whyItMatters:
        'Hot-engine restarts use less fuel and emit far less pollution than idling for 30+ seconds, while trip chaining prevents repeated cold-starts.',
      environmentalBenefit:
        'Reduces localized NO2 hotspots around school gates, clinics, and shopping streets.',
      practicalImplementation:
        'Keep a shared household errand list and use a brief 10-minute afternoon window to ventilate indoor rooms ONLY if outdoor AQI is below 100 and wind > 8 km/h.',
      limitations:
        'Exact fuel/carbon reduction varies by vehicle engine type and traffic wait time; no unverified numerical savings are assumed.',
      estimatedCo2SavedKg: null,
      co2CalculationNote:
        'Depends on individual engine idling duration and route length (not estimated without measured idling minutes).',
    },
    {
      period: 'Evening',
      title: params.hasGasStove
        ? 'Ventilate Cooking Emissions & Cut Standby Energy Waste'
        : 'Low-Smoke Meal Prep & Overnight Air Protection',
      whatToDo:
        'Run your range hood vented outdoors on medium/high while cooking (especially frying/sautéing), cook on back burners, and power down unused appliances overnight.',
      whyItMatters:
        'Cooking generates sharp indoor PM2.5 spikes—and gas burners add NO2—while residential electricity and heating demand contribute to regional winter smog precursors.',
      environmentalBenefit:
        'Lowers peak evening residential electricity load and reduces indoor combustion pollutants.',
      practicalImplementation:
        highPollution || (pm25 !== null && pm25 > 35)
          ? 'Keep windows closed overnight due to elevated outdoor PM2.5 and run a HEPA purifier in bedrooms on a quiet sleep setting.'
          : 'Crack opposite windows briefly after sunset traffic subsides if outdoor AQI remains ≤ 50, then close before midnight cooling.',
      limitations:
        'Recirculating microwave hoods do not vent NO2 outdoors; opening a nearby window slightly is needed when outdoor air is cleaner than kitchen air.',
      estimatedCo2SavedKg: null,
      co2CalculationNote:
        'Household electricity emissions vary by regional grid carbon intensity (not estimated without kWh meter data).',
    },
  ];

  const totalEstimatedCo2SavedKg = actions.reduce<number | null>((acc, item) => {
    if (item.estimatedCo2SavedKg === null) return acc;
    return Number(((acc ?? 0) + item.estimatedCo2SavedKg).toFixed(2));
  }, null);

  return {
    locationName: `${params.telemetry.location.name}, ${params.telemetry.location.country}`,
    aqiContext: `US AQI ${params.telemetry.usAqi ?? 'N/A'} (${params.telemetry.category.label}) · ${params.telemetry.dataStatus}`,
    actions,
    totalEstimatedCo2SavedKg,
    emissionFactorCitation:
      'UK DEFRA 2024 Greenhouse Gas Conversion Factors (Passenger Car 0.171 kg CO₂e/km, Bus 0.102 kg CO₂e/km, Rail 0.035 kg CO₂e/km). Only computed when trip distance is explicitly supplied.',
    generatedBy: 'deterministic',
  };
}
