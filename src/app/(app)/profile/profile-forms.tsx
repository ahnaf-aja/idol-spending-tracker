"use client";

import * as React from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction, type ActionState } from "@/lib/actions/auth-actions";

const initialState: ActionState = { ok: false };

/** Change Password (requirement 37): current password is required. */
export function ChangePasswordDialog() {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, isPending] = React.useActionState(changePasswordAction, initialState);

  React.useEffect(() => {
    if (state.ok) {
      toast.success(state.message ?? "Password berhasil diubah.");
      setOpen(false);
    } else if (state.error && !state.fieldErrors) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full justify-start sm:w-auto">
          <KeyRound className="size-4" />
          Change Password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Masukkan password saat ini untuk membuat password baru. Password lama tidak akan bisa dipakai lagi
            setelah berhasil diubah.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {state.error && (
            <p className="bg-destructive/10 text-destructive rounded-xl px-3.5 py-3 text-[13px] font-medium">
              {state.error}
            </p>
          )}

          <div>
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              className="mt-1.5"
              required
            />
            {state.fieldErrors?.currentPassword && (
              <p className="text-destructive mt-1.5 text-xs font-medium">{state.fieldErrors.currentPassword}</p>
            )}
          </div>

          <div>
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              className="mt-1.5"
              minLength={8}
              required
            />
            {state.fieldErrors?.newPassword && (
              <p className="text-destructive mt-1.5 text-xs font-medium">{state.fieldErrors.newPassword}</p>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPasswordProfile">Confirm New Password</Label>
            <Input
              id="confirmPasswordProfile"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              className="mt-1.5"
              minLength={8}
              required
            />
            {state.fieldErrors?.confirmPassword && (
              <p className="text-destructive mt-1.5 text-xs font-medium">{state.fieldErrors.confirmPassword}</p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending} loadingText="Menyimpan...">
              Simpan Password Baru
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Logout button (form submit, so it always goes through the server action). */
export function LogoutButton({ action }: { action: () => Promise<void> }) {
  return (
    <form action={action}>
      <Button type="submit" variant="outline" className="text-destructive w-full justify-start sm:w-auto">
        Logout
      </Button>
    </form>
  );
}
