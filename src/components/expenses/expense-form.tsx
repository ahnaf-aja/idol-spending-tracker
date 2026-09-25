"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Info,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar, dateOnlyToPickerDate, pickerDateToDateOnly } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { CategoryIcon, CurrencyInput, SelectCard, StepDots } from "@/components/expenses/fields";
import { createExpenseAction, updateExpenseAction, type ExpenseActionState } from "@/lib/actions/expense-actions";
import {
  CATEGORY_OPTIONS,
  IDOL_OPTIONS,
  categoryLabel,
  type ExpenseCategory,
  type IdolType,
} from "@/lib/categories";
import { formatIDR } from "@/lib/currency";
import { formatDateLong, todayDateOnly } from "@/lib/period";
import { normalizeMemberName } from "@/lib/normalize";
import type { ExpenseDTO } from "@/lib/expenses/repository";
import { cn } from "@/lib/utils";

/**
 * Multi-step Add/Edit expense form (requirements 11-18, 27).
 *
 * All seven steps live in one <form> whose action is the server action; every
 * step writes into hidden inputs so the submitted FormData is always complete,
 * whichever step the user is looking at. Step navigation buttons are
 * type="button", so only the final "Simpan" button can submit - and it is
 * disabled while the action is pending, which prevents double submissions.
 */

const STEPS = ["Idol", "Member", "Jenis", "Nominal", "Tanggal", "Catatan", "Konfirmasi"] as const;

const initialState: ExpenseActionState = { ok: false };

