"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DialogFooter } from "@/components/ui/dialog";
import { deleteExpenseAction } from "@/lib/actions/expense-actions";
import type { ExpenseDTO } from "@/lib/expenses/repository";

/** Pending-aware destructive submit button (must live inside the <form>). */
function HapusButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" loading={pending} loadingText="Menghapus...">
      Hapus
    </Button>
  );
}

function CancelButton({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { pending } = useFormStatus();
  return (
    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
      Cancel
    </Button>
  );
}

/** Delete a single transaction, with the required confirmation modal (req. 28). */
export function DeleteExpenseButton({
  expense,
  size = "icon",
}: {
  expense: Pick<ExpenseDTO, "id">;
  size?: "icon" | "sm";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  /**
   * The toast is fired from inside the action closure, not from an effect on
   * `useActionState` state: `revalidatePath` in the server action removes this
   * row in the same commit, so the component unmounts before such an effect
   * could run and the confirmation never appeared.
   */
  const handleDelete = React.useCallback(
    async (formData: FormData) => {
      const result = await deleteExpenseAction({ ok: false }, formData);
      if (result.ok) {
        toast.success(result.message ?? "Pengeluaran berhasil dihapus.");
        setOpen(false);
        router.refresh();
      } else if (result.error) {
        toast.error(result.error);
      }
    },
    [router],
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={size === "icon" ? "iconSm" : "sm"}
        aria-label="Hapus transaksi"
        onClick={() => setOpen(true)}
        className={size === "icon" ? "text-muted-foreground hover:text-destructive" : "text-destructive"}
      >
        <Trash2 className="size-4" />
        {size === "sm" && "Hapus"}
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Hapus pengeluaran ini?"
        description="Data yang sudah dihapus tidak dapat dikembalikan."
      >
        <form action={handleDelete} className="contents">
          <input type="hidden" name="id" value={expense.id} />
          <DialogFooter>
            <CancelButton onOpenChange={setOpen} />
            <HapusButton />
          </DialogFooter>
        </form>
      </ConfirmDialog>
    </>
  );
}

/** Edit action; Edit is a route so the form can be server-rendered with the row. */
export function EditExpenseButton({ id, size = "icon" }: { id: string; size?: "icon" | "sm" }) {
  return (
    <Button
      asChild
      variant="ghost"
      size={size === "icon" ? "iconSm" : "sm"}
      className={size === "icon" ? "text-muted-foreground hover:text-foreground" : undefined}
    >
      <Link href={`/expenses/${id}/edit`} aria-label="Edit transaksi">
        <Pencil className="size-4" />
        {size === "sm" && "Edit"}
      </Link>
    </Button>
  );
}
