"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction, type ActionState } from "@/lib/actions/auth-actions";
import { FieldError, FormAlert } from "../login/login-form";

const initialState: ActionState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending} loadingText="Membuat akun...">
      Daftar
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState);

  return (
    <div className="ist-card p-6 sm:p-7">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Buat akun</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Mulai catat pengeluaran ngidol kamu supaya tahu ke mana uangnya pergi.
        </p>
      </div>

      <form action={formAction} className="space-y-4" noValidate>
        <FormAlert message={state.error} />

        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            placeholder="nafaja"
            className="mt-1.5"
            required
            minLength={3}
            maxLength={32}
            defaultValue={state.values?.username ?? ""}
            aria-invalid={Boolean(state.fieldErrors?.username)}
          />
          <FieldError message={state.fieldErrors?.username} />
        </div>

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
            defaultValue={state.values?.email ?? ""}
            aria-invalid={Boolean(state.fieldErrors?.email)}
          />
          <FieldError message={state.fieldErrors?.email} />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
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
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Ulangi password"
            className="mt-1.5"
            required
            minLength={8}
            aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          />
          <FieldError message={state.fieldErrors?.confirmPassword} />
        </div>

        <SubmitButton />
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Sudah punya akun?{" "}
        <Link href="/login" className="text-primary font-semibold hover:underline">
          Login
        </Link>
      </p>
    </div>
  );
}
