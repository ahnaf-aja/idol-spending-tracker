import type { LucideIcon } from "lucide-react";
import {
  ChartPie,
  History,
  LayoutDashboard,
  Plus,
  Sparkles,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar. */
  primary?: boolean;
}

/** Sidebar (desktop) and drawer order. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard, primary: true },
  { href: "/expenses/new", label: "Add Expense", shortLabel: "Add", icon: Plus },
  { href: "/history", label: "History", shortLabel: "History", icon: History, primary: true },
  { href: "/journal", label: "Member Journal", shortLabel: "Journal", icon: Users },
  { href: "/statistics", label: "Statistics", shortLabel: "Stats", icon: ChartPie, primary: true },
  { href: "/budget", label: "Budget", shortLabel: "Budget", icon: Wallet },
  { href: "/profile", label: "Profile", shortLabel: "Profile", icon: UserRound, primary: true },
];

export const BRAND = { name: "Idol Spending Tracker", icon: Sparkles };

/** Routes whose nav entry should light up for a given pathname. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}
