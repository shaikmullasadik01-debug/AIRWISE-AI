import assert from 'node:assert/strict';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import { createApp } from '../server.ts';
import {
  buildHealthPrecautions,
  calculateCommuteSavingsKg,
  calculateUsAqiFromPm25,
  classifyUsAqi,
  computeInversionRisk,
  findBestOutdoorWindow,
} from '../server/aqi.ts';
import { buildUnavailableFallbackPayload } from '../server/airQualityService.ts';
import { buildDeterministicRoutine } from '../server/geminiService.ts';
import {
  sanitizeFamilyProfiles,
  sanitizePlainText,
  sanitizeSearchQuery,
  validateCoordinates,
} from '../server/security.ts';
import {
  buildFamilySafetyGuidance,
  computeIndoorAdvisory,
  evaluatePollutionAlerts,
} from '../src/utils/airQualityHelpers.ts';

describe('AQI & Environmental Calculations (Unit Tests)', () => {
  it('computes US EPA 2024 PM2.5 AQI breakpoints and edge cases accurately', () => {
    assert.equal(calculateUsAqiFromPm25(0), 0);
    assert.equal(calculateUsAqiFromPm25(9.0), 50);
    assert.equal(calculateUsAqiFromPm25(9.1), 51);
    assert.equal(calculateUsAqiFromPm25(35.4), 100);
    assert.equal(calculateUsAqiFromPm25(55.4), 150);
    assert.equal(calculateUsAqiFromPm25(650), 500);
    assert.equal(calculateUsAqiFromPm25(null), null);
    assert.equal(calculateUsAqiFromPm25(-5), null);
    assert.equal(calculateUsAqiFromPm25(Number.NaN), null);
    assert.equal(calculateUsAqiFromPm25(Number.POSITIVE_INFINITY), null);
  });

  it('classifies AQI categories with non-empty summaries and ranges', () => {
    assert.equal(classifyUsAqi(32).level, 'good');
    assert.equal(classifyUsAqi(78).level, 'moderate');
    assert.equal(classifyUsAqi(125).level, 'sensitive');
    assert.equal(classifyUsAqi(175).level, 'unhealthy');
    assert.equal(classifyUsAqi(245).level, 'very-unhealthy');
    assert.equal(classifyUsAqi(350).level, 'hazardous');
    assert.equal(classifyUsAqi(null).level, 'unknown');
  });

  it('evaluates winter inversion risk from wind, temperature, and humidity', () => {
    const elevated = computeInversionRisk(4, 85, 5, 42);
    assert.equal(elevated.risk, 'elevated');

    const low = computeInversionRisk(22, 45, 20, 8);
    assert.equal(low.risk, 'low');

    const unknown = computeInversionRisk(null, null, null, null);
    assert.equal(unknown.risk, 'unknown');
  });

  it('finds cleanest 3-hour forecast window and handles sparse series gracefully', () => {
    assert.equal(findBestOutdoorWindow([]), null);

    const best = findBestOutdoorWindow([
      { timestamp: '2026-11-17T08:00', isForecast: true, usAqi: 140, euAqi: 70, pm25: 50, pm10: 80, no2: 40, o3: 20 },
      { timestamp: '2026-11-17T09:00', isForecast: true, usAqi: 130, euAqi: 65, pm25: 46, pm10: 75, no2: 35, o3: 25 },
      { timestamp: '2026-11-17T10:00', isForecast: true, usAqi: 120, euAqi: 60, pm25: 42, pm10: 70, no2: 30, o3: 30 },
      { timestamp: '2026-11-17T14:00', isForecast: true, usAqi: 62, euAqi: 30, pm25: 14, pm10: 28, no2: 18, o3: 45 },
      { timestamp: '2026-11-17T15:00', isForecast: true, usAqi: 58, euAqi: 28, pm25: 12, pm10: 25, no2: 16, o3: 48 },
      { timestamp: '2026-11-17T16:00', isForecast: true, usAqi: 64, euAqi: 31, pm25: 15, pm10: 27, no2: 19, o3: 44 },
    ]);
    assert.ok(best !== null);
    assert.equal(best.windowLabel, '14:00 – 16:00');
    assert.equal(best.avgUsAqi, 61);
  });

  it('never invents CO2 savings when commute distance is absent', () => {
    const missing = calculateCommuteSavingsKg(null, 'walk-cycle');
    assert.equal(missing.savedKg, null);

    const zero = calculateCommuteSavingsKg(0, 'public-bus');
    assert.equal(zero.savedKg, null);

    const valid = calculateCommuteSavingsKg(10, 'walk-cycle');
    assert.equal(valid.savedKg, 1.71);
  });

  it('generates severe precautions when AQI is elevated', () => {
    const tips = buildHealthPrecautions(185, 78);
    assert.ok(tips.length >= 3);
    assert.ok(tips.some((t) => t.includes('N95')));
  });
});

