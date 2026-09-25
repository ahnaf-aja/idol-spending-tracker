"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  authenticate,
  changePassword,
  GENERIC_LOGIN_ERROR,
  registerUser,
  requestPasswordReset,
} from "@/lib/auth/service";
import { createSession, destroyCurrentSession, requireUser, revokeAllSessions } from "@/lib/auth/session";
import { consumeResetToken, inspectResetToken, issueResetToken, resetTokenTtlMs } from "@/lib/auth/reset-tokens";
import { clientFingerprint, consumeRateLimit } from "@/lib/rate-limit";
import { passwordResetMessage, sendMail } from "@/lib/mail";
import { fieldErrors, loginSchema, registerSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation";

/**
 * Server Actions for the auth surface.
 *
 * All of them return `{ ok, error?, fieldErrors? }` instead of throwing, so the
 * client can render inline messages. No action ever returns a password or hash.
 */

export interface ActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  redirectTo?: string;
  /**
   * Values echoed back after a failed submit. React 19 resets uncontrolled
   * inputs once an action completes, so without this a validation error would
   * wipe everything the user typed. Passwords are deliberately never echoed.
   */
  values?: Record<string, string>;
}

/** Collect the submitted text fields we are willing to echo back into the form. */
function echoValues(formData: FormData, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

const FORGOT_GENERIC_MESSAGE =
  "Jika email tersebut terdaftar, kami telah mengirimkan link reset password.";

function rateLimitMessage(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Terlalu banyak percobaan. Coba lagi dalam ${minutes} menit.`;
}

async function fingerprint(extra = ""): Promise<string> {
  const h = await headers();
  return clientFingerprint(h, extra);
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = echoValues(formData, ["username", "email"]);
  const parsed = registerSchema.safeParse({
    username: formData.get("username") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrors(parsed.error),
      error: "Periksa kembali data kamu.",
      values,
    };
  }

  const limit = await consumeRateLimit("register", await fingerprint(parsed.data.email));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSeconds), values };

  const result = await registerUser(parsed.data);
  if (!result.ok || !result.data) {
    return { ok: false, error: result.error, fieldErrors: result.fieldErrors, values };
  }

  await createSession(result.data.id, false);
  redirect("/dashboard");
}

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = echoValues(formData, ["identifier"]);
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier") ?? "",
    password: formData.get("password") ?? "",
    remember: formData.get("remember") === "on" || formData.get("remember") === "true",
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrors(parsed.error),
      error: "Periksa kembali data kamu.",
      values,
    };
  }

  const limit = await consumeRateLimit("login", await fingerprint(parsed.data.identifier));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSeconds), values };

  const result = await authenticate(parsed.data.identifier, parsed.data.password);
  if (!result.ok || !result.data) {
    return { ok: false, error: result.error ?? GENERIC_LOGIN_ERROR, values };
  }

  await createSession(result.data.id, parsed.data.remember);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}

export async function forgotPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") ?? "" });

  // Even a malformed email gets the generic answer - no enumeration either way.
  if (!parsed.success) {
    return { ok: true, message: FORGOT_GENERIC_MESSAGE };
  }

  const limit = await consumeRateLimit("forgot", await fingerprint(parsed.data.email));
  if (!limit.ok) {
    // A rate-limited caller still gets the generic text plus a hint to wait.
    return { ok: true, message: `${FORGOT_GENERIC_MESSAGE} ${rateLimitMessage(limit.retryAfterSeconds)}` };
  }

  const { userId } = await requestPasswordReset(parsed.data.email);
  if (userId) {
    const { rawToken } = await issueResetToken(userId);
    const base = process.env.APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;
    try {
      await sendMail(passwordResetMessage(parsed.data.email, resetUrl, Math.round(resetTokenTtlMs() / 60_000)));
    } catch (error) {
      console.error("[forgot-password] gagal mengirim email", error);
    }
  }

  return { ok: true, message: FORGOT_GENERIC_MESSAGE };
}

export async function resetPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token") ?? "",
    password: formData.get("password") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrors(parsed.error), error: "Periksa kembali data kamu." };
  }

  const limit = await consumeRateLimit("reset", await fingerprint());
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSeconds) };

  const state = await inspectResetToken(parsed.data.token);
  if (state.state === "invalid") {
    return { ok: false, error: "Link reset password tidak valid." };
  }
  if (state.state === "expired") {
    return { ok: false, error: "Link reset password sudah kedaluwarsa. Silakan minta link baru." };
  }
  if (state.state === "used") {
    return { ok: false, error: "Link reset password sudah pernah digunakan." };
  }

  const consumed = await consumeResetToken(parsed.data.token, parsed.data.password);
  if (consumed.state !== "valid") {
    return { ok: false, error: "Link reset password tidak bisa digunakan lagi." };
  }

  return { ok: true, message: "Password berhasil diubah. Silakan login kembali.", redirectTo: "/login?reset=success" };
}

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/login?next=/profile");

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: fieldErrors(parsed.error), error: "Periksa kembali data kamu." };
  }

  const limit = await consumeRateLimit("changePassword", await fingerprint(user.id));
  if (!limit.ok) return { ok: false, error: rateLimitMessage(limit.retryAfterSeconds) };

  const result = await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
  if (!result.ok) return { ok: false, error: result.error, fieldErrors: result.fieldErrors };

  // Keep the current session, drop every other device.
  await revokeAllSessions(user.id, true);
  revalidatePath("/profile");
  return { ok: true, message: "Password berhasil diubah." };
}
