/**
 * The server-side expense repository.
 *
 * Ownership rule (requirement 39): `user_id` is ALWAYS taken from the
 * authenticated session, never from client input, and every single query is
 * filtered by it. A row that belongs to another user behaves exactly like a
 * row that does not exist (we return null -> the caller answers 404).
 */

import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeMemberName, normalizeNote, normalizeLabel } from "@/lib/normalize";
import { dateOnlyToUTC, utcToDateOnly, type DateOnly, type DateRange } from "@/lib/period";
import type { ExpenseInput } from "@/lib/validation";

export interface ExpenseDTO {
  id: string;
  idolType: string;
  customIdolName: string | null;
  memberName: string | null;
  category: string;
  amount: number;
  expenseDate: DateOnly;
  note: string | null;
  createdAt: string;
}

type ExpenseRow = {
  id: string;
  idolType: string;
  customIdolName: string | null;
  memberName: string | null;
  category: string;
  amount: number;
  expenseDate: Date;
  note: string | null;
  createdAt: Date;
};

export function toDTO(row: ExpenseRow): ExpenseDTO {
  return {
    id: row.id,
    idolType: row.idolType,
    customIdolName: row.customIdolName,
    memberName: row.memberName,
    category: row.category,
    amount: row.amount,
    expenseDate: utcToDateOnly(row.expenseDate),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Server-side normalisation, applied on both create and update. */
export function normalizeExpenseInput(input: ExpenseInput) {
  const memberName = normalizeMemberName(input.memberName);
  const customIdolName =
    input.idolType === "OTHER" ? normalizeLabel(input.customIdolName) : null;
  return {
    idolType: input.idolType,
    customIdolName,
    memberName,
    category: input.category,
    amount: typeof input.amount === "string" ? Number.parseInt(input.amount, 10) : input.amount,
    expenseDate: dateOnlyToUTC(input.expenseDate),
    note: normalizeNote(input.note),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

const dateFilter = (range: DateRange | null): Prisma.ExpenseWhereInput =>
  range
    ? { expenseDate: { gte: dateOnlyToUTC(range.start), lte: dateOnlyToUTC(range.end) } }
    : {};

export interface ExpenseQuery {
  range?: DateRange | null;
  idol?: string | null;
  member?: string | null;
  category?: string | null;
  search?: string | null;
  limit?: number;
  order?: "asc" | "desc";
}

export async function listExpenses(userId: string, query: ExpenseQuery = {}): Promise<ExpenseDTO[]> {
  const where: Prisma.ExpenseWhereInput = {
    userId,
    ...dateFilter(query.range ?? null),
    ...(query.idol ? { OR: [{ idolType: query.idol }, { customIdolName: query.idol }] } : {}),
    ...(query.member ? { memberName: query.member } : {}),
    ...(query.category ? { category: query.category } : {}),
  };

  if (query.search?.trim()) {
    const search = query.search.trim();
    where.AND = [
      {
        OR: [
          { memberName: { contains: search, mode: "insensitive" } },
          { idolType: { contains: search, mode: "insensitive" } },
          { customIdolName: { contains: search, mode: "insensitive" } },
          { note: { contains: search, mode: "insensitive" } },
        ],
      },
    ];
  }

  const rows = await prisma.expense.findMany({
    where,
    orderBy: [{ expenseDate: query.order ?? "desc" }, { createdAt: "desc" }],
    take: query.limit,
  });
  return rows.map(toDTO);
}

/** Scoped fetch: another user's id simply cannot match. */
export async function getExpense(userId: string, expenseId: string): Promise<ExpenseDTO | null> {
  const row = await prisma.expense.findFirst({ where: { id: expenseId, userId } });
  return row ? toDTO(row) : null;
}

/**
 * Creates one expense.
 *
 * When `input.clientToken` is present it doubles as an idempotency key: the
 * (user_id, client_token) unique index means a replayed server action - React
 * firing the same form submission twice, a double click, a retry - can only ever
 * produce a single row. The second attempt finds the existing row and returns it
 * instead of erroring, so the user still sees a success and the dashboard shows
 * exactly one transaction (requirement 46).
 */
export async function createExpense(userId: string, input: ExpenseInput): Promise<ExpenseDTO> {
  const data = normalizeExpenseInput(input);
  const clientToken = input.clientToken?.trim() || null;

  if (clientToken) {
    const existing = await prisma.expense.findFirst({
      where: { userId, clientToken },
    });
    if (existing) return toDTO(existing);
  }

  try {
    const row = await prisma.expense.create({
      data: { ...data, userId, clientToken },
    });
    return toDTO(row);
  } catch (error) {
    // Lost the race: the other invocation already inserted this submission.
    if (clientToken && isUniqueViolation(error)) {
      const existing = await prisma.expense.findFirst({ where: { userId, clientToken } });
      if (existing) return toDTO(existing);
    }
    throw error;
  }
}

export async function updateExpense(
  userId: string,
  expenseId: string,
  input: ExpenseInput,
): Promise<ExpenseDTO | null> {
  const data = normalizeExpenseInput(input);
  // updateMany keeps the userId in the WHERE clause, so a foreign id updates 0 rows.
  const result = await prisma.expense.updateMany({ where: { id: expenseId, userId }, data });
  if (result.count === 0) return null;
  return getExpense(userId, expenseId);
}

export async function deleteExpense(userId: string, expenseId: string): Promise<boolean> {
  const result = await prisma.expense.deleteMany({ where: { id: expenseId, userId } });
  return result.count > 0;
}

export async function countExpenses(userId: string): Promise<number> {
  return prisma.expense.count({ where: { userId } });
}

/** Distinct member names for the filter dropdowns - generated from the DB, never hardcoded. */
export async function listMemberNames(userId: string): Promise<string[]> {
  const rows = await prisma.expense.findMany({
    where: { userId, memberName: { not: null } },
    select: { memberName: true },
    distinct: ["memberName"],
    orderBy: { memberName: "asc" },
  });
  return rows.map((r) => r.memberName!).filter(Boolean);
}

export async function listIdolNames(userId: string): Promise<string[]> {
  const rows = await prisma.expense.findMany({
    where: { userId },
    select: { idolType: true, customIdolName: true },
  });
  const names = new Set<string>();
  for (const row of rows) {
    names.add(row.idolType === "OTHER" ? row.customIdolName?.trim() || "Other" : row.idolType);
  }
  return [...names].sort();
}

/** Earliest and latest transaction dates, used to build the period list. */
export async function expenseDateBounds(userId: string): Promise<{ min: DateOnly; max: DateOnly } | null> {
  const rows = await prisma.expense.findMany({
    where: { userId },
    select: { expenseDate: true },
    orderBy: { expenseDate: "asc" },
  });
  if (rows.length === 0) return null;
  return {
    min: utcToDateOnly(rows[0].expenseDate),
    max: utcToDateOnly(rows[rows.length - 1].expenseDate),
  };
}

/** Every distinct member name belonging to a user (journal + statistics). */
export async function memberNames(userId: string): Promise<string[]> {
  return listMemberNames(userId);
}
