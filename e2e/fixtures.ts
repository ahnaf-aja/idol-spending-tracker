import { test as base, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

/**
 * Shared Playwright fixture.
 *
 * Two problems this guards against:
 *
 * 1. The auth rate limiter (requirement 40) is deliberately strict: 8 logins per
 *    5 minutes per client+identifier, 5 registrations per hour, and so on. A serial
 *    end-to-end suite signs in far more often than a real person ever would, so it
 *    would trip its own security control and fail for the wrong reason. The limiter
 *    itself is exercised by tests/security.test.ts (login cap, per-identifier quota,
 *    forgot-password cap, pruning) plus the reset-password spec, so clearing the
 *    counters here isolates the flows without weakening anything.
 *
 * 2. This fixture and the global teardown connect with `dotenv/config`, i.e. `.env`.
 *    The app connects with Next's loader, which also reads `.env.local`.
 *    `.env.local` wins over `.env`, so if a production URL is parked there the suite
 *    writes to production while its cleanup empties a *different* database - rows
 *    accumulate in the live database and nothing gets cleaned. The suite therefore
 *    refuses to touch a non-local database unless explicitly allowed, and says so.
 */
const prisma = new PrismaClient();

/**
 * Parses DATABASE_URL and reports its hostname, or null when unparseable.
 * Matching the parsed hostname (not the raw string) matters: the URL carries
 * credentials, so the host is preceded by `user:pass@`, not by `//`.
 */
function databaseHostname(): string | null {
  try {
    return new URL((process.env.DATABASE_URL ?? "").replace(/^"|"$/g, "")).hostname;
  } catch {
    return null;
  }
}

function isLocalHost(hostname: string | null): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

const dbHost = databaseHostname();
const allowRemote = process.env.E2E_ALLOW_REMOTE_DB === "1";

if (!isLocalHost(dbHost) && !allowRemote) {
  throw new Error(
    `Refusing to run E2E against a non-local database (host: ${dbHost ?? "(unparseable)"}).\n` +
      `The suite's cleanup is scoped to fixture users, but it would still write to and\n` +
      `delete from a real database. Point DATABASE_URL at localhost, or set\n` +
      `E2E_ALLOW_REMOTE_DB=1 if you genuinely mean to target it.`,
  );
}

if (!isLocalHost(dbHost) && allowRemote) {
  console.warn(
    `[e2e] WARNING: running against non-local database (host: ${dbHost}). ` +
      `Fixture cleanup will delete its e2e_/dbg rows there.`,
  );
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await prisma.rateLimitHit.deleteMany({}).catch(() => {
      /* limiter storage is best-effort in tests */
    });
    await use(page);
  },
});

export { expect };
