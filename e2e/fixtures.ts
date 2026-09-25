import { test as base, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

/**
 * Shared Playwright fixture.
 *
 * The auth rate limiter (requirement 40) is deliberately strict: 8 logins per
 * 5 minutes per client+identifier, 5 registrations per hour, and so on. A serial
 * end-to-end suite signs in far more often than a real person ever would, so it
 * would trip its own security control and fail for the wrong reason.
 *
 * The limiter itself is exercised by tests/security.test.ts (login cap, per
 * identifier quota, forgot-password cap, pruning) plus the reset-password spec,
 * so clearing the counters here isolates the flows without weakening anything.
 */
const prisma = new PrismaClient();

export const test = base.extend({
  page: async ({ page }, use) => {
    await prisma.rateLimitHit.deleteMany({}).catch(() => {
      /* limiter storage is best-effort in tests */
    });
    await use(page);
  },
});

export { expect };
