import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";

import { ChartFrame, SpendingLineChart } from "@/components/charts";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { categoryColor, categoryLabel, idolDisplayName, slugify } from "@/lib/categories";
import { formatIDR } from "@/lib/currency";
import { listExpenses, listMemberNames } from "@/lib/expenses/repository";
import { rangeContextFromParams, type SearchParamsInput } from "@/lib/filters";
import { formatDateLong, formatRangeLabel } from "@/lib/period";
import { summarize } from "@/lib/stats";
import { CategoryIcon } from "@/components/expenses/fields";

export const metadata: Metadata = { title: "Spending Journal" };

/**
 * Member detail (requirement 32). The member name arrives URL-encoded; it is
 * matched against the user's own distinct member list, so an unknown (or
 * someone else's) name answers 404 instead of exposing anything.
 */
export default async function MemberJournalPage({
  params,
  searchParams,
}: {
  params: Promise<{ member: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const user = await requireUser();
  const [{ member: rawMember }, query] = await Promise.all([params, searchParams]);
  const ctx = rangeContextFromParams(query);

  const memberName = decodeURIComponent(rawMember);

  const [records, names] = await Promise.all([
    listExpenses(user.id, { member: memberName, range: ctx.range, order: "desc" }),
    listMemberNames(user.id),
  ]);

  const exists = names.includes(memberName);
  if (!exists) notFound();

  const allTime = await listExpenses(user.id, { member: memberName, range: null, order: "desc" });
  const summary = summarize(records);
  const allTimeTotal = allTime.reduce((sum, expense) => sum + expense.amount, 0);
  const idol = records[0] ? idolDisplayName(records[0]) : allTime[0] ? idolDisplayName(allTime[0]) : "—";

  // Timeline of the selected range, oldest last.
  const timeline = records.slice().sort((a, b) => (a.expenseDate < b.expenseDate ? 1 : -1));

  return (
    <>
      <PageHeader
        title={`${memberName} — Spending Journal`}
        subtitle={`Idol: ${idol}`}
        backHref="/journal"
        actions={
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link href="/expenses/new">
              <Plus className="size-4" />
              Tambah
            </Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6">
        <PeriodFilter
          currentPeriod={ctx.current}
          previousPeriod={ctx.previous}
          preset={ctx.preset}
          range={ctx.range}
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total Spending" value={formatIDR(summary.total)} tone="accent" />
          <StatCard label="Transactions" value={summary.count} />
          <StatCard label="Average Spending" value={formatIDR(summary.average)} />
          <StatCard label="Largest Spending" value={formatIDR(summary.largest)} />
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5 text-[13px]">
            <div>
              <p className="text-muted-foreground">Rentang aktif</p>
              <p className="font-semibold">
                {ctx.range ? formatRangeLabel(ctx.range) : "Semua waktu"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground">Total all time</p>
              <p className="font-semibold">{formatIDR(allTimeTotal)}</p>
            </div>
            <Badge variant="muted">{allTime.length} transaksi all time</Badge>
          </CardContent>
        </Card>

        {summary.overTime.length > 1 && (
          <ChartFrame title="Spending Over Time" description={`Transaksi ${memberName} pada rentang aktif`}>
            <SpendingLineChart data={summary.overTime} height={240} />
          </ChartFrame>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-semibold">Tidak ada transaksi di rentang ini</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Coba pilih &quot;All Time&quot; atau rentang tanggal lain.
                </p>
              </div>
            ) : (
              <ol className="relative space-y-4 border-l border-border/70 pl-5">
                {timeline.map((expense) => (
                  <li key={expense.id} className="relative">
                    <span
                      className="absolute -left-[26px] top-1 flex size-3 items-center justify-center rounded-full ring-4 ring-card"
                      style={{ backgroundColor: categoryColor(expense.category) }}
                      aria-hidden
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold">{formatDateLong(expense.expenseDate)}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                            <CategoryIcon category={expense.category} className="size-3.5" />
                            {categoryLabel(expense.category)}
                          </span>
                          <Badge variant="outline">{idolDisplayName(expense)}</Badge>
                        </div>
                        {expense.note && (
                          <p className="text-muted-foreground mt-1.5 text-xs italic">“{expense.note}”</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[13.5px] font-bold tabular-nums">{formatIDR(expense.amount)}</p>
                        <Link
                          href={`/expenses/${expense.id}/edit`}
                          className="text-primary inline-flex items-center gap-1 text-[11px] font-semibold hover:underline"
                        >
                          Edit
                          <ArrowRight className="size-3" />
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-center text-xs">
          Nama member dinormalisasi otomatis (trim + uppercase) baik di frontend maupun backend, jadi{" "}
          <span className="font-semibold">{slugify(memberName)}</span> selalu jadi satu entri yang sama.
        </p>
      </div>
    </>
  );
}
