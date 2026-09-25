import type { Metadata } from "next";

import { ChartFrame, DonutChart, MemberBarChart, SpendingLineChart } from "@/components/charts";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { formatIDR } from "@/lib/currency";
import { listExpenses } from "@/lib/expenses/repository";
import { rangeContextFromParams, type SearchParamsInput } from "@/lib/filters";
import { formatRangeLabel, formatPeriodLabel } from "@/lib/period";
import { summarize } from "@/lib/stats";
import { Receipt } from "lucide-react";

export const metadata: Metadata = { title: "Statistics" };

export default async function StatisticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const ctx = rangeContextFromParams(params);

  const [expenses, allTimeCount] = await Promise.all([
    listExpenses(user.id, { range: ctx.range, order: "asc" }),
    listExpenses(user.id, { range: null, order: "desc" }),
  ]);

  const summary = summarize(expenses);
  const rangeLabel = ctx.range ? formatRangeLabel(ctx.range) : "Semua waktu";

  return (
    <>
      <PageHeader
        title="Statistics"
        subtitle={
          ctx.preset === "current" ? formatPeriodLabel(ctx.current) : rangeLabel
        }
      />

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        <PeriodFilter
          currentPeriod={ctx.current}
          previousPeriod={ctx.previous}
          preset={ctx.preset}
          range={ctx.range}
        />

        {allTimeCount.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Belum ada data untuk dianalisis 👀"
            description="Statistik muncul otomatis setelah kamu mencatat pengeluaran pertama."
            action={{ label: "+ Tambah Pengeluaran", href: "/expenses/new" }}
          />
        ) : summary.count === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Tidak ada transaksi di rentang ini"
            description="Coba pilih periode lain atau atur custom date untuk melihat statistiknya."
            action={{ label: "Reset Filter", href: "/statistics" }}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total Spending" value={formatIDR(summary.total)} tone="accent" />
              <StatCard label="Average / Transaction" value={formatIDR(summary.average)} />
              <StatCard label="Total Transactions" value={summary.count} />
              <StatCard label="Largest Transaction" value={formatIDR(summary.largest)} />
            </div>

            <ChartFrame
              title="Spending Over Time"
              description={`Total harian · ${rangeLabel}`}
              height={280}
            >
              <SpendingLineChart data={summary.overTime} height={280} />
            </ChartFrame>

            <div className="grid gap-4 lg:grid-cols-2">
              <ChartFrame title="Spending by Category" description="Donut per kategori">
                <DonutChart data={summary.byCategory} total={summary.total} />
              </ChartFrame>
              <ChartFrame title="Spending by Member" description="Termasuk NO MEMBER">
                <MemberBarChart data={summary.byMember} />
              </ChartFrame>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Spending by Idol</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {summary.byIdol.map((slice) => (
                  <div key={slice.key}>
                    <div className="flex items-center justify-between gap-3 text-[13.5px]">
                      <span className="min-w-0 truncate font-medium">{slice.label}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatIDR(slice.amount)}
                        <span className="text-muted-foreground ml-2 font-normal">
                          {(slice.share * 100).toFixed(0)}%
                        </span>
                      </span>
                    </div>
                    <div className="bg-muted mt-1.5 h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.max(slice.share * 100, 2)}%`,
                          backgroundColor: slice.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rincian per Kategori</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary.byCategory.map((slice) => (
                  <div
                    key={slice.key}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 text-[13.5px] odd:bg-muted/40"
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                    <span className="min-w-0 flex-1 truncate font-medium">{slice.label}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">{slice.count}×</span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatIDR(slice.amount)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
