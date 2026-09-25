"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Light / Dark / System switch. The choice is persisted by next-themes in
 * localStorage and applied before paint, so there is no flash of the wrong
 * theme. Chart colors read the same `dark` class, so they stay readable.
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (compact) {
    const isDark = mounted ? resolvedTheme === "dark" : false;
    return (
      <button
        type="button"
        aria-label="Ganti tema"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="hover:bg-accent inline-flex size-10 items-center justify-center rounded-xl transition"
      >
        {isDark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema tampilan"
      className="bg-muted/60 inline-flex w-full items-center gap-1 rounded-xl p-1"
    >
      {OPTIONS.map((option) => {
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-medium transition",
              active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <option.icon className="size-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
