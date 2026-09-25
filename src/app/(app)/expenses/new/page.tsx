import type { Metadata } from "next";

import { ExpenseForm } from "@/components/expenses/expense-form";
import { PageHeader } from "@/components/layout/page-header";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tambah Pengeluaran" };

export default async function NewExpensePage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="Tambah Pengeluaran"
        subtitle="Tujuh langkah cepat — nama member otomatis dirapikan jadi huruf kapital."
        backHref="/dashboard"
      />
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <ExpenseForm mode="create" />
      </div>
    </>
  );
}
