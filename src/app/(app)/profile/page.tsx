import type { Metadata } from "next";
import { CalendarDays, Mail, Tag, UserRound, Wallet } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/categories";
import { formatIDR } from "@/lib/currency";
import { getProfileStats } from "@/lib/queries";
import { formatDateLong } from "@/lib/period";
import { ChangePasswordDialog, LogoutButton } from "./profile-forms";
import { logoutAction } from "@/lib/actions/auth-actions";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const stats = await getProfileStats(user.id);

  return (
    <>
      <PageHeader title="Profile" subtitle={`@${user.username}`} />

      <div className="mx-auto max-w-4xl space-y-5 px-4 py-5 sm:px-6">
        {/* Identity */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-4">
              <span className="bg-primary/12 text-primary flex size-14 items-center justify-center rounded-2xl text-lg font-bold uppercase">
                {user.username.slice(0, 2)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold tracking-tight">{user.username}</p>
                <p className="text-muted-foreground flex items-center gap-1.5 truncate text-sm">
                  <Mail className="size-3.5 shrink-0" />
                  {user.email}
                </p>
              </div>
            </div>

            <dl className="mt-5 grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-2">
              <div className="flex items-center gap-2.5">
                <UserRound className="text-muted-foreground size-4" />
                <div>
                  <dt className="text-muted-foreground text-xs">Username</dt>
                  <dd className="text-[13.5px] font-medium">{user.username}</dd>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <CalendarDays className="text-muted-foreground size-4" />
                <div>
                  <dt className="text-muted-foreground text-xs">Account Created</dt>
                  <dd className="text-[13.5px] font-medium">{formatDateLong(user.createdAt.toISOString().slice(0, 10))}</dd>
                </div>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Lifetime stats */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard
            label="Total Spending All Time"
            value={formatIDR(stats.totalSpent)}
            tone="accent"
            icon={<Wallet className="size-4" />}
          />
          <StatCard label="Total Transactions" value={stats.totalTransactions} />
          <StatCard
            label="Most Frequent Category"
            value={
              stats.mostFrequentCategory ? categoryLabel(stats.mostFrequentCategory.category) : "—"
            }
            hint={
              stats.mostFrequentCategory
                ? `${stats.mostFrequentCategory.count} transaksi`
                : "Belum ada transaksi"
            }
            icon={<Tag className="size-4" />}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tampilan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground text-xs">
              Preferensi tema disimpan di perangkat ini (localStorage) dan langsung dipakai oleh semua chart.
            </p>
            <ThemeToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Keamanan &amp; Sesi</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ChangePasswordDialog />
            <LogoutButton action={logoutAction} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
