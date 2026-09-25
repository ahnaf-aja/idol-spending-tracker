import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { PeriodFilter } from "@/components/period-filter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { formatIDR } from "@/lib/currency";
import { listExpenses } from "@/lib/expenses/repository";
import { rangeContextFromParams, type SearchParamsInput } from "@/lib/filters";
import { formatDateShort } from "@/lib/period";
import { groupByMember } from "@/lib/stats";

export const metadata: Metadata = { title: "Member Journal" };

/**
 * Member Journal (requirements 31-32). The member list is derived from the
 * user's own transactions, so "FREYA" and "Freya" can never appear as two
 * entries: the server normalises every name to uppercase before insert.
 */
export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsInput>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const ctx = rangeContextFromParams(params);

  const [expenses, allExpenses] = await Promise.all([
    listExpenses(user.id, { range: ctx.range, order: "desc" }),
    listExpenses(user.id, { range: null, order: "desc" }),
  ]);

  const members = groupByMember(expenses);
  const totalMemberSpend = members.reduce((sum, member) => sum + member.amount, 0);

  return (
    <>
      <PageHeader
        title="Member Journal"
        subtitle={`${members.length} member tercatat · ${formatIDR(totalMemberSpend)}`}
      />

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        <PeriodFilter
          currentPeriod={ctx.current}
          previousPeriod={ctx.previous}
          preset={ctx.preset}
          range={ctx.range}
        />

        {allExpenses.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Belum ada member tercatat"
            description="Journal terisi otomatis dari transaksi kamu. Tambahkan pengeluaran dengan nama member untuk mulai mengisi journal ini."
            action={{ label: "+ Tambah Pengeluaran", href: "/expenses/new" }}
          />
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Tidak ada transaksi member di rentang ini"
            description="Semua transaksi pada rentang ini tidak menyertakan nama member. Coba ubah filter tanggalnya."
            action={{ label: "Reset Filter", href: "/journal" }}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <Link key={member.name} href={`/journal/${encodeURIComponent(member.name)}`} className="group">
                <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-md">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-bold tracking-tight">{member.name}</p>
                        <Badge variant="outline" className="mt-1.5">
                          {member.idol}
                        </Badge>
                      </div>
                      <span className="bg-primary/12 text-primary flex size-10 items-center justify-center rounded-2xl text-[13px] font-bold">
                        {member.name.slice(0, 2)}
                      </span>
                    </div>

                    <div className="mt-4 space-y-1.5 border-t border-border/70 pt-3 text-[13px]">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Spending</span>
                        <span className="text-primary font-bold">{formatIDR(member.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Transactions</span>
                        <span className="font-semibold">{member.count}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Last Transaction</span>
                        <span className="font-medium">
                          {member.lastDate ? formatDateShort(member.lastDate) : "—"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
