import type { NextFunction, Request, Response } from 'express';
import { ALLOWED_FAMILY_PROFILES } from './aqi.ts';
import type { FamilyProfileId } from './types.ts';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();
const MAX_BUCKETS = 5000;

function pruneExpiredBuckets(now: number): void {
  if (buckets.size < 250) return;
  for (const [k, bucket] of buckets.entries()) {
    if (now >= bucket.resetAt) {
      buckets.delete(k);
    }
  }
  while (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }
}

export function applySecurityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  next();
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const forwarded = req.headers['x-forwarded-for'];
    const ipRaw = Array.isArray(forwarded)
      ? forwarded[0]
      : typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.ip || 'local';
    const key = `${options.keyPrefix}:${ipRaw}`;
    const now = Date.now();
    pruneExpiredBuckets(now);
    const existing = buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(options.maxRequests - 1));
      next();
      return;
    }

    if (existing.count >= options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.status(429).json({
        error: 'Rate limit exceeded. Please wait briefly before sending another request.',
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    existing.count += 1;
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.maxRequests - existing.count)));
    next();
  };
}

/**
 * Strips control characters, HTML tags, and excessive whitespace from user text inputs.
 */
export function sanitizePlainText(input: unknown, maxLength = 800): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function validateCoordinates(
  latRaw: unknown,
  lonRaw: unknown,
): { ok: true; latitude: number; longitude: number } | { ok: false; error: string } {
  if (latRaw === undefined || latRaw === null || latRaw === '' || lonRaw === undefined || lonRaw === null || lonRaw === '') {
    return { ok: false, error: 'Latitude and longitude parameters are required.' };
  }
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ok: false, error: 'Latitude and longitude must be valid finite numbers.' };
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { ok: false, error: 'Coordinates are out of valid geographic bounds.' };
  }
  // Round to 2 decimal places (~1.1 km precision) for privacy-friendly telemetry lookup
  return {
    ok: true,
    latitude: Math.round(lat * 100) / 100,
    longitude: Math.round(lon * 100) / 100,
  };
}

export function sanitizeFamilyProfiles(raw: unknown): FamilyProfileId[] {
  if (!Array.isArray(raw)) return ['adults'];
  const valid = raw.filter(
    (item): item is FamilyProfileId =>
      typeof item === 'string' && (ALLOWED_FAMILY_PROFILES as readonly string[]).includes(item),
  );
  return valid.length > 0 ? Array.from(new Set(valid)) : ['adults'];
}

export function sanitizeSearchQuery(raw: unknown): string {
  const cleaned = sanitizePlainText(raw, 80);
  // Allow letters, numbers, spaces, commas, periods, hyphens, apostrophes
  return cleaned.replace(/[^a-zA-Z0-9\s,.\-']/g, '').trim();
}
