/**
 * Period engine.
 *
 * The app's monthly cycle does NOT follow day 1..end-of-month. It runs from the
 * 25th to the 24th of the following month:
 *
 *   25 Sep - 24 Oct, 25 Oct - 24 Nov, 25 Nov - 24 Dec, 25 Dec - 24 Jan (next year)
 *
 * All arithmetic happens on plain "YYYY-MM-DD" calendar strings, never on UTC
 * timestamps, so a transaction can never drift to another day because of a
 * timezone conversion. Dates only meet JS `Date` objects at the database
 * boundary, always pinned to UTC midnight.
 */

export const PERIOD_START_DAY = 25;

/** A calendar date with no time component: "YYYY-MM-DD". */
export type DateOnly = string;

export interface Period {
  start: DateOnly;
  end: DateOnly;
}

/** An inclusive calendar range. */
export interface DateRange {
  start: DateOnly;
  end: DateOnly;
}

const pad = (n: number) => String(n).padStart(2, "0");

export const SHORT_MONTHS_ID = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
] as const;

export const LONG_MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
] as const;

export function daysInMonth(year: number, month: number): number {
  // month is 1-based; day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Build a DateOnly, normalising overflow/underflow months and short months. */
export function makeDateOnly(year: number, month: number, day: number): DateOnly {
  const y = year + Math.floor((month - 1) / 12);
  const m = ((((month - 1) % 12) + 12) % 12) + 1;
  const maxDay = daysInMonth(y, m);
  return `${pad(y)}-${pad(m)}-${pad(Math.min(day, maxDay))}`;
}

export function isDateOnly(value: unknown): value is DateOnly {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12) return false;
  return d >= 1 && d <= daysInMonth(y, m);
}

export function addMonths(date: DateOnly, delta: number): DateOnly {
  const [y, m, d] = date.split("-").map(Number);
  return makeDateOnly(y, m + delta, d);
}

export function addDays(date: DateOnly, delta: number): DateOnly {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + delta));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** The period (25th .. 24th) that contains the given calendar date. */
export function getPeriodForDate(date: DateOnly): Period {
  const [y, m, d] = date.split("-").map(Number);
  if (d >= PERIOD_START_DAY) {
    return {
      start: makeDateOnly(y, m, PERIOD_START_DAY),
      end: makeDateOnly(y, m + 1, PERIOD_START_DAY - 1),
    };
  }
  return {
    start: makeDateOnly(y, m - 1, PERIOD_START_DAY),
    end: makeDateOnly(y, m, PERIOD_START_DAY - 1),
  };
}

export const previousPeriod = (p: Period): Period => ({
  start: addMonths(p.start, -1),
  end: addMonths(p.end, -1),
});

export const nextPeriod = (p: Period): Period => ({
  start: addMonths(p.start, 1),
  end: addMonths(p.end, 1),
});

/** ISO date strings compare correctly with plain string operators. */
export const periodContains = (p: Period, date: DateOnly): boolean =>
  date >= p.start && date <= p.end;

export const periodsEqual = (a: Period, b: Period): boolean =>
  a.start === b.start && a.end === b.end;

export const periodKey = (p: Period): string => `${p.start}_${p.end}`;

export const periodFromKey = (key: string): Period | null => {
  const [start, end] = key.split("_");
  if (!isDateOnly(start) || !isDateOnly(end)) return null;
  return { start, end };
};

/** Every period from `from` to `to` inclusive (newest periods can be reversed by the caller). */
export function eachPeriod(from: Period, to: Period, limit = 600): Period[] {
  const out: Period[] = [];
  let cursor: Period = { ...from };
  while (cursor.start <= to.start && out.length < limit) {
    out.push({ ...cursor });
    cursor = nextPeriod(cursor);
  }
  return out;
}

