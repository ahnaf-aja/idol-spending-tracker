import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentProps<"div"> {
  value: number;
  max?: number;
  /** Visual state; "over" paints the overflow bar in red. */
  tone?: "default" | "success" | "warning" | "over";
}

const toneClasses: Record<NonNullable<ProgressProps["tone"]>, string> = {
  default: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  over: "bg-destructive",
};

function Progress({ value, max = 100, tone = "default", className, ...props }: ProgressProps) {
  const percent = max > 0 ? Math.min(Math.max((value / max) * 100, 0), 100) : 0;
  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("bg-muted relative h-2.5 w-full overflow-hidden rounded-full", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn("h-full rounded-full transition-all duration-500 ease-out", toneClasses[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export { Progress };
