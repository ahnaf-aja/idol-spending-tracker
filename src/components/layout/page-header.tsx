"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Renders a back chevron linking here. */
  backHref?: string;
  actions?: ReactNode;
  /** Route whose detail page needs a back link (used to resolve a sensible default). */
  children?: ReactNode;
}

/**
 * Sticky page header. On mobile it holds the "More" drawer trigger; on desktop
 * the sidebar owns navigation, so the header is just a title bar.
 */
export function PageHeader({ title, subtitle, backHref, actions, children }: PageHeaderProps) {
  const pathname = usePathname();
  void pathname;

  return (
    <div className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3.5 sm:px-6 lg:py-4">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Kembali"
            className="hover:bg-accent -ml-1.5 flex size-9 shrink-0 items-center justify-center rounded-xl transition"
          >
            <ChevronLeft className="size-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-bold tracking-tight lg:text-xl">{title}</h1>
          {subtitle && <div className="text-muted-foreground mt-0.5 text-[12.5px]">{subtitle}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        {children}
      </div>
    </div>
  );
}
