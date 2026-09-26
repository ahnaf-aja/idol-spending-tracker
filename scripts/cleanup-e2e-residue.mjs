/**
 * Scoped cleanup of end-to-end fixture residue.
 *
 * Deletes ONLY rows belonging to the e2e test namespace (usernames starting
 * with `e2e_`/`dbg`, or emails ending in `@example.test`) plus the rate-limit
 * counters, then prints a before/after summary.
 *
 * Real accounts are never touched - no wallet, truncate, or prefix-less delete.
 *
 * Dry run by default; pass --apply to actually delete.
 *
 * usage: node scripts/cleanup-e2e-residue.mjs <postgres-url> [--apply]
 */
import { PrismaClient } from "@prisma/client";

const url = process.argv[2];
const apply = process.argv.includes("--apply");
if (!url) {
  console.error("usage: node scripts/cleanup-e2e-residue.mjs <postgres-url> [--apply]");
  process.exit(2);
}

const host = (() => {
  try {
    return new URL(url).host;
  } catch {
    return "<unparseable>";
  }
})();

const FIXTURE_FILTER = {
  OR: [
    { username: { startsWith: "e2e_" } },
    { username: { startsWith: "dbg" } },
    { email: { endsWith: "@example.test" } },
  ],
};

const prisma = new PrismaClient({ datasources: { db: { url } } });

try {
  const before = {
    users: await prisma.user.count(),
    expenses: await prisma.expense.count(),
    rateHits: await prisma.rateLimitHit.count(),
  };

  const fixtureUsers = await prisma.user.findMany({
    where: FIXTURE_FILTER,
    select: { id: true, username: true },
  });
  const ids = fixtureUsers.map((u) => u.id);

  const kept = await prisma.user.findMany({
    where: { NOT: FIXTURE_FILTER },
    select: { username: true, email: true },
  });

  console.log(`host: ${host}`);
  console.log(`mode: ${apply ? "APPLY (deleting)" : "DRY RUN (read only)"}`);
  console.log(`\nwill delete ${ids.length} fixture user(s):`);
  console.log("  " + (fixtureUsers.map((u) => u.username).join(", ") || "(none)"));
  console.log(`\nwill preserve ${kept.length} real account(s):`);
  for (const u of kept) console.log(`  ${u.username} <${u.email}>`);

  if (!apply) {
    console.log("\n(dry run - nothing deleted)");
  } else if (ids.length > 0 || before.rateHits > 0) {
    const r = await prisma.$transaction([
      prisma.expense.deleteMany({ where: { userId: { in: ids } } }),
      prisma.budget.deleteMany({ where: { userId: { in: ids } } }),
      prisma.session.deleteMany({ where: { userId: { in: ids } } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: { in: ids } } }),
      prisma.user.deleteMany({ where: { id: { in: ids } } }),
      prisma.rateLimitHit.deleteMany({}),
    ]);
    console.log(
      `\ndeleted: expenses=${r[0].count} budgets=${r[1].count} sessions=${r[2].count} ` +
        `resetTokens=${r[3].count} users=${r[4].count} rateLimitHits=${r[5].count}`,
    );
  }

  const after = {
    users: await prisma.user.count(),
    expenses: await prisma.expense.count(),
    rateHits: await prisma.rateLimitHit.count(),
  };
  console.log(
    `\ncounts  users ${before.users} -> ${after.users} | ` +
      `expenses ${before.expenses} -> ${after.expenses} | ` +
      `rate_limit_hits ${before.rateHits} -> ${after.rateHits}`,
  );

  const remaining = await prisma.user.findMany({
    select: { username: true },
    orderBy: { username: "asc" },
  });
  console.log(`\nremaining users: ${remaining.map((u) => u.username).join(", ") || "(none)"}`);
} finally {
  await prisma.$disconnect();
}
