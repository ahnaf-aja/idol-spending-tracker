import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Crown,
  Equal,
  Flame,
  Plus,
  Receipt,
  Sparkles,
  Tag,
  Wallet,
} from "lucide-react";

import { DonutChart, MemberBarChart, ChartFrame } from "@/components/charts";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { categoryColor, categoryLabel, idolDisplayName } from "@/lib/categories";
import { formatIDR } from "@/lib/currency";
import { listExpenses } from "@/lib/expenses/repository";
import { rangeContextFromParams, type SearchParamsInput } from "@/lib/filters";
import { formatDateShort, formatPeriodLabel, formatRangeLabel, percentChange } from "@/lib/period";
import { budgetProgress, summarize } from "@/lib/stats";
import { getBudgetForPeriod } from "@/lib/queries";
import { CategoryIcon } from "@/components/expenses/fields";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const ctx = rangeContextFromParams(params);

  const [expenses, comparisonExpenses, budget] = await Promise.all([
    listExpenses(user.id, { range: ctx.range, order: "desc" }),
    ctx.comparisonRange
      ? listExpenses(user.id, { range: ctx.comparisonRange, order: "desc" })
      : Promise.resolve([]),
    getBudgetForPeriod(user.id, ctx.current.start),
  ]);

  const summary = summarize(expenses);
  const comparisonTotal = comparisonExpenses.reduce((sum, e) => sum + e.amount, 0);
  const change = ctx.comparisonRange ? percentChange(summary.total, comparisonTotal) : null;
  const progress = budgetProgress(budget?.amount ?? null, summary.total);
  const recent = expenses.slice(0, 6);
  const hasAnyExpense = summary.count > 0;

  const periodLabel = ctx.range ? formatRangeLabel(ctx.range) : "Semua waktu";

  return (
    <>
      <PageHeader
        title={`Welcome back, ${user.username} 👋`}
        subtitle={
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3.5" />
            {formatPeriodLabel(ctx.current)}
          </span>
        }
        actions={
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/expenses/new">
              <Plus className="size-4" />
              Tambah
            </Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-6">
        <PeriodFilter
          currentPeriod={ctx.current}
          previousPeriod={ctx.previous}
          preset={ctx.preset}
          range={ctx.range}
        />

        {!hasAnyExpense ? (
          <EmptyState
            icon={Receipt}
            title="Belum ada pengeluaran 👀"
            description="Mulai catat pengeluaran ngidol kamu supaya kamu bisa melihat ke mana uangmu pergi."
            action={{ label: "+ Tambah Pengeluaran", href: "/expenses/new" }}
          />
        ) : (
          <>
            {/* Hero: total for the selected range */}
            <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/12 via-card to-card p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-muted-foreground text-[13px] font-medium">
                    Total Pengeluaran {ctx.preset === "current" ? "Periode Ini" : "Rentang Ini"}
                  </p>
                  <p className="mt-1.5 text-3xl font-bold tracking-tight sm:text-4xl">
                    {formatIDR(summary.total)}
                  </p>
                  <p className="text-muted-foreground mt-1.5 text-[13px] font-medium">{periodLabel}</p>
                </div>

                {change !== null ? (
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-semibold",
                      change > 0
                        ? "bg-destructive/10 text-destructive"
                        : change < 0
                          ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {change > 0 ? (
                      <ArrowUpRight className="size-4" />
                    ) : change < 0 ? (
                      <ArrowDownRight className="size-4" />
                    ) : (
                      <Equal className="size-4" />
                    )}
                    {change > 0 ? "↑" : change < 0 ? "↓" : ""}
                    {Math.abs(change).toFixed(0)}%
                    <span className="text-muted-foreground font-medium">vs {ctx.comparisonLabel}</span>
                  </div>
                ) : (
                  <div className="bg-muted text-muted-foreground rounded-2xl px-3.5 py-2.5 text-xs font-medium">
                    {ctx.comparisonRange
                      ? "Tidak ada transaksi di periode pembanding"
                      : "Tidak ada pembanding untuk rentang ini"}
                  </div>
                )}
              </div>

              {progress.hasBudget && (
                <div className="mt-5 border-t border-border/70 pt-4">
                  <div className="flex items-center justify-between text-[13px] font-medium">
                    <span className="text-muted-foreground">Budget periode ini</span>
                    <span>
                      {formatIDR(summary.total)} / {formatIDR(progress.amount)}
                    </span>
                  </div>
                  <div className="bg-muted mt-2 h-2.5 w-full overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        progress.isOver ? "bg-destructive" : "bg-primary",
                      )}
                      style={{ width: `${Math.min(progress.percent, 100)}%` }}
                    />
                  </div>
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    {progress.isOver
                      ? `Over budget ${formatIDR(progress.over)}`
                      : `Sisa ${formatIDR(progress.remaining)} · ${progress.percent.toFixed(0)}% terpakai`}
                  </p>
                </div>
              )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Total Pengeluaran"
                value={formatIDR(summary.total)}
                icon={<Wallet className="size-4" />}
              />
              <StatCard
                label="Jumlah Transaksi"
                value={`${summary.count} transaksi`}
                icon={<Receipt className="size-4" />}
              />
              <StatCard
                label="Pengeluaran Terbesar"
                value={formatIDR(summary.largest)}
                icon={<Flame className="size-4" />}
              />
              <StatCard
                label="Kategori Terbesar"
                value={summary.topCategory?.label ?? "—"}
                hint={summary.topCategory ? formatIDR(summary.topCategory.amount) : undefined}
                icon={<Tag className="size-4" />}
              />
            </div>

            {summary.topMember && (
              <Card>
                <CardContent className="flex items-center gap-4 pt-5">
                  <span className="bg-primary/12 text-primary flex size-11 items-center justify-center rounded-2xl">
                    <Crown className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-muted-foreground text-[12.5px] font-medium">
                      Member dengan Pengeluaran Terbesar
                    </p>
                    <p className="truncate text-base font-bold">{summary.topMember.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-primary text-base font-bold">{formatIDR(summary.topMember.amount)}</p>
                    <p className="text-muted-foreground text-xs">{summary.topMember.count} transaksi</p>
                  </div>
                  <Button asChild variant="ghost" size="iconSm" aria-label="Lihat jurnal member">
                    <Link href={`/journal/${encodeURIComponent(summary.topMember.label)}`}>
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Charts */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartFrame
                title="Pengeluaran Berdasarkan Kategori"
                description="Mengikuti filter tanggal di atas"
              >
                <DonutChart data={summary.byCategory} total={summary.total} />
              </ChartFrame>
              <ChartFrame title="Pengeluaran Berdasarkan Member" description="Termasuk NO MEMBER">
                <MemberBarChart data={summary.byMember} />
              </ChartFrame>
            </div>

            {/* Recent transactions */}
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Recent Transactions</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/history">
                    Lihat semua
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-1">
                {recent.map((expense) => (
                  <Link
                    key={expense.id}
                    href={`/expenses/${expense.id}/edit`}
                    className="hover:bg-accent/70 -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition"
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: `${categoryColor(expense.category)}22`,
                        color: categoryColor(expense.category),
                      }}
                    >
                      <CategoryIcon category={expense.category} className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      {/* No member -> just the idol, never "JKT48 • NULL" */}
                      <p className="truncate text-[13.5px] font-semibold">
                        {idolDisplayName(expense)}
                        {expense.memberName ? ` • ${expense.memberName}` : ""}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {categoryLabel(expense.category)}
                        {expense.note ? ` · ${expense.note}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13.5px] font-bold tabular-nums">{formatIDR(expense.amount)}</p>
                      <p className="text-muted-foreground text-[11px]">{formatDateShort(expense.expenseDate)}</p>
                    </div>
                  </Link>
                ))}
                {recent.length === 0 && (
                  <p className="text-muted-foreground py-6 text-center text-sm">
                    Tidak ada transaksi pada rentang ini.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Spending by idol (compact list, chart lives on Statistics) */}
            {summary.byIdol.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Pengeluaran Berdasarkan Idol</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {summary.byIdol.map((slice) => (
                    <div key={slice.key} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{slice.label}</span>
                      <div className="bg-muted hidden h-2 w-32 overflow-hidden rounded-full sm:block">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${Math.max(slice.share * 100, 3)}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[13.5px] font-semibold tabular-nums">
                        {formatIDR(slice.amount)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
