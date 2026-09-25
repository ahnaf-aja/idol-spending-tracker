"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowLeft, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordAction, type ActionState } from "@/lib/actions/auth-actions";
import { FormAlert } from "../login/login-form";

const initialState: ActionState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending} loadingText="Mengirim...">
      Send Reset Link
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialState);

  if (state.ok && state.message) {
    return (
      <div className="ist-card p-6 text-center sm:p-7">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
          <MailCheck className="size-6" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">Cek email kamu</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{state.message}</p>
        <p className="text-muted-foreground mt-3 text-xs leading-relaxed">
          Link reset password berlaku 20 menit dan hanya bisa dipakai sekali.
        </p>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link href="/login">Kembali ke Login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="ist-card p-6 sm:p-7">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Forgot Password</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Masukkan email akun kamu, kami akan mengirim link untuk membuat password baru.
        </p>
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        <FormAlert message={state.error} />

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nama@email.com"
            className="mt-1.5"
            required
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
        </div>

        <SubmitButton />
      </form>

      <Link
        href="/login"
        className="text-muted-foreground hover:text-foreground mt-6 flex items-center justify-center gap-1.5 text-sm font-medium"
      >
        <ArrowLeft className="size-3.5" />
        Kembali ke Login
      </Link>
    </div>
  );
}
