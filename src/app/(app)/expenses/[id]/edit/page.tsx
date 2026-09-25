import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExpenseForm } from "@/components/expenses/expense-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/session";
import { getExpense } from "@/lib/expenses/repository";
import { formatDateShort } from "@/lib/period";

export const metadata: Metadata = { title: "Edit Pengeluaran" };

/**
 * Edit page. `getExpense` filters by the authenticated user id, so another
 * user's id resolves to null and answers 404 (requirement 39) — the row is
 * never even loaded into this page's props.
 */
export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const expense = await getExpense(user.id, id);
  if (!expense) notFound();

  return (
    <>
      <PageHeader
        title="Edit Pengeluaran"
        subtitle={`Transaksi ${formatDateShort(expense.expenseDate)}`}
        backHref="/history"
      />
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <ExpenseForm mode="edit" expense={expense} redirectTo="/history" />
      </div>
    </>
  );
}
