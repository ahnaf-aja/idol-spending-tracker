import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-background/60 placeholder:text-muted-foreground/70 flex field-sizing-content min-h-20 w-full rounded-xl border px-3.5 py-2.5 text-[15px] shadow-xs transition-[color,box-shadow] outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/25",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
