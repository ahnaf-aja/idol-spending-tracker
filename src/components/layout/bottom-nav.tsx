"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { NAV_ITEMS, isActive } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

const ITEMS = NAV_ITEMS.filter((item) => item.primary);

/**
 * Mobile bottom navigation (requirement 42). The "+ Add" button sits in the
 * middle and is elevated so it is the easiest target for one-handed use.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigasi bawah"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/85 backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex max-w-lg items-end justify-around px-1 pb-1.5 pt-1.5">
        {ITEMS.map((item) => {
          if (item.href === "/expenses/new") return null;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-[56px] flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10.5px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-[21px]" strokeWidth={active ? 2.4 : 1.9} />
              {item.shortLabel}
            </Link>
          );
        })}
      </div>

      {/* Center add button, raised above the bar */}
      <Link
        href="/expenses/new"
        aria-label="Tambah pengeluaran"
        className="bg-primary text-primary-foreground absolute -top-5 left-1/2 flex size-14 -translate-x-1/2 items-center justify-center rounded-2xl shadow-lg shadow-primary/30 transition active:scale-95"
      >
        <Plus className="size-6" strokeWidth={2.6} />
      </Link>
    </nav>
  );
}
