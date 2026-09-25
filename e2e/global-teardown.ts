import { PrismaClient } from "@prisma/client";
import "dotenv/config";

/**
 * Global teardown: remove everything the end-to-end suite created.
 *
 * Cleanup runs against the database rather than through a browser, because the
 * previous approach (log in as the throwaway account in `afterAll` and delete
 * rows through the UI) broke whenever serial mode stopped the file early: the
 * password-rotation test would be skipped, the teardown's login would fail, and
 * that failure was then reported against an unrelated passing test.
 *
 * Every fixture user is prefixed, so the delete is unambiguous. Rate-limit
 * counters are cleared too, so a second run in the same window starts clean.
 */
export default async function globalTeardown() {
  const prisma = new PrismaClient();

  try {
    const staleUsers = await prisma.user.findMany({
      where: {
        OR: [
          { username: { startsWith: "e2e_" } },
          { username: { startsWith: "dbg" } },
          { email: { endsWith: "@example.test" } },
        ],
      },
      select: { id: true },
    });

    if (staleUsers.length > 0) {
      const ids = staleUsers.map((u) => u.id);
      await prisma.expense.deleteMany({ where: { userId: { in: ids } } });
      await prisma.budget.deleteMany({ where: { userId: { in: ids } } });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.passwordResetToken.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }

    await prisma.rateLimitHit.deleteMany({});

    console.log(`[e2e teardown] removed ${staleUsers.length} fixture user(s)`);
  } catch (error) {
    // Never fail the run over housekeeping.
    console.warn("[e2e teardown] skipped:", (error as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}
