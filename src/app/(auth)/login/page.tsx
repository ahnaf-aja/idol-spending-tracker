import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Login" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  // Belt and braces alongside middleware: never render a login form to a live session.
  const session = await getSession();
  if (session) redirect("/dashboard");

  const params = await searchParams;
  return <LoginForm resetSuccess={params.reset === "success"} />;
}
