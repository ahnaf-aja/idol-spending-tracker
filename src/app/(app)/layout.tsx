import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileMoreMenu } from "@/components/layout/mobile-more-menu";
import { getSession } from "@/lib/auth/session";

/**
 * The authenticated shell.
 *
 * Middleware already blocks cookie-less requests, but this is the authoritative
 * check: the session token is verified against the database here, so a forged
 * or expired cookie never reaches a protected page.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");

  return (
    <div className="flex min-h-dvh">
      <AppSidebar username={session.user.username} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between px-4 pt-3.5 pb-1 lg:hidden">
          <div className="flex items-center gap-2.5">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
                <path
                  d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="text-[14px] font-semibold tracking-tight">Idol Spending</span>
          </div>
          <MobileMoreMenu username={session.user.username} />
        </header>

        <main className="min-w-0 flex-1 pb-28 lg:pb-0">{children}</main>
      </div>

      <BottomNav />
    </div>
  );
}
