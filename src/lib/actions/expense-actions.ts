"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { budgetInputSchema, expenseInputSchema, fieldErrors } from "@/lib/validation";
import {
  createExpense,
  deleteExpense,
  updateExpense,
} from "@/lib/expenses/repository";
import { prisma } from "@/lib/prisma";
import { dateOnlyToUTC, getPeriodForDate, parseDateOnlyOrNull } from "@/lib/period-helpers";

export interface ExpenseActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  expenseId?: string;
}

/** Every write revalidates the screens that read expense data. */
function revalidateExpenseViews() {
  for (const path of ["/dashboard", "/history", "/journal", "/statistics", "/budget", "/profile"]) {
    revalidatePath(path);
  }
}

async function currentUserId(): Promise<string> {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login");
  return user.id;
}

export async function createExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const userId = await currentUserId();

  const parsed = expenseInputSchema.safeParse({
    idolType: formData.get("idolType"),
    customIdolName: formData.get("customIdolName"),
    memberName: formData.get("memberName"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    expenseDate: formData.get("expenseDate"),
    note: formData.get("note"),
    clientToken: formData.get("clientToken"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali data pengeluaran.", fieldErrors: fieldErrors(parsed.error) };
  }

  const amount = Number(parsed.data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Nominal harus lebih dari 0.", fieldErrors: { amount: "Nominal harus lebih dari 0." } };
  }

  // user_id comes from the session, never from the form. clientToken makes the
  // write idempotent, so a replayed submission cannot double-book the expense.
  const created = await createExpense(userId, { ...parsed.data, amount });
  revalidateExpenseViews();
  return { ok: true, message: "Pengeluaran berhasil ditambahkan.", expenseId: created.id };
}

export async function updateExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const userId = await currentUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Transaksi tidak ditemukan." };

  const parsed = expenseInputSchema.safeParse({
    idolType: formData.get("idolType"),
    customIdolName: formData.get("customIdolName"),
    memberName: formData.get("memberName"),
    category: formData.get("category"),
    amount: formData.get("amount"),
    expenseDate: formData.get("expenseDate"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Periksa kembali data pengeluaran.", fieldErrors: fieldErrors(parsed.error) };
  }

  const amount = Number(parsed.data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Nominal harus lebih dari 0.", fieldErrors: { amount: "Nominal harus lebih dari 0." } };
  }

  const updated = await updateExpense(userId, id, { ...parsed.data, amount });
  if (!updated) return { ok: false, error: "Transaksi tidak ditemukan atau bukan milik kamu." };

  revalidateExpenseViews();
  return { ok: true, message: "Pengeluaran berhasil diperbarui.", expenseId: updated.id };
}

export async function deleteExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const userId = await currentUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Transaksi tidak ditemukan." };

  const deleted = await deleteExpense(userId, id);
  if (!deleted) return { ok: false, error: "Transaksi tidak ditemukan atau bukan milik kamu." };

  revalidateExpenseViews();
  return { ok: true, message: "Pengeluaran berhasil dihapus." };
}

export async function setBudgetAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const userId = await currentUserId();

  const parsed = budgetInputSchema.safeParse({
    amount: formData.get("amount"),
    periodStart: formData.get("periodStart"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Budget tidak valid.", fieldErrors: fieldErrors(parsed.error) };
  }

  const amount = Number(parsed.data.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: "Budget tidak boleh negatif.", fieldErrors: { amount: "Budget tidak boleh negatif." } };
  }

  const periodStart = parsed.data.periodStart;
  const period = getPeriodForDate(periodStart);
  const start = dateOnlyToUTC(period.start);
  const end = dateOnlyToUTC(period.end);

  if (amount === 0) {
    await prisma.budget.deleteMany({ where: { userId, periodStart: start } });
    revalidatePath("/budget");
    revalidatePath("/dashboard");
    return { ok: true, message: "Budget periode ini dihapus." };
  }

  await prisma.budget.upsert({
    where: { userId_periodStart: { userId, periodStart: start } },
    create: { userId, amount, periodStart: start, periodEnd: end },
    update: { amount, periodEnd: end },
  });

  revalidatePath("/budget");
  revalidatePath("/dashboard");
  return { ok: true, message: "Budget berhasil disimpan." };
}

export { parseDateOnlyOrNull };
