import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/session";

/**
 * Password reset tokens.
 *
 * The raw token is a 32-byte CSPRNG value that only ever travels in the email
 * link. The database stores its SHA-256 hash, so a leaked table cannot be used
 * to reset anyone's password. Tokens are single-use (`usedAt`) and expire after
 * RESET_TOKEN_TTL_MINUTES (20 by default, inside the 15-30 minute requirement).
 */

const DEFAULT_TTL_MINUTES = 20;

export function resetTokenTtlMs(): number {
  const fromEnv = Number.parseInt(process.env.RESET_TOKEN_TTL_MINUTES ?? "", 10);
  const minutes = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_TTL_MINUTES;
  return minutes * 60_000;
}

export interface IssuedResetToken {
  rawToken: string;
  expiresAt: Date;
}

export async function issueResetToken(userId: string): Promise<IssuedResetToken> {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + resetTokenTtlMs());

  // Any outstanding token for this user is invalidated first.
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(rawToken), expiresAt },
  });

  return { rawToken, expiresAt };
}

export type ResetTokenState =
  | { state: "valid"; userId: string; tokenId: string }
  | { state: "invalid" }
  | { state: "expired" }
  | { state: "used" };

export async function inspectResetToken(rawToken: string): Promise<ResetTokenState> {
  if (!rawToken || typeof rawToken !== "string") return { state: "invalid" };
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!record) return { state: "invalid" };
  if (record.usedAt) return { state: "used" };
  if (record.expiresAt.getTime() <= Date.now()) return { state: "expired" };
  return { state: "valid", userId: record.userId, tokenId: record.id };
}

/**
 * Consume a token and set the new password atomically-ish: the token is marked
 * used before the password is written, inside one transaction, so a concurrent
 * replay cannot win.
 */
export async function consumeResetToken(rawToken: string, newPassword: string): Promise<ResetTokenState> {
  const state = await inspectResetToken(rawToken);
  if (state.state !== "valid") return state;

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: state.tokenId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) throw new Error("TOKEN_ALREADY_USED");

    await tx.user.update({ where: { id: state.userId }, data: { passwordHash } });
    // Every existing session dies with the old password.
    await tx.session.deleteMany({ where: { userId: state.userId } });
    await tx.passwordResetToken.updateMany({
      where: { userId: state.userId, usedAt: null },
      data: { usedAt: now },
    });
  });

  return state;
}

/** Constant-time comparison helper (used for token equality checks in tests). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