/** Number of calendar days covered by a range (inclusive). */
export function rangeLengthInDays(range: DateRange): number {
  const a = Date.parse(`${range.start}T00:00:00Z`);
  const b = Date.parse(`${range.end}T00:00:00Z`);
  return Math.floor((b - a) / 86_400_000) + 1;
}

// ---------------------------------------------------------------------------
// Formatting (Indonesian)
// ---------------------------------------------------------------------------

export function formatDateShort(date: DateOnly): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${SHORT_MONTHS_ID[m - 1]} ${y}`;
}

export function formatDateLong(date: DateOnly): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${LONG_MONTHS_ID[m - 1]} ${y}`;
}

export function formatDateNumeric(date: DateOnly): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${pad(d)}/${pad(m)}/${y}`;
}

export function formatMonthYearShort(date: DateOnly): string {
  const [y, m] = date.split("-").map(Number);
  return `${SHORT_MONTHS_ID[m - 1]} ${y}`;
}

/** "25 Sep - 24 Okt 2026" (collapses the year when both ends share it). */
export function formatPeriodLabel(p: Period, opts: { long?: boolean } = {}): string {
  const months = opts.long ? LONG_MONTHS_ID : SHORT_MONTHS_ID;
  const [sy, sm, sd] = p.start.split("-").map(Number);
  const [ey, em, ed] = p.end.split("-").map(Number);
  const left = `${sd} ${months[sm - 1]}${sy !== ey ? ` ${sy}` : ""}`;
  const right = `${ed} ${months[em - 1]} ${ey}`;
  return `${left} – ${right}`;
}

/** "25 Sep 2026 – 24 Okt 2026" (always shows both years). */
export function formatRangeLabel(r: DateRange): string {
  return `${formatDateShort(r.start)} – ${formatDateShort(r.end)}`;
}

// ---------------------------------------------------------------------------
// "Today" and the UTC boundary used by the database
// ---------------------------------------------------------------------------

export const APP_TIMEZONE = "Asia/Jakarta";

/** Today's calendar date in the app timezone (not the server's). */
export function todayDateOnly(timeZone: string = APP_TIMEZONE): DateOnly {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const currentPeriod = (timeZone: string = APP_TIMEZONE): Period =>
  getPeriodForDate(todayDateOnly(timeZone));

/** DateOnly -> the UTC-midnight Date that Prisma stores in a `DATE` column. */
export const dateOnlyToUTC = (date: DateOnly): Date =>
  new Date(`${date}T00:00:00.000Z`);

/** Prisma `DATE` value -> DateOnly, read back through UTC so it never shifts. */
export function utcToDateOnly(value: Date | string): DateOnly {
  if (typeof value === "string") return value.slice(0, 10);
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

// ---------------------------------------------------------------------------
// Filter presets shared by client and server
// ---------------------------------------------------------------------------

export type RangePreset = "current" | "previous" | "all" | "custom";

export interface RangePresetInput {
  preset?: string | null;
  start?: string | null;
  end?: string | null;
  today?: DateOnly;
}

/**
 * Resolve a filter preset into a concrete range. `null` means "all time"
 * (no date restriction at all).
 */
export function resolveRange(input: RangePresetInput): DateRange | null {
  const today = input.today ?? todayDateOnly();
  const preset = (input.preset ?? "current") as RangePreset;

  if (preset === "all") return null;

  if (preset === "custom") {
    let start = isDateOnly(input.start) ? input.start : null;
    let end = isDateOnly(input.end) ? input.end : null;
    if (!start && !end) return getPeriodForDate(today);
    start ??= end!;
    end ??= start!;
    return start <= end ? { start, end } : { start: end, end: start };
  }

  const period = getPeriodForDate(today);
  if (preset === "previous") return previousPeriod(period);
  return period;
}

/**
 * Percentage change between two totals. Returns `null` when there is no useful
 * comparison (previous total is 0), which the UI renders as a neutral state
 * instead of "Infinity%" or "NaN".
 */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
