/**
 * Single source of truth for the expense taxonomy, shared by the forms, the
 * filters, the charts and the seed/test factories.
 */

export const IDOL_TYPES = ["JKT48", "TNT", "OTHER"] as const;
export type IdolType = (typeof IDOL_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "SHOW",
  "GIFT_BARANG",
  "GIFT_LIVE",
  "CHEKI",
  "MNG",
  "TWO_SHOT",
  "VC",
  "TOP_UP_POINT",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface CategoryMeta {
  value: ExpenseCategory;
  label: string;
  /** lucide-react icon name, resolved in the UI. */
  icon: string;
  color: string;
}

/** Chart palette tuned to stay readable on both light and dark backgrounds. */
export const CATEGORY_META: Record<ExpenseCategory, CategoryMeta> = {
  SHOW: { value: "SHOW", label: "Show", icon: "Ticket", color: "#6366f1" },
  GIFT_BARANG: { value: "GIFT_BARANG", label: "Gift Barang", icon: "Gift", color: "#ec4899" },
  GIFT_LIVE: { value: "GIFT_LIVE", label: "Gift Live", icon: "Radio", color: "#f59e0b" },
  CHEKI: { value: "CHEKI", label: "Cheki", icon: "Camera", color: "#10b981" },
  MNG: { value: "MNG", label: "MNG", icon: "Handshake", color: "#06b6d4" },
  TWO_SHOT: { value: "TWO_SHOT", label: "2S", icon: "Users", color: "#8b5cf6" },
  VC: { value: "VC", label: "VC", icon: "Video", color: "#ef4444" },
  TOP_UP_POINT: {
    value: "TOP_UP_POINT",
    label: "Top Up Point",
    icon: "Coins",
    color: "#0ea5e9",
  },
};

export const CATEGORY_OPTIONS = EXPENSE_CATEGORIES.map((value) => CATEGORY_META[value]);

export const IDOL_OPTIONS: { value: IdolType; label: string; hint: string }[] = [
  { value: "JKT48", label: "JKT48", hint: "Teater & event JKT48" },
  { value: "TNT", label: "TNT", hint: "Teater & event TNT" },
  { value: "OTHER", label: "Other", hint: "Idol / group lain" },
];

export const CHART_PALETTE = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#8b5cf6",
  "#ef4444",
  "#84cc16",
  "#f97316",
  "#14b8a6",
];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c, CATEGORY_META[c].label]),
);

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string" && (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function isIdolType(value: unknown): value is IdolType {
  return typeof value === "string" && (IDOL_TYPES as readonly string[]).includes(value);
}

export function categoryLabel(value: string): string {
  return CATEGORY_LABELS[value] ?? value;
}

export function categoryColor(value: string): string {
  return CATEGORY_META[value as ExpenseCategory]?.color ?? "#94a3b8";
}

/** What the user sees for an expense's idol: the custom name when set, never "Other". */
export function idolDisplayName(expense: {
  idolType: string;
  customIdolName?: string | null;
}): string {
  if (expense.idolType === "OTHER") {
    return expense.customIdolName?.trim() || "Other";
  }
  return expense.idolType;
}

/** Stable slug used for chart keys / url params. */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