export function ExpenseForm({
  mode,
  expense,
  redirectTo,
}: {
  mode: "create" | "edit";
  expense?: ExpenseDTO;
  redirectTo?: string;
}) {
  const router = useRouter();
  const action = mode === "create" ? createExpenseAction : updateExpenseAction;
  const [state, formAction, isPending] = React.useActionState(action, initialState);

  /**
   * Idempotency key for the current submission (requirement 46).
   *
   * Generated once when the user first hits "Simpan Pengeluaran" and reused if
   * the same submission is replayed, so the server can recognise the duplicate.
   * Cleared on a failed save so the next attempt is a genuinely new write.
   */
  const clientTokenRef = React.useRef<string>("");

  const submitAction = React.useCallback(
    (formData: FormData) => {
      if (mode === "create") {
        if (!clientTokenRef.current) {
          clientTokenRef.current =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        }
        formData.set("clientToken", clientTokenRef.current);
      }
      return formAction(formData);
    },
    [formAction, mode],
  );

  const [step, setStep] = React.useState(0);
  const [idolType, setIdolType] = React.useState<IdolType>((expense?.idolType as IdolType) ?? "JKT48");
  const [customIdolName, setCustomIdolName] = React.useState(expense?.customIdolName ?? "");
  const [memberName, setMemberName] = React.useState(expense?.memberName ?? "");
  const [category, setCategory] = React.useState<ExpenseCategory>(
    (expense?.category as ExpenseCategory) ?? "VC",
  );
  const [amount, setAmount] = React.useState(expense?.amount ?? 0);
  const [expenseDate, setExpenseDate] = React.useState(expense?.expenseDate ?? todayDateOnly());
  const [note, setNote] = React.useState(expense?.note ?? "");
  const [localError, setLocalError] = React.useState<string | null>(null);

  const normalizedMember = normalizeMemberName(memberName);

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Pengeluaran berhasil disimpan.");
      router.push(redirectTo ?? (mode === "create" ? "/dashboard" : "/history"));
      router.refresh();
    } else if (state.error) {
      // Failed save: the next attempt is a new write, so it needs a new key.
      clientTokenRef.current = "";
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const validateStep = (index: number): string | null => {
    if (index === 0 && idolType === "OTHER" && !customIdolName.trim()) {
      return "Nama idol / group wajib diisi kalau memilih Other.";
    }
    if (index === 3 && (!Number.isFinite(amount) || amount <= 0)) {
      return "Nominal harus lebih dari 0 dan tidak boleh desimal.";
    }
    return null;
  };

  const goNext = () => {
    const error = validateStep(step);
    if (error) {
      setLocalError(error);
      toast.error(error);
      return;
    }
    setLocalError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setLocalError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const idolLabel = idolType === "OTHER" ? customIdolName.trim().toUpperCase() || "Other" : idolType;
  const fieldError = (key: string) => state.fieldErrors?.[key];

  return (
    <form action={submitAction} className="contents">
      <div className="ist-card overflow-hidden">
        <div className="border-b border-border/70 bg-muted/30 px-4 py-3.5 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
              Step {step + 1} / {STEPS.length}
            </p>
            <StepDots total={STEPS.length} current={step} />
          </div>
          <p className="mt-1 text-sm font-semibold" data-testid="step-title">
            {step === 0 && "Pilih Idol / Group"}
            {step === 1 && "Nama Member (opsional)"}
            {step === 2 && "Jenis Pengeluaran"}
            {step === 3 && "Jumlah Pengeluaran"}
            {step === 4 && "Tanggal Transaksi"}
            {step === 5 && "Catatan (opsional)"}
            {step === 6 && "Konfirmasi"}
          </p>
        </div>

        {/* Values actually submitted to the server action */}
        {mode === "edit" && <input type="hidden" name="id" value={expense?.id ?? ""} />}
        <input type="hidden" name="idolType" value={idolType} />
        <input type="hidden" name="customIdolName" value={idolType === "OTHER" ? customIdolName : ""} />
        <input type="hidden" name="memberName" value={memberName} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="amount" value={amount || ""} />
        <input type="hidden" name="expenseDate" value={expenseDate} />
        <input type="hidden" name="note" value={note} />

        <div className="p-4 sm:p-5">
          {/* STEP 1 - idol */}
          <div className={cn("space-y-3", step !== 0 && "hidden")}>
            <div role="radiogroup" aria-label="Pilih idol atau group" className="grid gap-2.5 sm:grid-cols-3">
              {IDOL_OPTIONS.map((option) => (
                <SelectCard
                  key={option.value}
                  selected={idolType === option.value}
                  onClick={() => setIdolType(option.value)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="text-muted-foreground truncate text-xs">{option.hint}</p>
                  </div>
                  {idolType === option.value && <Check className="text-primary size-4 shrink-0" />}
                </SelectCard>
              ))}
            </div>

            {idolType === "OTHER" && (
              <div className="animate-rise pt-1">
                <Label htmlFor="custom-idol">Nama Idol / Group</Label>
                <Input
                  id="custom-idol"
                  value={customIdolName}
                  onChange={(event) => setCustomIdolName(event.target.value.toUpperCase())}
                  placeholder="Contoh: ILLIT"
                  maxLength={60}
                  className="mt-1.5 uppercase"
                  aria-invalid={Boolean(fieldError("customIdolName"))}
                />
                <p className="text-muted-foreground mt-1.5 text-xs">
                  Nama ini yang dipakai di statistik, bukan tulisan &quot;Other&quot;.
                </p>
                {fieldError("customIdolName") && (
                  <p className="text-destructive mt-1.5 text-xs font-medium">{fieldError("customIdolName")}</p>
                )}
              </div>
            )}
          </div>

          {/* STEP 2 - member */}
          <div className={cn("space-y-3", step !== 1 && "hidden")}>
            <div>
              <Label htmlFor="member-name">Nama Member</Label>
              <Input
                id="member-name"
                value={memberName}
                onChange={(event) => setMemberName(event.target.value)}
                placeholder="Contoh: freya"
                maxLength={80}
                className="mt-1.5"
                aria-invalid={Boolean(fieldError("memberName"))}
              />
              <div className="bg-muted/50 mt-2 flex items-start gap-2 rounded-xl px-3 py-2.5">
                <Info className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {memberName.trim() ? (
                    <>
                      Akan disimpan sebagai{" "}
                      <span className="text-foreground font-semibold">{normalizedMember}</span> — trim +
                      uppercase, di frontend dan di server.
                    </>
                  ) : (
                    <>
                      Boleh dikosongkan untuk transaksi tanpa member (tiket show, merchandise group, event).
                      Disimpan sebagai <span className="font-semibold">null</span>, bukan string kosong.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* STEP 3 - category */}
          <div className={cn(step !== 2 && "hidden")}>
            <div role="radiogroup" aria-label="Jenis pengeluaran" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {CATEGORY_OPTIONS.map((option) => (
                <SelectCard
                  key={option.value}
                  selected={category === option.value}
                  onClick={() => setCategory(option.value)}
                  className="flex-col items-start gap-2 p-3"
                >
                  <span
                    className="flex size-9 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${option.color}22`, color: option.color }}
                  >
                    <CategoryIcon category={option.value} className="size-[18px]" />
                  </span>
                  <span className="text-[13px] font-semibold leading-tight">{option.label}</span>
                </SelectCard>
              ))}
            </div>
          </div>

          {/* STEP 4 - amount */}
          <div className={cn("space-y-3", step !== 3 && "hidden")}>
            <Label htmlFor="amount-input">Jumlah Pengeluaran</Label>
            <CurrencyInput
              id="amount-input"
              name="amount-ui"
              value={amount}
              onChange={setAmount}
              invalid={Boolean(fieldError("amount") || (localError && step === 3))}
            />
            <div className="flex flex-wrap gap-2">
              {[50000, 100000, 150000, 200000, 500000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(preset)}
                  className="hover:border-primary/40 hover:bg-accent rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium tabular-nums transition"
                >
                  {preset.toLocaleString("id-ID")}
                </button>
              ))}
            </div>
            {(fieldError("amount") || (localError && step === 3)) && (
              <p className="text-destructive text-xs font-medium">{fieldError("amount") ?? localError}</p>
            )}
          </div>

          {/* STEP 5 - date */}
          <div className={cn("space-y-3", step !== 4 && "hidden")}>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" className="w-full justify-start font-normal">
                  <CalendarDays className="size-4" />
                  {formatDateLong(expenseDate)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto" align="start">
                <Calendar
                  mode="single"
                  selected={dateOnlyToPickerDate(expenseDate)}
                  onSelect={(date) => {
                    const next = pickerDateToDateOnly(date);
                    if (next) setExpenseDate(next);
                  }}
                  defaultMonth={dateOnlyToPickerDate(expenseDate)}
                />
              </PopoverContent>
            </Popover>

            <div>
              <Label htmlFor="expense-date-native" className="text-muted-foreground text-xs font-normal">
                Atau isi manual
              </Label>
              <input
                id="expense-date-native"
                type="date"
                value={expenseDate}
                onChange={(event) => {
                  const value = event.target.value;
                  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setExpenseDate(value);
                }}
                className="ist-date-input mt-1.5"
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Default hari ini. Tanggal disimpan sebagai calendar date, jadi tidak bergeser karena konversi UTC.
            </p>
          </div>

          {/* STEP 6 - note */}
          <div className={cn("space-y-3", step !== 5 && "hidden")}>
            <Label htmlFor="note">Catatan</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Tambahkan catatan..."
              maxLength={500}
            />
            <p className="text-muted-foreground text-xs">
              Contoh: VC 2 tiket · Birthday gift · Show Pajama Drive · Cheki 3 tiket
            </p>
          </div>

          {/* STEP 7 - confirmation */}
          <div className={cn("space-y-3", step !== 6 && "hidden")}>
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
              <SummaryRow label="Idol / Group" value={idolLabel} />
              <SummaryRow label="Member" value={normalizedMember ?? "—"} />
              <SummaryRow label="Kategori" value={categoryLabel(category)} />
              <SummaryRow label="Nominal" value={amount > 0 ? formatIDR(amount) : "—"} highlight />
              <SummaryRow label="Tanggal" value={formatDateLong(expenseDate)} />
              <SummaryRow label="Catatan" value={note.trim() || "—"} />
            </div>
            {state.error && (
              <p className="text-destructive text-xs font-medium">{state.error}</p>
            )}
          </div>
        </div>

        <div className="bg-card/95 sticky bottom-0 flex items-center gap-2 border-t border-border/70 px-4 py-3 backdrop-blur sm:px-5">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={goBack} disabled={isPending}>
              <ArrowLeft className="size-4" />
              Kembali
            </Button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Lanjut
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="submit" loading={isPending} loadingText="Menyimpan...">
              {mode === "create" ? (
                <>
                  <CheckCircle2 className="size-4" />
                  Simpan Pengeluaran
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Simpan Perubahan
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Step jump chips (desktop convenience) */}
      <div className="mt-3 hidden flex-wrap gap-1.5 lg:flex">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              const error = validateStep(index);
              if (error) {
                toast.error(error);
                return;
              }
              setLocalError(null);
              setStep(index);
            }}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
              index === step ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </form>
  );
}

function SummaryRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-3.5 py-3">
      <span className="text-muted-foreground text-[13px]">{label}</span>
      <span
        className={cn(
          "max-w-[62%] text-right text-[13px] font-medium break-words",
          highlight && "text-primary text-base font-bold",
        )}
      >
        {value}
      </span>
    </div>
  );
}
