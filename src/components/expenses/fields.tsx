"use client";

import * as React from "react";
import {
  Camera,
  Gift,
  Handshake,
  Radio,
  Ticket,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react";

import { formatIDR, formatIDRDigits, parseIDRInput } from "@/lib/currency";
import { CATEGORY_META } from "@/lib/categories";
import { cn } from "@/lib/utils";

/** Maps the string icon names in the taxonomy to real components. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Ticket,
  Gift,
  Radio,
  Camera,
  Handshake,
  Users,
  Video,
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const meta = CATEGORY_META[category as keyof typeof CATEGORY_META];
  const Icon = meta ? CATEGORY_ICONS[meta.icon] ?? Ticket : Ticket;
  return <Icon className={className} />;
}

/**
 * Currency input (requirements 15 & 47).
 *
 * The visible value is grouped ("1.250.000") while the submitted value is the
 * raw integer, so the server receives a plain number. Non-digits are ignored,
 * decimals are impossible, and the formatted preview sits underneath.
 */
export function CurrencyInput({
  name,
  value,
  onChange,
  id,
  invalid,
  autoFocus,
  placeholder = "150000",
}: {
  name: string;
  value: number;
  onChange: (value: number) => void;
  id?: string;
  invalid?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = React.useState(value ? formatIDRDigits(value) : "");

  // Keep the field in sync when the parent resets it (edit form load, step reset).
  React.useEffect(() => {
    const parsed = parseIDRInput(text);
    if (parsed !== value) setText(value ? formatIDRDigits(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div>
      <div className="relative">
        <span className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold">
          Rp
        </span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={text}
          onChange={(event) => {
            const digits = event.target.value.replace(/[^\d]/g, "");
            const next = digits ? Number.parseInt(digits, 10) : 0;
            setText(next ? formatIDRDigits(next) : "");
            onChange(next);
          }}
          aria-invalid={invalid}
          className={cn(
            "border-input bg-background/60 h-13 w-full rounded-xl border pl-10 pr-3.5 text-lg font-semibold tabular-nums shadow-xs outline-none transition",
            "placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:text-base",
            "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px]",
            "dark:bg-input/25",
            invalid && "border-destructive ring-destructive/20 ring-[3px]",
          )}
        />
      </div>
      <input type="hidden" name={name} value={value || ""} />
      <p className="text-muted-foreground mt-1.5 text-xs" aria-live="polite">
        {value > 0 ? `Terbaca: ${formatIDR(value)}` : "Masukkan nominal tanpa titik atau koma."}
      </p>
    </div>
  );
}

/** Card-style radio group used for idol, category and other pickers. */
export function SelectCard({
  selected,
  onClick,
  children,
  className,
  ariaLabel,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-all",
        selected
          ? "border-primary bg-primary/8 ring-primary/25 ring-[3px]"
          : "border-border bg-card hover:border-primary/40 hover:bg-accent/60",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            index === current ? "bg-primary w-5" : index < current ? "bg-primary/40 w-1.5" : "bg-muted-foreground/25 w-1.5",
          )}
        />
      ))}
    </div>
  );
}
