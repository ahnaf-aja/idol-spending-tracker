import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarRange, Wallet } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth/session";
import { formatIDR } from "@/lib/currency";
import { listExpenses } from "@/lib/expenses/repository";
import { getBudgets } from "@/lib/queries";
import {
  currentPeriod,
  formatPeriodLabel,
  previousPeriod,
  addMonths,
  todayDateOnly,
  getPeriodForDate,
  isDateOnly,
} from "@/lib/period";
import { budgetProgress } from "@/lib/stats";
import { BudgetForm } from "./budget-form";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Budget Ngidol" };

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireUser();
  const { period: periodParam } = await searchParams;

  // The period shown can be navigated with ?period=YYYY-MM-DD (any date in it).
  const anchor = periodParam && isDateOnly(periodParam) ? periodParam : todayDateOnly();
  const period = getPeriodForDate(anchor);
  const isCurrent = period.start === currentPeriod().start;

  const [expenses, allBudgets] = await Promise.all([
    listExpenses(user.id, { range: period, order: "desc" }),
    getBudgets(user.id),
  ]);

  const spent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const budget = allBudgets.find((row) => row.periodStart === period.start) ?? null;
  const progress = budgetProgress(budget?.amount ?? null, spent);

  // 12-month history, newest first, using only periods the user has data for or budgets on.
  const historyKeys = new Set<string>();
  for (const row of allBudgets) historyKeys.add(row.periodStart);
  const bounds = await listExpenses(user.id, { range: null, order: "asc", limit: 1 });
  const oldest = bounds[0]?.expenseDate ?? period.start;
  let cursor = getPeriodForDate(oldest);
  const now = currentPeriod();
  const allPeriods: { start: string; end: string }[] = [];
  while (cursor.start <= now.start && allPeriods.length < 400) {
    allPeriods.push({ ...cursor });
    cursor = addMonths(cursor.start, 1) ? getPeriodForDate(addMonths(cursor.start, 1)) : cursor;
  }

  const previousPeriods = allPeriods
    .filter((p) => historyKeys.has(p.start) || p.start === period.start)
    .slice(-8)
    .reverse();

  return (
    <>
      <PageHeader title="Budget Ngidol" subtitle={formatPeriodLabel(period)} />

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6">
        {/* Period navigator */}
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/budget?period=${previousPeriod(period).start}`}>
              <ArrowLeft className="size-4" />
              Sebelumnya
            </Link>
          </Button>
          <div className="text-center">
            <p className="text-[13px] font-semibold">{formatPeriodLabel(period)}</p>
            {isCurrent ? (
              <Badge variant="success" className="mt-1">
                Periode saat ini
              </Badge>
            ) : (
              <Badge variant="muted" className="mt-1">
                Periode lampau
              </Badge>
            )}
          </div>
          <Button asChild variant="outline" size="sm" disabled={isCurrent}>
            <Link href={`/budget?period=${addMonths(period.start, 1)}`}>
              Berikutnya
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>

        {/* Progress card */}
        <Card>
          <CardContent className="pt-5">
            {progress.hasBudget ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-muted-foreground text-[13px] font-medium">Budget</p>
                    <p className="text-xl font-bold tracking-tight">{formatIDR(progress.amount)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[13px] font-medium">Spent</p>
                    <p className="text-xl font-bold tracking-tight">{formatIDR(progress.spent)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[13px] font-medium">
                      {progress.isOver ? "Over Budget" : "Remaining"}
                    </p>
                    <p
                      className={cn(
                        "text-xl font-bold tracking-tight",
                        progress.isOver ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {formatIDR(progress.isOver ? progress.over : progress.remaining)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground text-[13px] font-medium">Progress</p>
                    <p className="text-xl font-bold tracking-tight">{progress.percent.toFixed(0)}%</p>
                  </div>
                </div>

                <Progress
                  className="mt-4 h-3"
                  value={Math.min(progress.percent, 100)}
                  tone={progress.isOver ? "over" : progress.percent >= 80 ? "warning" : "success"}
                />

                {progress.isOver ? (
                  <div className="bg-destructive/10 text-destructive mt-3 flex items-start gap-2 rounded-xl px-3.5 py-3 text-[13px] font-medium">
                    <AlertTriangle className="mt-px size-4 shrink-0" />
                    <span>
                      Kamu sudah melewati budget periode ini sebesar {formatIDR(progress.over)}. Transaksi baru
                      tetap bisa dicatat — budget hanya untuk monitoring.
                    </span>
                  </div>
                ) : (
                  <p className="text-muted-foreground mt-3 text-xs">
                    Sisa {formatIDR(progress.remaining)} untuk periode ini.
                  </p>
                )}
              </>
            ) : (
              <div className="py-4 text-center">
                <span className="bg-muted text-muted-foreground mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl">
                  <Wallet className="size-5" />
                </span>
                <p className="text-sm font-semibold">Belum ada budget untuk periode ini</p>
                <p className="text-muted-foreground mx-auto mt-1.5 max-w-sm text-xs leading-relaxed">
                  Spent saat ini {formatIDR(spent)} dari {expenses.length} transaksi. Tetapkan budget untuk
                  memantau pengeluaran ngidol kamu per periode tanggal 25.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atur Budget</CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetForm
              periodStart={period.start}
              periodEnd={period.end}
              currentAmount={budget?.amount ?? null}
            />
          </CardContent>
        </Card>

        {previousPeriods.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarRange className="size-4" />
                Riwayat Budget &amp; Pengeluaran
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {previousPeriods.map((row) => {
                const record = allBudgets.find((budgetRow) => budgetRow.periodStart === row.start);
                return (
                  <Link
                    key={row.start}
                    href={`/budget?period=${row.start}`}
                    className={cn(
                      "hover:bg-accent/70 flex items-center justify-between gap-3 rounded-xl px-3.5 py-3 transition",
                      row.start === period.start && "bg-primary/8",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold">{formatPeriodLabel(row)}</p>
                      <p className="text-muted-foreground text-xs">
                        {record ? `Budget ${formatIDR(record.amount)}` : "Belum ada budget"}
                      </p>
                    </div>
                    <Badge variant={record ? "outline" : "muted"}>
                      {record ? "Ada budget" : "Tanpa budget"}
                    </Badge>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
