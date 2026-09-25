"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu } from "lucide-react";

import { NAV_ITEMS, isActive } from "@/components/layout/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { logoutAction } from "@/lib/actions/auth-actions";
import { cn } from "@/lib/utils";

/** Mobile "More" menu: everything the bottom bar does not carry. */
export function MobileMoreMenu({ username }: { username: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu lainnya" className="lg:hidden">
          <Menu className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Menu</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
          <span className="bg-primary/12 text-primary flex size-10 items-center justify-center rounded-full text-sm font-bold uppercase">
            {username.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{username}</p>
            <p className="text-muted-foreground text-xs">Owner</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border border-border/70 px-3 py-3 text-[13px] font-medium transition",
                  active ? "bg-primary/10 text-primary border-primary/30" : "hover:bg-accent",
                )}
              >
                <item.icon className="size-4" />
                {item.shortLabel}
              </Link>
            );
          })}
        </div>

        <div className="space-y-3 pt-1">
          <ThemeToggle />
          <form action={logoutAction}>
            <Button type="submit" variant="outline" className="w-full justify-start text-destructive">
              <LogOut className="size-4" />
              Logout
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
