import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, History as HistoryIcon, Plus, Receipt } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { DeleteExpenseButton, EditExpenseButton } from "@/components/expenses/expense-actions";
import { CategoryIcon } from "@/components/expenses/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { categoryColor, categoryLabel, idolDisplayName } from "@/lib/categories";
import { formatIDR } from "@/lib/currency";
import { listExpenses, listIdolNames, listMemberNames } from "@/lib/expenses/repository";
import { rangeContextFromParams, type SearchParamsInput } from "@/lib/filters";
import { formatDateLong, formatPeriodLabel, formatRangeLabel } from "@/lib/period";
import { groupByPeriod } from "@/lib/stats";
import { getPeriodForDate } from "@/lib/period";
import { HistoryFilters } from "./history-filters";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const ctx = rangeContextFromParams(params);

  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const idol = first(params.idol);
  const member = first(params.member);
  const category = first(params.category);
  const search = first(params.q);

  const [filtered, allExpenses, idols, members] = await Promise.all([
    listExpenses(user.id, {
      range: ctx.range,
      idol: idol || null,
      member: member || null,
      category: category || null,
      search: search || null,
      order: "desc",
    }),
    listExpenses(user.id, { range: null, order: "desc" }),
    listIdolNames(user.id),
    listMemberNames(user.id),
  ]);

  const periods = groupByPeriod(allExpenses, getPeriodForDate).slice(0, 12);
  const totalFiltered = filtered.reduce((sum, expense) => sum + expense.amount, 0);
  const hasAnyData = allExpenses.length > 0;

  return (
    <>
      <PageHeader
        title="History"
        subtitle={`${filtered.length} transaksi · ${formatIDR(totalFiltered)}`}
        actions={
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/expenses/new">
              <Plus className="size-4" />
              Tambah
            </Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        {!hasAnyData ? (
          <EmptyState
            icon={Receipt}
            title="Belum ada pengeluaran 👀"
            description="Mulai catat pengeluaran ngidol kamu supaya kamu bisa melihat ke mana uangmu pergi."
            action={{ label: "+ Tambah Pengeluaran", href: "/expenses/new" }}
          />
        ) : (
          <>
            <PeriodFilter
              currentPeriod={ctx.current}
              previousPeriod={ctx.previous}
              preset={ctx.preset}
              range={ctx.range}
            />

            <Card>
              <CardContent className="pt-5">
                <HistoryFilters
                  idols={idols}
                  members={members}
                  values={{ idol, member, category, q: search }}
                />
              </CardContent>
            </Card>

            {/* Spending periods (requirement 30) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarRange className="size-4" />
                  Spending Periods
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {periods.map((period) => {
                  const active =
                    ctx.range?.start === period.start && ctx.range?.end === period.end;
                  return (
                    <Link
                      key={period.key}
                      href={`/history?preset=custom&start=${period.start}&end=${period.end}`}
                      className={
                        active
                          ? "border-primary/40 bg-primary/8 flex items-center gap-3 rounded-xl border px-3.5 py-3 transition"
                          : "hover:bg-accent/70 flex items-center gap-3 rounded-xl border border-transparent px-3.5 py-3 transition"
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold">
                          {formatPeriodLabel({ start: period.start, end: period.end })}
                        </p>
                        <p className="text-muted-foreground text-xs">{period.count} transaksi</p>
                      </div>
                      <p className="text-[13.5px] font-bold tabular-nums">{formatIDR(period.total)}</p>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            {/* Transaction list */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>
                  {ctx.range ? formatRangeLabel(ctx.range) : "Semua Transaksi"}
                </CardTitle>
                <span className="text-muted-foreground text-xs font-medium">Terbaru → Terlama</span>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <HistoryIcon className="text-muted-foreground/60 size-7" />
                    <p className="mt-3 text-sm font-semibold">Tidak ada transaksi</p>
                    <p className="text-muted-foreground mt-1 max-w-xs text-xs leading-relaxed">
                      Kombinasi filter ini belum punya transaksi. Coba ubah filter atau rentang tanggalnya.
                    </p>
                  </div>
                ) : (
                  filtered.map((expense) => (
                    <div
                      key={expense.id}
                      data-testid="expense-row"
                      className="hover:bg-accent/50 group flex items-start gap-3 rounded-xl px-2.5 py-3 transition"
                    >
                      <span
                        className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          backgroundColor: `${categoryColor(expense.category)}22`,
                          color: categoryColor(expense.category),
                        }}
                      >
                        <CategoryIcon category={expense.category} className="size-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-[13.5px] font-semibold">
                            {idolDisplayName(expense)}
                            {expense.memberName ? ` • ${expense.memberName}` : ""}
                          </p>
                          <Badge variant="muted">{categoryLabel(expense.category)}</Badge>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {formatDateLong(expense.expenseDate)}
                          {expense.note ? ` · ${expense.note}` : ""}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <p className="mr-1 text-[13.5px] font-bold tabular-nums">
                          {formatIDR(expense.amount)}
                        </p>
                        <EditExpenseButton id={expense.id} />
                        <DeleteExpenseButton expense={expense} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
