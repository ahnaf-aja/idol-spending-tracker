/**
 * Turns URL search params into a concrete date range plus the period context
 * every page needs (current 25-period, previous 25-period, comparison range).
 */

import {
  addDays,
  currentPeriod,
  getPeriodForDate,
  isDateOnly,
  previousPeriod,
  rangeLengthInDays,
  resolveRange,
  todayDateOnly,
  type DateOnly,
  type DateRange,
  type Period,
} from "@/lib/period";

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export type RangePresetName = "current" | "previous" | "custom" | "all";

export interface RangeContext {
  preset: RangePresetName;
  /** null = all time (no restriction) */
  range: DateRange | null;
  current: Period;
  previous: Period;
  /** Range used for the period-over-period comparison. null = not comparable. */
  comparisonRange: DateRange | null;
  comparisonLabel: string;
}

const first = (value: string | string[] | undefined): string | null =>
  Array.isArray(value) ? value[0] ?? null : (value ?? null);

export function rangeContextFromParams(params: SearchParamsInput, today = todayDateOnly()): RangeContext {
  const presetParam = first(params.preset);
  const preset: RangePresetName =
    presetParam === "previous" || presetParam === "custom" || presetParam === "all"
      ? presetParam
      : "current";

  const start = first(params.start);
  const end = first(params.end);

  const range = resolveRange({
    preset,
    start: start && isDateOnly(start) ? start : null,
    end: end && isDateOnly(end) ? end : null,
    today,
  });

  const current = getPeriodForDate(today);
  const previous = previousPeriod(current);

  let comparisonRange: DateRange | null = null;
  let comparisonLabel = "periode sebelumnya";

  if (range) {
    if (range.start === current.start && range.end === current.end) {
      comparisonRange = previous;
      comparisonLabel = "periode sebelumnya";
    } else if (range.start === previous.start && range.end === previous.end) {
      comparisonRange = previousPeriod(previous);
      comparisonLabel = "periode sebelum itu";
    } else {
      // Custom range: compare with the equally long range right before it.
      const length = rangeLengthInDays(range);
      comparisonRange = { start: addDays(range.start, -length), end: addDays(range.start, -1) };
      comparisonLabel = "rentang sebelumnya";
    }
  }

  return { preset, range, current, previous, comparisonRange, comparisonLabel };
}

/** "25 Sep – 24 Okt 2026" style label for the selected range. */
export { currentPeriod };

/** True when a date-only string falls inside the range (null = everything). */
export function inRange(date: DateOnly, range: DateRange | null): boolean {
  if (!range) return true;
  return date >= range.start && date <= range.end;
}