describe('Security, Input Sanitization & Privacy Controls', () => {
  it('strips HTML tags and control characters from user text', () => {
    const cleaned = sanitizePlainText('<script>alert(1)</script> Hello\u0000 world  ', 100);
    assert.equal(cleaned, 'alert(1) Hello world');
  });

  it('restricts city search queries to safe geographic characters', () => {
    const safe = sanitizeSearchQuery('San Francisco; DROP TABLE cities;--');
    assert.equal(safe, 'San Francisco DROP TABLE cities--');
  });

  it('validates missing and out-of-range coordinates and rounds to ~1km precision', () => {
    const missing = validateCoordinates('', undefined);
    assert.equal(missing.ok, false);

    const ok = validateCoordinates('37.774929', '-122.419416');
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.latitude, 37.77);
      assert.equal(ok.longitude, -122.42);
    }

    assert.equal(validateCoordinates(95, 10).ok, false);
    assert.equal(validateCoordinates(10, -190).ok, false);
    assert.equal(validateCoordinates('abc', '10').ok, false);
  });

  it('whitelists valid family profiles and falls back safely', () => {
    assert.deepEqual(sanitizeFamilyProfiles(['children', 'invalid-role', 'children']), [
      'children',
    ]);
    assert.deepEqual(sanitizeFamilyProfiles('not-an-array'), ['adults']);
  });
});

describe('Family Safety, Indoor Advisor, Winter Smog Routine & Alert Engine', () => {
  const samplePayload = buildUnavailableFallbackPayload(
    {
      id: 'test-city',
      name: 'Test Metro',
      country: 'Testland',
      latitude: 40.71,
      longitude: -74.0,
      timezone: 'UTC',
      recommendedStandard: 'us-epa',
    },
    'Unit test fixture',
  );

  it('generates tailored guidance across all 7 household profiles', () => {
    const guidance = buildFamilySafetyGuidance(samplePayload, [
      'adults',
      'children',
      'older-adults',
      'respiratory',
      'outdoor-workers',
      'students',
      'athletes',
    ]);
    assert.equal(guidance.length, 7);
    assert.ok(guidance.every((g) => g.items.length >= 2));
  });

  it('computes bounded HEPA CADR sizing and detects overdue HEPA filters', () => {
    const small = computeIndoorAdvisory(samplePayload, 1, '');
    assert.equal(small.recommendedCadrM3h, Math.round(5 * 11.5));

    const overdue = computeIndoorAdvisory(samplePayload, 30, '2020-01-01');
    assert.equal(overdue.filterDaysRemaining, 0);
    assert.ok(overdue.filterStatusText.includes('replacement due'));
  });

  it('advises against strenuous cycling during severe winter smog (AQI > 150)', () => {
    const severeSmogPayload = {
      ...samplePayload,
      dataStatus: 'live-model' as const,
      usAqi: 185,
    };
    const plan = buildDeterministicRoutine({
      telemetry: severeSmogPayload,
      profiles: ['adults', 'children'],
      commuteDistanceKm: 8,
      commuteMode: 'walk-cycle',
      hasGasStove: true,
    });
    assert.ok(plan.actions[0].whatToDo.includes('150'));
    assert.equal(plan.actions[0].estimatedCo2SavedKg, null);
  });

  it('suppresses false alerts when dataStatus is unavailable-sample', () => {
    const alerts = evaluatePollutionAlerts(
      samplePayload,
      {
        enabledLevels: { moderate: true, poor: true, severe: true, hazardous: true },
        browserNotificationsEnabled: false,
      },
      ['children'],
    );
    assert.equal(alerts.length, 0);
  });

  it('builds 4-part alerts on live telemetry when threshold is met', () => {
    const liveElevated = {
      ...samplePayload,
      dataStatus: 'live-model' as const,
      usAqi: 135,
    };
    const alerts = evaluatePollutionAlerts(
      liveElevated,
      {
        enabledLevels: { moderate: false, poor: true, severe: true, hazardous: true },
        browserNotificationsEnabled: false,
      },
      ['children', 'respiratory'],
    );
    assert.equal(alerts.length, 1);
    assert.ok(alerts[0].whatChanged.includes('135'));
    assert.ok(alerts[0].whyItMatters.length > 10);
    assert.ok(alerts[0].whoNeedsPrecautions.includes('Children'));
    assert.ok(alerts[0].practicalAction.length > 10);
  });
});

