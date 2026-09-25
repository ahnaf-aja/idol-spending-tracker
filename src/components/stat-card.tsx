import { cn } from "@/lib/utils";
import { formatIDR } from "@/lib/currency";

/** A KPI tile used across the dashboard, statistics, budget and profile pages. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "danger" | "accent";
  className?: string;
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    danger: "text-destructive",
    accent: "text-primary",
  }[tone];

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-4 shadow-sm shadow-black/[0.03] sm:p-5 dark:shadow-black/20",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground text-[13px] font-medium">{label}</p>
        {icon && <span className="text-muted-foreground/70 shrink-0">{icon}</span>}
      </div>
      <p className={cn("mt-2 text-xl font-bold tracking-tight sm:text-2xl", toneClass)}>{value}</p>
      {hint && <div className="text-muted-foreground mt-1 text-xs leading-relaxed">{hint}</div>}
    </div>
  );
}

/** Convenience wrapper when the value is a rupiah amount. */
export function AmountCard(props: { amount: number } & Omit<Parameters<typeof StatCard>[0], "value">) {
  const { amount, ...rest } = props;
  return <StatCard {...rest} value={formatIDR(amount)} />;
}
