/**
 * IDR formatting. Amounts are always whole rupiah (no decimals anywhere in the
 * app, including the database column, which is an integer of rupiah).
 *
 *   150000    -> "Rp150.000"
 *   1250000   -> "Rp1.250.000"
 *   10500000  -> "Rp10.500.000"
 */

const grouping = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

/** "Rp150.000" - no space, Indonesian thousand separators. */
export function formatIDR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "Rp0";
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? "-" : "";
  return `${sign}Rp${grouping.format(Math.abs(rounded))}`;
}

/**
 * "150.000" - the number without the Rp prefix, for inputs.
 * Zero and empty are both rendered as "" so the field shows its placeholder.
 */
export function formatIDRDigits(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount === 0) return "";
  return grouping.format(Math.round(amount));
}

/**
 * Parse user input into whole rupiah.
 * Accepts "150000", "150.000", "Rp 150 000", "1.250.000".
 * Returns 0 for anything unparsable so callers can validate explicitly.
 */
export function parseIDRInput(input: string | number | null | undefined): number {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input) : 0;
  if (typeof input !== "string") return 0;
  const digits = input.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const value = Number.parseInt(digits, 10);
  return Number.isFinite(value) ? value : 0;
}

/** Compact form used inside chart labels: "1,2jt" / "Rp450rb". */
export function formatIDRCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `Rp${(amount / 1_000_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000_000) return `Rp${(amount / 1_000_000).toFixed(1).replace(".", ",")}jt`;
  if (abs >= 1_000) return `Rp${Math.round(amount / 1_000)}rb`;
  return formatIDR(amount);
}