describe('Express API Integration, Error Handling, Rate Limiting & Security Headers', () => {
  let server: http.Server;
  let baseUrl: string;
  let originalGeminiKey: string | undefined;

  before(async () => {
    originalGeminiKey = process.env.GEMINI_API_KEY;
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    if (originalGeminiKey !== undefined) {
      process.env.GEMINI_API_KEY = originalGeminiKey;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns security headers and health status on GET /api/health', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.equal(res.headers.get('x-dns-prefetch-control'), 'off');
    assert.equal(res.headers.get('x-powered-by'), null);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = (await res.json()) as { status: string; service: string };
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'airwise-ai');
  });

  it('rejects malformed JSON bodies cleanly with HTTP 400 and no stack trace', async () => {
    const res = await fetch(`${baseUrl}/api/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"question": invalid-json',
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, 'Invalid JSON request body.');
  });

  it('rejects missing or out-of-range coordinates with HTTP 400 on GET /api/air-quality', async () => {
    const missingRes = await fetch(`${baseUrl}/api/air-quality`);
    assert.equal(missingRes.status, 400);

    const badRes = await fetch(`${baseUrl}/api/air-quality?lat=120&lon=10`);
    assert.equal(badRes.status, 400);
    const body = (await badRes.json()) as { error: string };
    assert.ok(body.error.includes('bounds'));
  });

  it('honestly marks unavailable-sample mode when simulateOutage=1', async () => {
    const res = await fetch(
      `${baseUrl}/api/air-quality?lat=37.77&lon=-122.42&name=San%20Francisco&simulateOutage=1`,
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = (await res.json()) as {
      dataStatus: string;
      sourceAttribution: string;
      bestOutdoorWindow: { windowLabel: string } | null;
    };
    assert.equal(body.dataStatus, 'unavailable-sample');
    assert.ok(body.sourceAttribution.includes('Not Live Telemetry'));
    assert.ok(body.bestOutdoorWindow !== null);
  });

  it('validates AI prompts, enforces missing-key errors, and enforces rate limits', async () => {
    const badRes = await fetch(`${baseUrl}/api/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'hi', location: { latitude: 37.77, longitude: -122.42 } }),
    });
    assert.equal(badRes.status, 400);

    process.env.GEMINI_API_KEY = '';
    const noKeyRes = await fetch(`${baseUrl}/api/ai/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Is it safe to walk outside today?',
        location: { name: 'London', country: 'UK', latitude: 51.51, longitude: -0.13 },
        profiles: ['children'],
      }),
    });
    assert.equal(noKeyRes.status, 503);
    const noKeyBody = (await noKeyRes.json()) as { error: string };
    assert.ok(noKeyBody.error.includes('Secrets'));

    // Verify AI rate limiter returns 429 after 20 requests/min from distinct test header IP
    let hit429 = false;
    for (let i = 0; i < 22; i += 1) {
      const r = await fetch(`${baseUrl}/api/ai/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.99',
        },
        body: JSON.stringify({ question: 'hi', location: { latitude: 37.77, longitude: -122.42 } }),
      });
      if (r.status === 429) {
        hit429 = true;
        assert.ok(r.headers.get('retry-after') !== null);
        break;
      }
    }
    assert.equal(hit429, true);
  });

  it('generates Morning, Afternoon, and Evening routine with transparent CO2 math', async () => {
    const resNoDist = await fetch(`${baseUrl}/api/routine/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { name: 'San Francisco', country: 'US', latitude: 37.77, longitude: -122.42 },
        profiles: ['adults', 'children'],
        commuteMode: 'walk-cycle',
        simulateOutage: true,
      }),
    });
    assert.equal(resNoDist.status, 200);
    const planNoDist = (await resNoDist.json()) as {
      actions: Array<{ period: string }>;
      totalEstimatedCo2SavedKg: number | null;
    };
    assert.equal(planNoDist.actions.length, 3);
    assert.equal(planNoDist.totalEstimatedCo2SavedKg, null);

    const resWithDist = await fetch(`${baseUrl}/api/routine/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { name: 'San Francisco', country: 'US', latitude: 37.77, longitude: -122.42 },
        profiles: ['adults'],
        commuteMode: 'rail-metro',
        commuteDistanceKm: 10,
        simulateOutage: true,
      }),
    });
    assert.equal(resWithDist.status, 200);
    const planWithDist = (await resWithDist.json()) as {
      totalEstimatedCo2SavedKg: number | null;
    };
    assert.equal(planWithDist.totalEstimatedCo2SavedKg, 1.36);
  });
});
