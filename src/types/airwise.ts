export type AqiStandard = 'us-epa' | 'eu-eaqi' | 'who-2021';

export type DataIntegrityStatus = 'live-model' | 'forecast' | 'unavailable-sample';

export type FamilyProfileId =
  | 'adults'
  | 'children'
  | 'older-adults'
  | 'respiratory'
  | 'outdoor-workers'
  | 'students'
  | 'athletes';

export type AlertSeverityLevel = 'moderate' | 'poor' | 'severe' | 'hazardous';

export type AppSectionId =
  | 'dashboard'
  | 'assistant'
  | 'family-indoor'
  | 'routine'
  | 'education';

export interface CityLocation {
  id: string;
  name: string;
  region?: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  recommendedStandard: AqiStandard;
}

export interface PollutantReading {
  key: 'pm25' | 'pm10' | 'no2' | 'so2' | 'co' | 'o3';
  label: string;
  formula: string;
  value: number | null;
  unit: string;
  whoGuideline24h?: number;
  whoGuideline8h?: number;
  whoExceedanceRatio: number | null;
}

export interface WeatherTelemetry {
  temperatureC: number | null;
  relativeHumidityPct: number | null;
  windSpeedKmh: number | null;
  surfacePressureHpa: number | null;
  inversionRisk: 'low' | 'moderate' | 'elevated' | 'unknown';
  inversionExplanation: string;
}

export interface HourlyAirQualityPoint {
  timestamp: string;
  isForecast: boolean;
  usAqi: number | null;
  euAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
}

export interface DailySummaryPoint {
  date: string;
  avgUsAqi: number | null;
  maxUsAqi: number | null;
  avgPm25: number | null;
  maxPm25: number | null;
  dominantCategory: string;
}

export interface OptimalOutdoorWindow {
  windowLabel: string;
  avgPm25: number | null;
  avgUsAqi: number | null;
  rationale: string;
}

export interface AqiCategoryInfo {
  level: 'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'very-unhealthy' | 'hazardous' | 'unknown';
  label: string;
  shortCode: string;
  summary: string;
  usAqiRange: string;
}

export interface AirQualityPayload {
  location: CityLocation;
  dataStatus: DataIntegrityStatus;
  dataStatusNotice: string;
  sourceAttribution: string;
  measurementTimestamp: string;
  fetchedAt: string;
  usAqi: number | null;
  euAqi: number | null;
  dominantPollutant: string;
  category: AqiCategoryInfo;
  pollutants: PollutantReading[];
  weather: WeatherTelemetry;
  hourlySeries: HourlyAirQualityPoint[];
  dailyComparison: DailySummaryPoint[];
  healthPrecautions: string[];
  bestOutdoorWindow: OptimalOutdoorWindow | null;
}

export interface AiRecommendationStep {
  title: string;
  action: string;
  whyItMatters: string;
}

export interface AiStructuredAnswer {
  summary: string;
  intentDetected: string;
  recommendations: AiRecommendationStep[];
  dataBasis: {
    verifiedMeasurementsUsed: string;
    generalGuidanceUsed: string;
    uncertaintyNote: string;
  };
  cautionNote: string;
  followUpQuestions: string[];
  modelUsed: string;
  generatedAt: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  structured?: AiStructuredAnswer;
  timestamp: string;
}

export interface AlertPreferences {
  enabledLevels: Record<AlertSeverityLevel, boolean>;
  browserNotificationsEnabled: boolean;
}

export interface TriggeredAlertItem {
  level: AlertSeverityLevel;
  title: string;
  whatChanged: string;
  whyItMatters: string;
  whoNeedsPrecautions: string;
  practicalAction: string;
}

export interface RoutineActionItem {
  period: 'Morning' | 'Afternoon' | 'Evening';
  title: string;
  whatToDo: string;
  whyItMatters: string;
  environmentalBenefit: string;
  practicalImplementation: string;
  limitations: string;
  estimatedCo2SavedKg: number | null;
  co2CalculationNote: string;
}

export interface RoutinePlanResponse {
  locationName: string;
  aqiContext: string;
  actions: RoutineActionItem[];
  totalEstimatedCo2SavedKg: number | null;
  emissionFactorCitation: string;
  generatedBy: 'deterministic' | 'gemini-enhanced';
}

export interface CompletedActionRecord {
  id: string;
  date: string;
  title: string;
  category: 'mobility' | 'indoor' | 'energy';
  estimatedCo2SavedKg: number | null;
}
