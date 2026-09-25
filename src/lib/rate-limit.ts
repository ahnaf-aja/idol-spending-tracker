import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Fixed-window rate limiting backed by Postgres.
 *
 * Database-backed rather than in-memory so limits survive restarts and hold
 * across multiple server processes. Each call upserts one row per
 * (key, window) and counts the hits inside that window.
 */

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
}

export interface RateLimitRule {
  /** Bucket name, e.g. "login" or "forgot". */
  scope: string;
  /** How the caller is identified (ip + identifier, hashed). */
  identifier: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  login: { limit: 8, windowSeconds: 300 },
  register: { limit: 5, windowSeconds: 3600 },
  forgot: { limit: 5, windowSeconds: 900 },
  reset: { limit: 10, windowSeconds: 900 },
  changePassword: { limit: 8, windowSeconds: 900 },
} as const;

export type RateLimitScope = keyof typeof RATE_LIMITS;

function windowStart(windowSeconds: number): Date {
  const ms = windowSeconds * 1000;
  return new Date(Math.floor(Date.now() / ms) * ms);
}

export async function consumeRateLimit(
  scope: RateLimitScope | string,
  identifier: string,
  override?: { limit: number; windowSeconds: number },
): Promise<RateLimitResult> {
  const rule = override ?? RATE_LIMITS[scope as RateLimitScope];
  const limit = rule?.limit ?? 20;
  const windowSeconds = rule?.windowSeconds ?? 900;
  const bucket = windowStart(windowSeconds);
  const key = `${scope}:${identifier}`;

  try {
    const row = await prisma.rateLimitHit.upsert({
      where: { key_windowStart: { key, windowStart: bucket } },
      create: { key, windowStart: bucket, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.getTime() + windowSeconds * 1000 - Date.now()) / 1000),
    );

    if (row.count > limit) {
      return { ok: false, remaining: 0, limit, retryAfterSeconds };
    }
    return { ok: true, remaining: limit - row.count, limit, retryAfterSeconds };
  } catch {
    // Never lock the app out because the limiter itself failed.
    return { ok: true, remaining: limit, limit, retryAfterSeconds: 0 };
  }
}

/** Best-effort client identifier from request headers (behind proxies too). */
export function clientFingerprint(headers: Headers, extra = ""): string {
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "local";
  return `${ip}|${extra.toLowerCase()}`;
}

/** Housekeeping: drop counters whose window is long gone. */
export async function pruneRateLimits(olderThanSeconds = 86_400): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
  const { count } = await prisma.rateLimitHit.deleteMany({
    where: { windowStart: { lt: cutoff } },
  });
  return count;
}
