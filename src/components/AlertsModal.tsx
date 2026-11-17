import { useEffect, useRef } from 'react';
import { Bell, ShieldAlert, X } from 'lucide-react';
import type {
  AirQualityPayload,
  AlertPreferences,
  AlertSeverityLevel,
  TriggeredAlertItem,
} from '../types/airwise';

interface AlertsModalProps {
  open: boolean;
  onClose: () => void;
  prefs: AlertPreferences;
  onChangePrefs: (next: AlertPreferences) => void;
  activeAlerts: TriggeredAlertItem[];
  telemetry: AirQualityPayload | null;
  simulateOutage: boolean;
  onToggleSimulateOutage: () => void;
}

const ALERT_LEVEL_CONFIG: Array<{
  id: AlertSeverityLevel;
  label: string;
  range: string;
  description: string;
}> = [
  {
    id: 'moderate',
    label: 'Moderate Pollution Warning',
    range: 'US AQI 51–100',
    description: 'Notify when unusually sensitive individuals should monitor outdoor exertion.',
  },
  {
    id: 'poor',
    label: 'Poor Air-Quality Alert',
    range: 'US AQI 101–150',
    description: 'Alert when children, older adults, and sensitive lungs should limit outdoor time.',
  },
  {
    id: 'severe',
    label: 'Severe Pollution Alert',
    range: 'US AQI 151–200',
    description: 'Alert when everyone should reduce prolonged outdoor activity and run HEPA filters.',
  },
  {
    id: 'hazardous',
    label: 'Hazardous Pollution Alert',
    range: 'US AQI 201+',
    description: 'Emergency exposure notice recommending staying indoors in filtered air.',
  },
];

export function AlertsModal({
  open,
  onClose,
  prefs,
  onChangePrefs,
  activeAlerts,
  telemetry,
  simulateOutage,
  onToggleSimulateOutage,
}: AlertsModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  async function toggleBrowserNotifications() {
    if (prefs.browserNotificationsEnabled) {
      onChangePrefs({ ...prefs, browserNotificationsEnabled: false });
      return;
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        onChangePrefs({ ...prefs, browserNotificationsEnabled: true });
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alerts-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h2
              id="alerts-modal-title"
              className="font-display flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white"
            >
              <Bell className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span>Smart Pollution Alert Preferences</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Alerts are evaluated automatically during active sessions whenever you load or refresh telemetry for your selected city (no background server push daemon is claimed).
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close alert settings"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Threshold Toggles */}
        <div className="mt-4 space-y-2.5">
          {ALERT_LEVEL_CONFIG.map((cfg) => {
            const enabled = prefs.enabledLevels[cfg.id];
            return (
              <label
                key={cfg.id}
                className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {cfg.label}{' '}
                    <span className="font-mono text-xs font-normal text-slate-500 dark:text-slate-400">
                      ({cfg.range})
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                    {cfg.description}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) =>
                    onChangePrefs({
                      ...prefs,
                      enabledLevels: {
                        ...prefs.enabledLevels,
                        [cfg.id]: e.target.checked,
                      },
                    })
                  }
                  className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                />
              </label>
            );
          })}
        </div>

        {/* Optional Browser Notification Permission */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
          <div>
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              In-Browser Desktop Alert Banners
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Optional browser Notification API trigger when an active session detects an enabled threshold.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleBrowserNotifications}
            className="whitespace-nowrap shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {prefs.browserNotificationsEnabled ? 'Disable Browser Alerts' : 'Enable Browser Alerts'}
          </button>
        </div>

        {/* Live 4-Part Alert Preview */}
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Current Session Evaluation ({telemetry?.location.name ?? 'Selected City'})
          </h3>
          {activeAlerts.length === 0 ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              No enabled alert thresholds are currently triggered for {telemetry?.location.name ?? 'this city'} (US AQI {telemetry?.usAqi ?? '—'}).
            </p>
          ) : (
            <div className="mt-2 space-y-3">
              {activeAlerts.map((al) => (
                <div
                  key={al.level}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{al.title}</span>
                  </div>
                  <dl className="mt-2 space-y-1">
                    <div>
                      <dt className="inline font-semibold">1. What changed: </dt>
                      <dd className="inline">{al.whatChanged}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold">2. Why it matters: </dt>
                      <dd className="inline">{al.whyItMatters}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold">3. Who needs extra precautions: </dt>
                      <dd className="inline">{al.whoNeedsPrecautions}</dd>
                    </div>
                    <div>
                      <dt className="inline font-semibold">4. Practical action: </dt>
                      <dd className="inline">{al.practicalAction}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data Resilience Test Toggle */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs dark:border-slate-800">
          <div>
            <div className="font-semibold text-slate-800 dark:text-slate-200">
              API Outage Resilience Mode
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Test how AIRWISE AI clearly flags offline reference data if the upstream telemetry API goes down.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleSimulateOutage}
            aria-pressed={simulateOutage}
            className={`whitespace-nowrap shrink-0 rounded-lg border px-3 py-1.5 font-medium transition-colors ${
              simulateOutage
                ? 'border-amber-400 bg-amber-100 text-amber-950 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-100'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {simulateOutage ? 'Restore Live Telemetry' : 'Simulate API Outage'}
          </button>
        </div>
      </div>
    </div>
  );
}
