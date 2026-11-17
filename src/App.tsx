import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Menu, X } from 'lucide-react';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LocationBar } from './components/LocationBar';
import type {
  AirQualityPayload,
  AlertPreferences,
  AppSectionId,
  AqiStandard,
  ChatMessageItem,
  CityLocation,
  CompletedActionRecord,
  FamilyProfileId,
} from './types/airwise';
import { evaluatePollutionAlerts } from './utils/airQualityHelpers';

const AssistantView = lazy(() =>
  import('./components/AssistantView').then((m) => ({ default: m.AssistantView })),
);
const FamilyIndoorView = lazy(() =>
  import('./components/FamilyIndoorView').then((m) => ({ default: m.FamilyIndoorView })),
);
const RoutinePlannerView = lazy(() =>
  import('./components/RoutinePlannerView').then((m) => ({ default: m.RoutinePlannerView })),
);
const EducationView = lazy(() =>
  import('./components/EducationView').then((m) => ({ default: m.EducationView })),
);
const AlertsModal = lazy(() =>
  import('./components/AlertsModal').then((m) => ({ default: m.AlertsModal })),
);

const DEFAULT_CITY: CityLocation = {
  id: 'san-francisco',
  name: 'San Francisco',
  region: 'California',
  country: 'United States',
  latitude: 37.77,
  longitude: -122.42,
  timezone: 'America/Los_Angeles',
  recommendedStandard: 'us-epa',
};

const DEFAULT_ALERTS: AlertPreferences = {
  enabledLevels: {
    moderate: false,
    poor: true,
    severe: true,
    hazardous: true,
  },
  browserNotificationsEnabled: false,
};

const NAV_ITEMS: Array<{ id: AppSectionId; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'assistant', label: 'AI Advisor' },
  { id: 'family-indoor', label: 'Family & Indoor' },
  { id: 'routine', label: 'Daily Routine' },
  { id: 'education', label: 'Education' },
];

function readStorage<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function ViewLoadingFallback() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading module"
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="h-6 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="h-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-950" />
    </div>
  );
}

