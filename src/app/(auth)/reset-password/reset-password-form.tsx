"use client";

import { useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction, type ActionState } from "@/lib/actions/auth-actions";
import { FieldError, FormAlert } from "../login/login-form";

const initialState: ActionState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending} loadingText="Menyimpan...">
      Reset Password
    </Button>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, initialState);
  const router = useRouter();

  /**
   * Requirement 7: after a successful reset the user is sent to Login, where the
   * "Password berhasil diubah. Silakan login kembali." banner is shown. The
   * success card stays on screen for a moment so the change is perceivable, and
   * the manual link below remains as a fallback if the redirect is blocked.
   */
  useEffect(() => {
    if (!state.ok || !state.redirectTo) return;
    const timer = setTimeout(() => router.replace(state.redirectTo!), 1200);
    return () => clearTimeout(timer);
  }, [state.ok, state.redirectTo, router]);

  if (state.ok) {
    return (
      <div className="ist-card p-6 text-center sm:p-7">
        <h1 className="text-lg font-bold tracking-tight">Password berhasil diubah</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {state.message ?? "Password berhasil diubah. Silakan login kembali."}
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/login?reset=success">Login</Link>
        </Button>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="ist-card p-6 text-center sm:p-7">
        <div className="bg-destructive/12 text-destructive mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl">
          <ShieldX className="size-6" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">Link tidak valid</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Link reset password tidak lengkap atau sudah tidak berlaku. Silakan minta link baru.
        </p>
        <Button asChild className="mt-6 w-full">
          <Link href="/forgot-password">Minta Link Baru</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="ist-card p-6 sm:p-7">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Reset Password</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Buat password baru untuk akun kamu. Link ini hanya bisa dipakai sekali.
        </p>
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="token" value={token} />
        <FormAlert message={state.error} />

        <div>
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Minimal 8 karakter"
            className="mt-1.5"
            required
            minLength={8}
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
          <FieldError message={state.fieldErrors?.password} />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Ulangi password baru"
            className="mt-1.5"
            required
            minLength={8}
            aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          />
          <FieldError message={state.fieldErrors?.confirmPassword} />
        </div>

        <SubmitButton />
      </form>

      <Link
        href="/login"
        className="text-muted-foreground hover:text-foreground mt-6 block text-center text-sm font-medium"
      >
        Kembali ke Login
      </Link>
    </div>
  );
}
