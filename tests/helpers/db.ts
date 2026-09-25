import { PrismaClient } from "@prisma/client";

/**
 * Shared database handle for the test suite. Tests run against the same
 * Postgres database configured in .env; every fixture user is prefixed with
 * `itest_` and removed afterwards, so no real account is ever touched.
 */

export const prisma = new PrismaClient();

export const TEST_PREFIX = "itest_";

export function testUsername(label: string): string {
  return `${TEST_PREFIX}${label}_${Math.random().toString(36).slice(2, 8)}`;
}

export function testEmail(username: string): string {
  return `${username}@example.test`;
}

export async function createTestUser(label = "user", password = "TestPassword123") {
  const { hashPassword } = await import("@/lib/auth/password");
  const username = testUsername(label);
  return prisma.user.create({
    data: {
      username,
      email: testEmail(username),
      passwordHash: await hashPassword(password),
    },
    select: { id: true, username: true, email: true, createdAt: true },
  });
}

/** Deletes every fixture user (and, by cascade, their expenses/budgets/tokens). */
export async function cleanupTestUsers(): Promise<void> {
  await prisma.user.deleteMany({ where: { username: { startsWith: TEST_PREFIX } } });
}

export async function seedExpense(
  userId: string,
  overrides: Partial<{
    idolType: string;
    customIdolName: string | null;
    memberName: string | null;
    category: string;
    amount: number;
    expenseDate: string;
    note: string | null;
  }> = {},
) {
  // `??` would turn an explicit null override back into the default, so check
  // for the key itself (memberName: null is a meaningful case in these tests).
  const has = (key: string) => Object.prototype.hasOwnProperty.call(overrides, key);

  return prisma.expense.create({
    data: {
      userId,
      idolType: has("idolType") ? (overrides.idolType as string) : "JKT48",
      customIdolName: has("customIdolName") ? (overrides.customIdolName as string | null) : null,
      memberName: has("memberName") ? (overrides.memberName as string | null) : "FREYA",
      category: has("category") ? (overrides.category as string) : "VC",
      amount: has("amount") ? (overrides.amount as number) : 200_000,
      expenseDate: new Date(
        `${has("expenseDate") ? (overrides.expenseDate as string) : "2026-09-25"}T00:00:00.000Z`,
      ),
      note: has("note") ? (overrides.note as string | null) : null,
    },
  });
}
