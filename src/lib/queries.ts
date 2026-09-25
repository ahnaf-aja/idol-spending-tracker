/**
 * Data reads for the read-only screens. Kept separate from the repositories
 * (which own writes) so it is easy to see every query is scoped by userId.
 */

import "server-only";
import { prisma } from "@/lib/prisma";
import { toDTO, listExpenses, type ExpenseDTO } from "@/lib/expenses/repository";
import { utcToDateOnly, type DateRange } from "@/lib/period";

export async function getDashboardData(userId: string, range: DateRange | null): Promise<ExpenseDTO[]> {
  return listExpenses(userId, { range, order: "desc" });
}

export async function getAllExpenses(userId: string): Promise<ExpenseDTO[]> {
  return listExpenses(userId, { range: null, order: "desc" });
}

export async function getBudgets(userId: string) {
  const rows = await prisma.budget.findMany({
    where: { userId },
    orderBy: { periodStart: "desc" },
  });
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    periodStart: utcToDateOnly(row.periodStart),
    periodEnd: utcToDateOnly(row.periodEnd),
    createdAt: row.createdAt.toISOString(),
  }));
}

export type BudgetDTO = Awaited<ReturnType<typeof getBudgets>>[number];

export async function getBudgetForPeriod(userId: string, periodStart: string): Promise<BudgetDTO | null> {
  const row = await prisma.budget.findUnique({
    where: { userId_periodStart: { userId, periodStart: new Date(`${periodStart}T00:00:00.000Z`) } },
  });
  if (!row) return null;
  return {
    id: row.id,
    amount: row.amount,
    periodStart: utcToDateOnly(row.periodStart),
    periodEnd: utcToDateOnly(row.periodEnd),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getProfileStats(userId: string) {
  const [count, aggregate, byCategory, user] = await Promise.all([
    prisma.expense.count({ where: { userId } }),
    prisma.expense.aggregate({ where: { userId }, _sum: { amount: true } }),
    prisma.expense.groupBy({
      by: ["category"],
      where: { userId },
      _count: { category: true },
      _sum: { amount: true },
      orderBy: { _count: { category: "desc" } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, email: true, createdAt: true },
    }),
  ]);

  return {
    user,
    totalSpent: aggregate._sum.amount ?? 0,
    totalTransactions: count,
    mostFrequentCategory: byCategory[0]
      ? { category: byCategory[0].category, count: byCategory[0]._count.category }
      : null,
    topCategoryByAmount: byCategory
      .slice()
      .sort((a, b) => (b._sum.amount ?? 0) - (a._sum.amount ?? 0))[0]
      ? {
          category: byCategory.slice().sort((a, b) => (b._sum.amount ?? 0) - (a._sum.amount ?? 0))[0].category,
          amount: byCategory.slice().sort((a, b) => (b._sum.amount ?? 0) - (a._sum.amount ?? 0))[0]._sum.amount ?? 0,
        }
      : null,
  };
}

/** Sanity check used by tests: another user's expense must never resolve. */
export async function userExpenseIds(userId: string): Promise<string[]> {
  const rows = await prisma.expense.findMany({ where: { userId }, select: { id: true } });
  return rows.map((row) => row.id);
}

export { toDTO };
