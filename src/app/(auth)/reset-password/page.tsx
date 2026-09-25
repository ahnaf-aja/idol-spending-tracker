import type { Metadata } from "next";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Reset Password" };

/**
 * `?token=...` is read on the server and passed to the form as a hidden field.
 * The token is compared against the stored SHA-256 hash when the form is
 * submitted; nothing about it is exposed in the client bundle.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <ResetPasswordForm token={params.token ?? ""} />;
}
