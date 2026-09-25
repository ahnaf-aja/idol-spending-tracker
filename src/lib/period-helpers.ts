/**
 * Small helpers shared by the server actions. Kept as a thin barrel over
 * `period.ts` so server code has one import site.
 */

export {
  APP_TIMEZONE,
  PERIOD_START_DAY,
  addDays,
  addMonths,
  currentPeriod,
  dateOnlyToUTC,
  daysInMonth,
  eachPeriod,
  formatDateLong,
  formatDateNumeric,
  formatDateShort,
  formatPeriodLabel,
  formatRangeLabel,
  getPeriodForDate,
  isDateOnly,
  nextPeriod,
  percentChange,
  periodFromKey,
  previousPeriod,
  rangeLengthInDays,
  resolveRange,
  todayDateOnly,
  utcToDateOnly,
} from "@/lib/period";

export type { DateOnly, DateRange, Period } from "@/lib/period";

/** Returns a valid DateOnly or null (used to sanitise URL params). */
export function parseDateOnlyOrNull(value: unknown): string | null {
  return typeof value === "string" && isDateOnlyString(value) ? value : null;
}

function isDateOnlyString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12) return false;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d >= 1 && d <= lastDay;
}
