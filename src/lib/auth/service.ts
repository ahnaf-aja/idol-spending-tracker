/**
 * Auth service: the only place that decides whether credentials are valid.
 * Every server action calls into these functions so the rules stay in one place.
 */

import "server-only";
import { prisma } from "@/lib/prisma";
import { fakeVerify, hashPassword, verifyPassword } from "@/lib/auth/password";
import { normalizeEmail, normalizeUsername } from "@/lib/normalize";
import type { SessionUser } from "@/lib/auth/session";

export interface AuthResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export const GENERIC_LOGIN_ERROR = "Username/email atau password salah.";

export async function findUserByIdentifier(identifier: string) {
  const value = identifier.trim().toLowerCase();
  return prisma.user.findFirst({
    where: { OR: [{ username: value }, { email: value }] },
  });
}

export async function usernameExists(username: string): Promise<boolean> {
  const value = normalizeUsername(username);
  if (!value) return false;
  return (await prisma.user.count({ where: { username: value } })) > 0;
}

export async function emailExists(email: string): Promise<boolean> {
  const value = normalizeEmail(email);
  if (!value) return false;
  return (await prisma.user.count({ where: { email: value } })) > 0;
}

export async function registerUser(input: {
  username: string;
  email: string;
  password: string;
}): Promise<AuthResult<SessionUser>> {
  const username = normalizeUsername(input.username)!;
  const email = normalizeEmail(input.email)!;

  if (await usernameExists(username)) {
    return { ok: false, error: "Username sudah digunakan.", fieldErrors: { username: "Username sudah digunakan." } };
  }
  if (await emailExists(email)) {
    return { ok: false, error: "Email sudah terdaftar.", fieldErrors: { email: "Email sudah terdaftar." } };
  }

  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.user.create({
      data: { username, email, passwordHash },
      select: { id: true, username: true, email: true, createdAt: true },
    });
    return { ok: true, data: user };
  } catch {
    // Unique constraint lost the race against a concurrent registration.
    return { ok: false, error: "Username atau email sudah digunakan." };
  }
}

export async function authenticate(
  identifier: string,
  password: string,
): Promise<AuthResult<SessionUser>> {
  const user = await findUserByIdentifier(identifier);

  if (!user) {
    // Spend comparable time so timing does not reveal whether the account exists.
    await fakeVerify(password);
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false, error: GENERIC_LOGIN_ERROR };

  return {
    ok: true,
    data: { id: user.id, username: user.username, email: user.email, createdAt: user.createdAt },
  };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<AuthResult<null>> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "User tidak ditemukan." };

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    return {
      ok: false,
      error: "Password saat ini salah.",
      fieldErrors: { currentPassword: "Password saat ini salah." },
    };
  }

  const sameAsOld = await verifyPassword(newPassword, user.passwordHash);
  if (sameAsOld) {
    return {
      ok: false,
      error: "Password baru harus berbeda dari password saat ini.",
      fieldErrors: { newPassword: "Password baru harus berbeda dari password saat ini." },
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  return { ok: true, data: null };
}

/**
 * Forgot-password entry point. Always reports success: whether the email is
 * registered or not is never distinguishable from the outside.
 */
export async function requestPasswordReset(email: string): Promise<{ userId: string | null }> {
  const value = normalizeEmail(email);
  if (!value) return { userId: null };
  const user = await prisma.user.findUnique({ where: { email: value }, select: { id: true } });
  return { userId: user?.id ?? null };
}
