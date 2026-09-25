"use client";

import * as React from "react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import { id as indonesian } from "date-fns/locale";
import "react-day-picker/style.css";

import { cn } from "@/lib/utils";

/**
 * Date-only calendar.
 *
 * The picker works on `YYYY-MM-DD` strings and converts to/from local Date
 * objects, so a chosen day never shifts because of a timezone conversion.
 */

export function dateOnlyToPickerDate(date: string | null | undefined): Date | undefined {
  if (!date) return undefined;
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 12, 0, 0); // midday avoids any DST edge at midnight
}

export function pickerDateToDateOnly(date: Date | undefined): string | null {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: DayPickerProps) {
  return (
    <DayPicker
      locale={indonesian}
      showOutsideDays={showOutsideDays}
      className={cn("p-0 text-sm", className)}
      classNames={{
        months: "relative flex flex-col gap-4",
        month: "flex flex-col gap-3",
        month_caption: "flex h-9 items-center justify-center px-9",
        caption_label: "text-sm font-semibold capitalize",
        nav: "absolute inset-x-0 top-0 flex items-center justify-between",
        button_previous:
          "inline-flex size-9 items-center justify-center rounded-lg border border-border bg-transparent opacity-80 transition hover:bg-accent hover:opacity-100",
        button_next:
          "inline-flex size-9 items-center justify-center rounded-lg border border-border bg-transparent opacity-80 transition hover:bg-accent hover:opacity-100",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground w-9 text-[11px] font-medium uppercase",
        week: "mt-1 flex w-full",
        day: "size-9 p-0 text-center",
        day_button:
          "inline-flex size-9 items-center justify-center rounded-lg text-sm font-medium transition hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/30 outline-none",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:font-semibold",
        today: "[&>button]:ring-1 [&>button]:ring-primary/40",
        outside: "text-muted-foreground/40",
        disabled: "opacity-35",
        hidden: "invisible",
        ...classNames,
      }}
      {...props}
    />
  );
}
