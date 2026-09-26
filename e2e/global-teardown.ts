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
 *
 * Cleanup must target the SAME database the app wrote to. This runs under
 * `dotenv/config` (`.env`), while the app runs under Next's loader which also
 * reads `.env.local` - and `.env.local` wins. If a production URL sits there,
 * the suite writes to production and this teardown cleans localhost, so the
 * residue silently builds up in the live database. The host is therefore
 * printed, and a non-local target is only accepted when explicitly allowed.
 */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Hostname of DATABASE_URL, or null when unparseable. Never returns credentials. */
function dbHostname(): string | null {
  try {
    return new URL((process.env.DATABASE_URL ?? "").replace(/^"|"$/g, "")).hostname;
  } catch {
    return null;
  }
}

export default async function globalTeardown() {
  const host = dbHostname();

  if (host === null) {
    throw new Error(
      `E2E teardown refused: DATABASE_URL is missing or unparseable, so there is no\n` +
        `guarantee the cleanup would target the database the app wrote to.`,
    );
  }

  if (!LOCAL_HOSTNAMES.has(host) && process.env.E2E_ALLOW_REMOTE_DB !== "1") {
    throw new Error(
      `E2E teardown refused: DATABASE_URL host "${host}" is not local.\n` +
        `Set E2E_ALLOW_REMOTE_DB=1 to clean a remote database, or point DATABASE_URL at localhost.`,
    );
  }

  console.log(`[e2e teardown] target database host: ${host}`);
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
