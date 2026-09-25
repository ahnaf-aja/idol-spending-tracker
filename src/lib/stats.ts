/**
 * Pure aggregation over expense rows. Used by the dashboard, statistics,
 * history period grouping and the member journal, so every screen computes the
 * same numbers from the same code.
 */

import { CHART_PALETTE, categoryLabel, idolDisplayName } from "./categories";
import { NO_MEMBER_LABEL } from "./normalize";
import type { DateOnly } from "./period";
import { formatDateShort } from "./period";

export interface ExpenseLike {
  id: string;
  idolType: string;
  customIdolName?: string | null;
  memberName?: string | null;
  category: string;
  amount: number;
  expenseDate: DateOnly;
  note?: string | null;
}

export interface Slice {
  key: string;
  label: string;
  amount: number;
  count: number;
  share: number;
  color: string;
}

export interface Summary {
  total: number;
  count: number;
  largest: number;
  average: number;
  topCategory: Slice | null;
  topMember: Slice | null;
  byCategory: Slice[];
  byIdol: Slice[];
  byMember: Slice[];
  overTime: { date: DateOnly; label: string; amount: number; count: number }[];
}

const byLabel = (a: Slice, b: Slice) => b.amount - a.amount;

function toSlices(entries: Map<string, { label: string; amount: number; count: number }>, total: number): Slice[] {
  return [...entries.entries()]
    .map(([key, value], index) => ({
      key,
      label: value.label,
      amount: value.amount,
      count: value.count,
      share: total > 0 ? value.amount / total : 0,
      color: CHART_PALETTE[index % CHART_PALETTE.length],
    }))
    .sort(byLabel);
}

function accumulate<T extends string>(
  map: Map<string, { label: string; amount: number; count: number }>,
  key: T,
  label: string,
  amount: number,
) {
  const existing = map.get(key);
  if (existing) {
    existing.amount += amount;
    existing.count += 1;
  } else {
    map.set(key, { label, amount, count: 1 });
  }
}

export function summarize(expenses: ExpenseLike[]): Summary {
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const categories = new Map<string, { label: string; amount: number; count: number }>();
  const idols = new Map<string, { label: string; amount: number; count: number }>();
  const members = new Map<string, { label: string; amount: number; count: number }>();
  const days = new Map<string, { label: string; amount: number; count: number }>();

  for (const expense of expenses) {
    accumulate(categories, expense.category, categoryLabel(expense.category), expense.amount);

    const idol = idolDisplayName(expense);
    accumulate(idols, idol, idol, expense.amount);

    const member = expense.memberName?.trim() || NO_MEMBER_LABEL;
    accumulate(members, member, member, expense.amount);

    accumulate(days, expense.expenseDate, formatDateShort(expense.expenseDate), expense.amount);
  }

  const byCategory = toSlices(categories, total);
  const byIdol = toSlices(idols, total);
  const byMember = toSlices(members, total);
  const overTime = [...days.entries()]
    .map(([date, value]) => ({ date, label: value.label, amount: value.amount, count: value.count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return {
    total,
    count: expenses.length,
    largest: expenses.reduce((max, e) => (e.amount > max ? e.amount : max), 0),
    average: expenses.length ? Math.round(total / expenses.length) : 0,
    topCategory: byCategory[0] ?? null,
    // "Member terbesar" only considers real members: NO MEMBER is a bucket for
    // member-less transactions, not someone to put on the leaderboard.
    topMember: byMember.find((slice) => slice.key !== NO_MEMBER_LABEL) ?? null,
    byCategory,
    byIdol,
    byMember,
    overTime,
  };
}

/** Buckets expenses into the 25..24 periods, newest first. */
export function groupByPeriod<T extends ExpenseLike>(
  expenses: T[],
  getPeriod: (date: DateOnly) => { start: DateOnly; end: DateOnly },
) {
  const buckets = new Map<string, { start: DateOnly; end: DateOnly; expenses: T[] }>();
  for (const expense of expenses) {
    const period = getPeriod(expense.expenseDate);
    const key = `${period.start}_${period.end}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.expenses.push(expense);
    else buckets.set(key, { ...period, expenses: [expense] });
  }
  return [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      start: bucket.start,
      end: bucket.end,
      total: bucket.expenses.reduce((sum, e) => sum + e.amount, 0),
      count: bucket.expenses.length,
      expenses: bucket.expenses,
    }))
    .sort((a, b) => (a.start < b.start ? 1 : -1));
}

export interface MemberGroup {
  name: string;
  idol: string;
  amount: number;
  count: number;
  largest: number;
  average: number;
  lastDate: DateOnly | null;
  firstDate: DateOnly | null;
}

/** Member journal rows, derived from the user's own transactions only. */
export function groupByMember(expenses: ExpenseLike[]): MemberGroup[] {
  const map = new Map<string, MemberGroup>();
  for (const expense of expenses) {
    const name = expense.memberName?.trim();
    if (!name) continue; // transactions without a member are not journal entries
    const existing = map.get(name);
    if (existing) {
      existing.amount += expense.amount;
      existing.count += 1;
      existing.largest = Math.max(existing.largest, expense.amount);
      if (!existing.lastDate || expense.expenseDate > existing.lastDate) existing.lastDate = expense.expenseDate;
      if (!existing.firstDate || expense.expenseDate < existing.firstDate) existing.firstDate = expense.expenseDate;
      existing.average = Math.round(existing.amount / existing.count);
    } else {
      map.set(name, {
        name,
        idol: idolDisplayName(expense),
        amount: expense.amount,
        count: 1,
        largest: expense.amount,
        average: expense.amount,
        lastDate: expense.expenseDate,
        firstDate: expense.expenseDate,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}

export interface BudgetProgress {
  amount: number;
  spent: number;
  remaining: number;
  over: number;
  percent: number;
  isOver: boolean;
  hasBudget: boolean;
}

export function budgetProgress(budget: number | null, spent: number): BudgetProgress {
  const amount = budget ?? 0;
  const hasBudget = amount > 0;
  const remaining = Math.max(amount - spent, 0);
  const over = Math.max(spent - amount, 0);
  return {
    amount,
    spent,
    remaining,
    over,
    percent: hasBudget ? (spent / amount) * 100 : 0,
    isOver: hasBudget && spent > amount,
    hasBudget,
  };
}
