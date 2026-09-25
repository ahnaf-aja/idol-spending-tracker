"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { CalendarRange, ChevronDown, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar, dateOnlyToPickerDate, pickerDateToDateOnly } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRangeLabel, type DateRange, type Period } from "@/lib/period";
import { cn } from "@/lib/utils";

export type FilterPreset = "current" | "previous" | "custom" | "all";

interface PeriodFilterProps {
  currentPeriod: Period;
  previousPeriod: Period;
  preset: FilterPreset;
  range: DateRange | null;
  /** Which presets to offer. History additionally allows "all time". */
  allowAllTime?: boolean;
  className?: string;
}

const presetLabel = (preset: FilterPreset, current: Period, previous: Period, range: DateRange | null) => {
  switch (preset) {
    case "previous":
      return `Periode Sebelumnya · ${formatRangeLabel(previous)}`;
    case "all":
      return "All Time (semua transaksi)";
    case "custom":
      return range ? `Custom · ${formatRangeLabel(range)}` : "Custom Date";
    default:
      return `Periode Saat Ini · ${formatRangeLabel(current)}`;
  }
};

/**
 * The global date filter (requirement 21). It writes to the URL search params,
 * so every page (server-rendered) recomputes against the same range and a
 * filtered view is shareable/reloadable. "Reset Filter" simply returns to the
 * current 25-period - it never touches data.
 */
export function PeriodFilter({
  currentPeriod,
  previousPeriod,
  preset,
  range,
  allowAllTime = true,
  className,
}: PeriodFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const [draftStart, setDraftStart] = useState<Date | undefined>(
    dateOnlyToPickerDate(range?.start),
  );
  const [draftEnd, setDraftEnd] = useState<Date | undefined>(dateOnlyToPickerDate(range?.end));

  const push = useCallback(
    (params: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(params)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      startTransition(() => {
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const onPresetChange = (value: string) => {
    if (value === "custom") {
      setOpen(true);
      push({ preset: "custom", start: range?.start ?? currentPeriod.start, end: range?.end ?? currentPeriod.end });
      return;
    }
    // Period presets are fully determined by the preset name alone.
    push({ preset: value, start: null, end: null });
  };

  const applyCustom = () => {
    const start = pickerDateToDateOnly(draftStart) ?? currentPeriod.start;
    const end = pickerDateToDateOnly(draftEnd) ?? currentPeriod.end;
    push({ preset: "custom", start, end });
    setOpen(false);
  };

  const isDefault = preset === "current";
  const summary = useMemo(
    () => presetLabel(preset, currentPeriod, previousPeriod, range),
    [preset, currentPeriod, previousPeriod, range],
  );

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-center", className)}>
      <div className="flex items-center gap-2">
        <Select value={preset} onValueChange={onPresetChange}>
          <SelectTrigger
            className={cn("h-10 flex-1 text-[13px] sm:w-[230px] sm:flex-none", isPending && "opacity-60")}
            aria-label="Filter periode"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Periode Saat Ini</SelectItem>
            <SelectItem value="previous">Periode Sebelumnya</SelectItem>
            <SelectItem value="custom">Custom Date</SelectItem>
            {allowAllTime && <SelectItem value="all">All Time</SelectItem>}
          </SelectContent>
        </Select>

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 shrink-0 px-2.5" aria-label="Pilih rentang tanggal">
              <CalendarRange className="size-4" />
              <ChevronDown className="size-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-[calc(100vw-2rem)]" align="end">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date</Label>
                <Calendar
                  mode="single"
                  selected={draftStart}
                  onSelect={setDraftStart}
                  defaultMonth={draftStart ?? dateOnlyToPickerDate(currentPeriod.start)}
                />
              </div>
              <div className="space-y-1.5 border-t border-border pt-3">
                <Label className="text-xs">End Date</Label>
                <Calendar
                  mode="single"
                  selected={draftEnd}
                  onSelect={setDraftEnd}
                  defaultMonth={draftEnd ?? dateOnlyToPickerDate(currentPeriod.end)}
                />
              </div>
              <div className="flex items-center gap-2 border-t border-border pt-3">
                <Button size="sm" className="flex-1" onClick={applyCustom}>
                  Terapkan
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraftStart(undefined);
                    setDraftEnd(undefined);
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-muted-foreground flex-1 truncate text-xs font-medium sm:flex-none">{summary}</p>
        {!isDefault && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            onClick={() => push({ preset: null, start: null, end: null })}
            disabled={isPending}
          >
            <RotateCcw className="size-3.5" />
            Reset Filter
          </Button>
        )}
      </div>
    </div>
  );
}
