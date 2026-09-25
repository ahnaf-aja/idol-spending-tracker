"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { BRAND, NAV_ITEMS, isActive } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";
import { logoutAction } from "@/lib/actions/auth-actions";
import { cn } from "@/lib/utils";

/** Desktop sidebar navigation (requirement 43). */
export function AppSidebar({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-border/70 bg-card/40 lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl shadow-sm">
          <BRAND.icon className="size-[18px]" />
        </span>
        <div className="leading-tight">
          <p className="text-[13.5px] font-semibold tracking-tight">Idol Spending</p>
          <p className="text-muted-foreground text-[11px] font-medium">Tracker</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-3" aria-label="Navigasi utama">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon
                className={cn("size-[18px] shrink-0", active ? "text-primary" : "opacity-80")}
                strokeWidth={active ? 2.4 : 2}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-border/70 p-3">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <span className="bg-primary/12 text-primary flex size-9 items-center justify-center rounded-full text-[13px] font-bold uppercase">
            {username.slice(0, 2)}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[13px] font-semibold">{username}</p>
            <p className="text-muted-foreground text-[11px]">Owner</p>
          </div>
        </div>
        <ThemeToggle />
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
          >
            <LogOut className="size-[18px]" />
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
