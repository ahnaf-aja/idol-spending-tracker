"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Confirmation modal for destructive actions.
 *
 * Two shapes:
 *  - pass `onConfirm` for a client-side confirm
 *  - pass `children` (typically a <form> with a submit button) for a
 *    server-action confirm; the footer is then owned by the children.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Hapus",
  cancelLabel = "Cancel",
  destructive = true,
  pending = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {children ?? (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} loading={pending}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Submit button that reports the enclosing <form>'s pending state. */
export function ConfirmSubmitButton({
  label = "Hapus",
  destructive = true,
}: {
  label?: string;
  destructive?: boolean;
}) {
  return (
    <Button
      type="submit"
      variant={destructive ? "destructive" : "default"}
      data-pending-label="Menghapus..."
      className="group/pending"
    >
      <Loader2 className="hidden size-4 animate-spin group-data-[pending=true]/pending:block" />
      {label}
    </Button>
  );
}
