"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { loginAction, type ActionState } from "@/lib/actions/auth-actions";

const initialState: ActionState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" loading={pending} loadingText="Masuk...">
      Login
    </Button>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive mt-1.5 text-xs font-medium">{message}</p>;
}

export function FormAlert({ message, tone = "error" }: { message?: string; tone?: "error" | "success" }) {
  if (!message) return null;
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl px-3.5 py-3 text-[13px] font-medium"
          : "flex items-start gap-2 rounded-xl bg-emerald-500/10 px-3.5 py-3 text-[13px] font-medium text-emerald-700 dark:text-emerald-300"
      }
    >
      <AlertCircle className="mt-px size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function LoginForm({ resetSuccess = false, notice }: { resetSuccess?: boolean; notice?: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <div className="ist-card p-6 sm:p-7">
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight">Masuk</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Lanjutkan mencatat pengeluaran ngidol kamu.
        </p>
      </div>

      {resetSuccess && (
        <div className="mb-4 rounded-xl bg-emerald-500/10 px-3.5 py-3 text-[13px] font-medium text-emerald-700 dark:text-emerald-300">
          Password berhasil diubah. Silakan login kembali.
        </div>
      )}
      {notice && <div className="mb-4"><FormAlert message={notice} /></div>}

      <form action={formAction} className="space-y-4" noValidate>
        <FormAlert message={state.error} />

        <div>
          <Label htmlFor="identifier">Username / Email</Label>
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            placeholder="nafaja atau nama@email.com"
            className="mt-1.5"
            required
            defaultValue={state.values?.identifier ?? ""}
            aria-invalid={Boolean(state.fieldErrors?.identifier)}
          />
          <FieldError message={state.fieldErrors?.identifier} />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-primary text-xs font-semibold hover:underline"
            >
              Forgot Password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            className="mt-1.5"
            required
            aria-invalid={Boolean(state.fieldErrors?.password)}
          />
          <FieldError message={state.fieldErrors?.password} />
        </div>

        <div className="flex items-center gap-2.5 pt-0.5">
          <Checkbox id="remember" name="remember" />
          <Label htmlFor="remember" className="text-muted-foreground cursor-pointer text-[13px] font-normal">
            Remember me
          </Label>
        </div>

        <SubmitButton />
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Belum punya akun?{" "}
        <Link href="/register" className="text-primary font-semibold hover:underline">
          Daftar
        </Link>
      </p>
    </div>
  );
}
