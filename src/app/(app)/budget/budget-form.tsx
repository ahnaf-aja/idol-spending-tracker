"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/expenses/fields";
import { setBudgetAction, type ExpenseActionState } from "@/lib/actions/expense-actions";
import { formatPeriodLabel } from "@/lib/period";

const initialState: ExpenseActionState = { ok: false };

/** Budget form (requirement 34). Zero deletes the budget for that period. */
export function BudgetForm({
  periodStart,
  periodEnd,
  currentAmount,
}: {
  periodStart: string;
  periodEnd: string;
  currentAmount: number | null;
}) {
  const router = useRouter();
  const [amount, setAmount] = React.useState(currentAmount ?? 0);
  const [state, formAction, isPending] = React.useActionState(setBudgetAction, initialState);

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Budget berhasil disimpan.");
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="periodStart" value={periodStart} />

      <div>
        <Label htmlFor="budget-amount">Budget untuk {formatPeriodLabel({ start: periodStart, end: periodEnd })}</Label>
        <div className="mt-1.5">
          <CurrencyInput
            id="budget-amount"
            name="amount"
            value={amount}
            onChange={setAmount}
            placeholder="2000000"
            invalid={Boolean(state.fieldErrors?.amount)}
          />
        </div>
        {state.fieldErrors?.amount && (
          <p className="text-destructive mt-1.5 text-xs font-medium">{state.fieldErrors.amount}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[1000000, 2000000, 3000000, 5000000].map((preset) => (
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

      <div className="flex items-center gap-2">
        <Button type="submit" loading={isPending} loadingText="Menyimpan...">
          <Wallet className="size-4" />
          Simpan Budget
        </Button>
        {currentAmount ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            disabled={isPending}
            onClick={() => {
              setAmount(0);
              const data = new FormData();
              data.set("amount", "0");
              data.set("periodStart", periodStart);
              React.startTransition(async () => {
                const result = await setBudgetAction(initialState, data);
                if (result.ok) toast.success(result.message ?? "Budget dihapus.");
                else toast.error(result.error ?? "Gagal menghapus budget.");
                router.refresh();
              });
            }}
          >
            Hapus budget
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">
        Budget hanya untuk monitoring — transaksi baru tetap bisa dicatat meskipun budget sudah terlewati.
      </p>
    </form>
  );
}
