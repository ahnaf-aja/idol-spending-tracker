"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CATEGORY_OPTIONS } from "@/lib/categories";
import { cn } from "@/lib/utils";

/**
 * History filters (requirement 29): idol, member, category, date range and a
 * free-text search. Member and idol options are generated from the user's own
 * transactions — nothing is hardcoded. Every change writes to the URL, so the
 * server component re-queries and the filtered view is shareable.
 */

export interface HistoryFilterValues {
  idol: string;
  member: string;
  category: string;
  q: string;
}

export function HistoryFilters({
  idols,
  members,
  values,
}: {
  idols: string[];
  members: string[];
  values: HistoryFilterValues;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(values.q);

  useEffect(() => setSearch(values.q), [values.q]);

  const push = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (!value) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    startTransition(() => router.push(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const hasFilters =
    Boolean(values.idol || values.member || values.category || values.q) ||
    ["previous", "custom", "all"].includes(searchParams.get("preset") ?? "");

  return (
    <div className={cn("space-y-3", isPending && "opacity-70")}>
      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          push({ q: search.trim() || null });
        }}
      >
        <Search className="text-muted-foreground pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari member, idol, atau catatan..."
          className="pl-10 pr-10"
          aria-label="Cari transaksi"
        />
        {search && (
          <button
            type="button"
            aria-label="Bersihkan pencarian"
            onClick={() => {
              setSearch("");
              push({ q: null });
            }}
            className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="size-4" />
          </button>
        )}
      </form>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FilterSelect
          label="Idol"
          value={values.idol}
          placeholder="All Idol"
          options={idols}
          onChange={(value) => push({ idol: value })}
        />
        <FilterSelect
          label="Member"
          value={values.member}
          placeholder="All Members"
          options={members}
          onChange={(value) => push({ member: value })}
        />
        <FilterSelect
          label="Category"
          value={values.category}
          placeholder="All"
          options={CATEGORY_OPTIONS.map((option) => option.label)}
          optionValues={CATEGORY_OPTIONS.map((option) => option.value)}
          onChange={(value) => push({ category: value })}
        />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-8 px-2 text-xs"
          onClick={() =>
            push({ idol: null, member: null, category: null, q: null, preset: null, start: null, end: null })
          }
        >
          <X className="size-3.5" />
          Bersihkan semua filter
        </Button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  optionValues,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  optionValues?: string[];
  onChange: (value: string) => void;
}) {
  const values = optionValues ?? options;
  return (
    <div>
      <Label className="sr-only">{label}</Label>
      <Select value={value || "__all"} onValueChange={(next) => onChange(next === "__all" ? "" : next)}>
        <SelectTrigger className="h-10 text-[13px]" aria-label={label}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all">{placeholder}</SelectItem>
          {options.map((option, index) => (
            <SelectItem key={values[index]} value={values[index]}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