export default function App() {
  const [section, setSection] = useState<AppSectionId>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    readStorage<'light' | 'dark'>('airwise_theme', 'light'),
  );
  const [activeLocation, setActiveLocation] = useState<CityLocation>(() =>
    readStorage<CityLocation>('airwise_location', DEFAULT_CITY),
  );
  const [standard, setStandard] = useState<AqiStandard>(() =>
    readStorage<AqiStandard>('airwise_standard', 'us-epa'),
  );
  const [selectedProfiles, setSelectedProfiles] = useState<FamilyProfileId[]>(() =>
    readStorage<FamilyProfileId[]>('airwise_profiles', ['adults', 'children']),
  );
  const [alertPrefs, setAlertPrefs] = useState<AlertPreferences>(() =>
    readStorage<AlertPreferences>('airwise_alerts', DEFAULT_ALERTS),
  );
  const [checkedChecklistIds, setCheckedChecklistIds] = useState<string[]>(() =>
    readStorage<string[]>('airwise_indoor_checklist', []),
  );
  const [completedActions, setCompletedActions] = useState<CompletedActionRecord[]>(() =>
    readStorage<CompletedActionRecord[]>('airwise_completed_actions', []),
  );
  const [chatMessages, setChatMessages] = useState<ChatMessageItem[]>(() =>
    readStorage<ChatMessageItem[]>('airwise_chat_history', []),
  );

  const [presetCities, setPresetCities] = useState<CityLocation[]>([DEFAULT_CITY]);
  const [telemetry, setTelemetry] = useState<AirQualityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geoStatusMessage, setGeoStatusMessage] = useState<string | null>(null);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [simulateOutage, setSimulateOutage] = useState(false);
  const [prefillQuestion, setPrefillQuestion] = useState<string | null>(null);

  const alertsTriggerRef = useRef<HTMLButtonElement>(null);
  const telemetryAbortRef = useRef<AbortController | null>(null);

  // Sync dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('airwise_theme', JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('airwise_location', JSON.stringify(activeLocation));
  }, [activeLocation]);

  useEffect(() => {
    localStorage.setItem('airwise_standard', JSON.stringify(standard));
  }, [standard]);

  useEffect(() => {
    localStorage.setItem('airwise_profiles', JSON.stringify(selectedProfiles));
  }, [selectedProfiles]);

  useEffect(() => {
    localStorage.setItem('airwise_alerts', JSON.stringify(alertPrefs));
  }, [alertPrefs]);

  useEffect(() => {
    localStorage.setItem('airwise_indoor_checklist', JSON.stringify(checkedChecklistIds));
  }, [checkedChecklistIds]);

  useEffect(() => {
    localStorage.setItem('airwise_completed_actions', JSON.stringify(completedActions));
  }, [completedActions]);

  useEffect(() => {
    localStorage.setItem('airwise_chat_history', JSON.stringify(chatMessages.slice(-20)));
  }, [chatMessages]);

  // Load curated preset cities once
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/cities', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.results && Array.isArray(data.results)) {
          setPresetCities(data.results);
        }
      })
      .catch(() => {
        // Keep DEFAULT_CITY preset gracefully
      });
    return () => controller.abort();
  }, []);

  const loadTelemetry = useCallback(
    async (loc: CityLocation, opts?: { refresh?: boolean; outage?: boolean }) => {
      telemetryAbortRef.current?.abort();
      const controller = new AbortController();
      telemetryAbortRef.current = controller;

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          lat: String(loc.latitude),
          lon: String(loc.longitude),
          name: loc.name,
          country: loc.country,
          timezone: loc.timezone,
          standard: loc.recommendedStandard,
        });
        if (loc.region) params.set('region', loc.region);
        if (opts?.refresh) params.set('refresh', '1');
        if (opts?.outage) params.set('simulateOutage', '1');

        const res = await fetch(`/api/air-quality?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load telemetry');
        }
        setTelemetry(data as AirQualityPayload);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Unable to fetch air quality telemetry.');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    loadTelemetry(activeLocation, { outage: simulateOutage });
    return () => telemetryAbortRef.current?.abort();
  }, [activeLocation, simulateOutage, loadTelemetry]);

  const activeAlerts = useMemo(() => {
    if (!telemetry) return [];
    return evaluatePollutionAlerts(telemetry, alertPrefs, selectedProfiles);
  }, [telemetry, alertPrefs, selectedProfiles]);

  // Trigger optional browser Notification API if explicitly enabled by user
  useEffect(() => {
    if (
      alertPrefs.browserNotificationsEnabled &&
      activeAlerts.length > 0 &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      const top = activeAlerts[0];
      try {
        new Notification(`AIRWISE AI: ${top.title}`, {
          body: `${top.whatChanged} ${top.practicalAction}`,
        });
      } catch {
        // Ignore blocked browser notification constructors
      }
    }
  }, [activeAlerts, alertPrefs.browserNotificationsEnabled]);

  function handleSelectLocation(city: CityLocation) {
    setGeoStatusMessage(null);
    setActiveLocation(city);
    setStandard(city.recommendedStandard);
  }

  function handleRequestGeolocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatusMessage(
        'Browser geolocation is unavailable on this device. Search or choose any city manually above.',
      );
      return;
    }

    setGeoStatusMessage('Requesting coarse location permission…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 100) / 100;
        const lon = Math.round(pos.coords.longitude * 100) / 100;
        setGeoStatusMessage(
          `Using privacy-rounded regional coordinates (${lat.toFixed(2)}°, ${lon.toFixed(2)}°).`,
        );
        setActiveLocation({
          id: `geo-${lat}-${lon}`,
          name: 'Local Area',
          country: 'Detected Region',
          latitude: lat,
          longitude: lon,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          recommendedStandard: standard,
        });
      },
      (geoErr) => {
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setGeoStatusMessage(
            'Location permission was declined. AIRWISE AI remains fully functional—select or search any city above.',
          );
        } else {
          setGeoStatusMessage(
            'Could not determine device location right now. Use city search to continue.',
          );
        }
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300_000 },
    );
  }

  function handleToggleProfile(id: FamilyProfileId) {
    setSelectedProfiles((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((item) => item !== id) : prev;
      }
      return [...prev, id];
    });
  }

  function handleToggleChecklistItem(id: string, title: string) {
    setCheckedChecklistIds((prev) => {
      const exists = prev.includes(id);
      if (!exists) {
        const today = new Date().toISOString().slice(0, 10);
        setCompletedActions((actions) => {
          if (actions.some((a) => a.id === `indoor-${today}-${id}`)) return actions;
          return [
            ...actions,
            {
              id: `indoor-${today}-${id}`,
              date: today,
              title: `Indoor: ${title}`,
              category: 'indoor',
              estimatedCo2SavedKg: null,
            },
          ];
        });
        return [...prev, id];
      }
      return prev.filter((item) => item !== id);
    });
  }

  function handleCloseAlertsModal() {
    setAlertsModalOpen(false);
    setTimeout(() => alertsTriggerRef.current?.focus(), 0);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-sky-700 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>

      {/* Screen-reader announcement for city/AQI updates */}
      <div className="sr-only" aria-live="polite">
        {telemetry && !loading
          ? `Loaded ${telemetry.location.name} air quality: US AQI ${telemetry.usAqi ?? 'unavailable'}, ${telemetry.category.label}.`
          : ''}
      </div>

      {/* Clean 3-Zone Top Bar */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setSection('dashboard')}
            className="font-display whitespace-nowrap shrink-0 text-left text-lg font-bold tracking-tight text-sky-800 dark:text-sky-300"
          >
            AIRWISE AI
          </button>

          {/* Zone 2: 5 Single-Line Navigation Links */}
          <nav aria-label="Primary navigation" className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap shrink-0 border-b-2 py-1 text-sm font-medium transition-colors ${
                    active
                      ? 'border-sky-700 text-slate-900 dark:border-sky-400 dark:text-white'
                      : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              ref={alertsTriggerRef}
              type="button"
              onClick={() => setAlertsModalOpen(true)}
              className="inline-flex h-9 items-center gap-2 whitespace-nowrap shrink-0 rounded-lg bg-sky-700 px-3.5 text-xs font-medium text-white transition-colors hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500"
            >
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Alerts{activeAlerts.length > 0 ? ` (${activeAlerts.length})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-expanded={mobileNavOpen}
              aria-label="Toggle navigation menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden dark:border-slate-700 dark:text-slate-200"
            >
              {mobileNavOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileNavOpen && (
          <nav
            aria-label="Mobile navigation"
            className="border-t border-slate-100 bg-white px-4 py-2 md:hidden dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSection(item.id);
                      setMobileNavOpen(false);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-lg px-3 py-2 text-left text-sm font-medium ${
                      active
                        ? 'bg-sky-50 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      {/* Workspace Location & Telemetry Controls */}
      <LocationBar
        activeLocation={activeLocation}
        presetCities={presetCities}
        standard={standard}
        theme={theme}
        loading={loading}
        geoStatusMessage={geoStatusMessage}
        onSelectLocation={handleSelectLocation}
        onRequestGeolocation={handleRequestGeolocation}
        onChangeStandard={setStandard}
        onRefresh={() => loadTelemetry(activeLocation, { refresh: true, outage: simulateOutage })}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      {/* Main Content Stage */}
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <ErrorBoundary onReset={() => setSection('dashboard')}>
          {section === 'dashboard' && (
            <DashboardView
              telemetry={telemetry}
              loading={loading}
              error={error}
              standard={standard}
              activeAlerts={activeAlerts}
              completedActions={completedActions}
              onRetry={() =>
                loadTelemetry(activeLocation, { refresh: true, outage: simulateOutage })
              }
              onNavigateToAssistant={(q) => {
                if (q) setPrefillQuestion(q);
                setSection('assistant');
              }}
              onNavigateToFamily={() => setSection('family-indoor')}
            />
          )}

          <Suspense fallback={<ViewLoadingFallback />}>
            {section === 'assistant' && (
              <AssistantView
                telemetry={telemetry}
                standard={standard}
                profiles={selectedProfiles}
                messages={chatMessages}
                prefillQuestion={prefillQuestion}
                onClearPrefill={() => setPrefillQuestion(null)}
                onAddMessage={(msg) => setChatMessages((prev) => [...prev, msg])}
                onClearHistory={() => setChatMessages([])}
              />
            )}

            {section === 'family-indoor' && (
              <FamilyIndoorView
                telemetry={telemetry}
                selectedProfiles={selectedProfiles}
                onToggleProfile={handleToggleProfile}
                checkedChecklistIds={checkedChecklistIds}
                onToggleChecklistItem={handleToggleChecklistItem}
              />
            )}

            {section === 'routine' && (
              <RoutinePlannerView
                telemetry={telemetry}
                profiles={selectedProfiles}
                completedActions={completedActions}
                onLogCompletedAction={(rec) =>
                  setCompletedActions((prev) =>
                    prev.some((a) => a.id === rec.id) ? prev : [...prev, rec],
                  )
                }
              />
            )}

            {section === 'education' && <EducationView />}
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-slate-400">
          <div>
            AIRWISE AI · Urban Air Quality Intelligence · Data via Open-Meteo (Copernicus CAMS) &amp; WHO 2021 / US EPA 2024 Reference Benchmarks
          </div>
          <div>
            Environmental decision support only — not a substitute for professional medical diagnosis or care.
          </div>
        </div>
      </footer>

      {alertsModalOpen && (
        <Suspense fallback={null}>
          <AlertsModal
            open={alertsModalOpen}
            onClose={handleCloseAlertsModal}
            prefs={alertPrefs}
            onChangePrefs={setAlertPrefs}
            activeAlerts={activeAlerts}
            telemetry={telemetry}
            simulateOutage={simulateOutage}
            onToggleSimulateOutage={() => setSimulateOutage((prev) => !prev)}
          />
        </Suspense>
      )}
    </div>
  );
}
