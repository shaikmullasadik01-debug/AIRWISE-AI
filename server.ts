import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  PRESET_CITIES,
  getAirQualityForLocation,
  searchCities,
} from './server/airQualityService.ts';
import { askAirWiseAssistant, buildDeterministicRoutine } from './server/geminiService.ts';
import {
  applySecurityHeaders,
  createRateLimiter,
  sanitizeFamilyProfiles,
  sanitizePlainText,
  sanitizeSearchQuery,
  validateCoordinates,
} from './server/security.ts';
import type { AqiStandard, ChatTurn, CityLocation } from './server/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(applySecurityHeaders);
  app.use(express.json({ limit: '64kb' }));

  const telemetryLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 60,
    keyPrefix: 'telemetry',
  });

  const aiLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 20,
    keyPrefix: 'ai',
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      status: 'ok',
      service: 'airwise-ai',
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
      ),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/cities', telemetryLimiter, async (req: Request, res: Response) => {
    const query = sanitizeSearchQuery(req.query.q);
    res.setHeader('Cache-Control', 'public, max-age=300');
    if (!query) {
      res.json({ results: PRESET_CITIES, source: 'curated-presets' });
      return;
    }
    const data = await searchCities(query);
    res.json(data);
  });

  app.get('/api/air-quality', telemetryLimiter, async (req: Request, res: Response) => {
    const coordCheck = validateCoordinates(req.query.lat, req.query.lon);
    if (!coordCheck.ok) {
      res.status(400).json({ error: coordCheck.error });
      return;
    }

    const name = sanitizePlainText(req.query.name, 80) || 'Selected Location';
    const country = sanitizePlainText(req.query.country, 80) || 'Regional Coordinates';
    const region = sanitizePlainText(req.query.region, 80) || undefined;
    const timezone = sanitizePlainText(req.query.timezone, 60) || 'UTC';
    const stdRaw = sanitizePlainText(req.query.standard, 20);
    const recommendedStandard: AqiStandard =
      stdRaw === 'eu-eaqi' || stdRaw === 'who-2021' ? stdRaw : 'us-epa';

    const location: CityLocation = {
      id: `loc-${coordCheck.latitude}-${coordCheck.longitude}`,
      name,
      region,
      country,
      latitude: coordCheck.latitude,
      longitude: coordCheck.longitude,
      timezone,
      recommendedStandard,
    };

    const simulateOutage = req.query.simulateOutage === '1';
    const bypassCache = req.query.refresh === '1';

    const payload = await getAirQualityForLocation(location, {
      bypassCache,
      simulateOutage,
    });
    res.setHeader(
      'Cache-Control',
      bypassCache || simulateOutage ? 'no-store' : 'public, max-age=180',
    );
    res.json(payload);
  });

  app.post('/api/ai/ask', aiLimiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const question = sanitizePlainText(req.body?.question, 800);
    if (question.length < 3) {
      res.status(400).json({
        error: 'Please enter a clear question of at least 3 characters.',
      });
      return;
    }

    const coordCheck = validateCoordinates(req.body?.location?.latitude, req.body?.location?.longitude);
    if (!coordCheck.ok) {
      res.status(400).json({ error: coordCheck.error });
      return;
    }

    const profiles = sanitizeFamilyProfiles(req.body?.profiles);
    const standardRaw = sanitizePlainText(req.body?.standard, 20);
    const standard: AqiStandard =
      standardRaw === 'eu-eaqi' || standardRaw === 'who-2021' ? standardRaw : 'us-epa';

    const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];
    const history: ChatTurn[] = rawHistory
      .slice(-8)
      .filter(
        (item: unknown): item is ChatTurn =>
          Boolean(item) &&
          typeof item === 'object' &&
          ((item as ChatTurn).role === 'user' || (item as ChatTurn).role === 'assistant') &&
          typeof (item as ChatTurn).content === 'string',
      )
      .map((item: ChatTurn) => ({
        role: item.role,
        content: sanitizePlainText(item.content, 800),
      }));

    const location: CityLocation = {
      id: `loc-${coordCheck.latitude}-${coordCheck.longitude}`,
      name: sanitizePlainText(req.body?.location?.name, 80) || 'Selected City',
      region: sanitizePlainText(req.body?.location?.region, 80) || undefined,
      country: sanitizePlainText(req.body?.location?.country, 80) || 'Unknown',
      latitude: coordCheck.latitude,
      longitude: coordCheck.longitude,
      timezone: sanitizePlainText(req.body?.location?.timezone, 60) || 'UTC',
      recommendedStandard: standard,
    };

    try {
      const telemetry = await getAirQualityForLocation(location);
      const answer = await askAirWiseAssistant({
        question,
        history,
        telemetry,
        standard,
        profiles,
      });
      res.json(answer);
    } catch (error) {
      const statusCode =
        typeof (error as { statusCode?: number }).statusCode === 'number'
          ? (error as { statusCode: number }).statusCode
          : 502;
      const rawMessage = error instanceof Error ? error.message : 'AI service unavailable';
      const safeMessage =
        rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')
          ? 'Gemini API rate quota reached temporarily. Please wait a moment and try again.'
          : rawMessage.includes('API_KEY') || statusCode === 503
            ? 'AI Assistant is not configured with an active server Gemini API key in Settings > Secrets.'
            : 'Unable to complete the AI request right now. Please try again.';
      res.status(statusCode).json({ error: safeMessage });
    }
  });

  app.post('/api/routine/generate', telemetryLimiter, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const coordCheck = validateCoordinates(req.body?.location?.latitude, req.body?.location?.longitude);
    if (!coordCheck.ok) {
      res.status(400).json({ error: coordCheck.error });
      return;
    }

    const profiles = sanitizeFamilyProfiles(req.body?.profiles);
    const modeRaw = sanitizePlainText(req.body?.commuteMode, 20);
    const commuteMode: 'walk-cycle' | 'public-bus' | 'rail-metro' =
      modeRaw === 'public-bus' || modeRaw === 'rail-metro' ? modeRaw : 'walk-cycle';

    const distRaw = req.body?.commuteDistanceKm;
    const commuteDistanceKm =
      distRaw !== null && distRaw !== undefined && distRaw !== '' && Number.isFinite(Number(distRaw))
        ? Math.max(0, Math.min(500, Number(distRaw)))
        : null;

    const hasGasStove = Boolean(req.body?.hasGasStove);

    const location: CityLocation = {
      id: `loc-${coordCheck.latitude}-${coordCheck.longitude}`,
      name: sanitizePlainText(req.body?.location?.name, 80) || 'Selected City',
      region: sanitizePlainText(req.body?.location?.region, 80) || undefined,
      country: sanitizePlainText(req.body?.location?.country, 80) || 'Unknown',
      latitude: coordCheck.latitude,
      longitude: coordCheck.longitude,
      timezone: sanitizePlainText(req.body?.location?.timezone, 60) || 'UTC',
      recommendedStandard: 'us-epa',
    };

    const telemetry = await getAirQualityForLocation(location, {
      simulateOutage: Boolean(req.body?.simulateOutage),
    });

    const routine = buildDeterministicRoutine({
      telemetry,
      profiles,
      commuteDistanceKm,
      commuteMode,
      hasGasStove,
    });
    res.json(routine);
  });

  // Safe JSON parse & generic Express error middleware (never exposes stack traces)
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const isSyntaxErr = err instanceof SyntaxError && 'body' in err;
    if (isSyntaxErr) {
      res.status(400).json({ error: 'Invalid JSON request body.' });
      return;
    }
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT) || 3000;

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir, { maxAge: '1d' }));
    app.get('/{*splat}', (_req: Request, res: Response) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build artifacts not found. Run npm run build first.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`AIRWISE AI server listening on http://0.0.0.0:${port}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer().catch((err) => {
    console.error('Failed to start AIRWISE AI server:', err);
    process.exit(1);
  });
}
