import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Database-backed sessions.
 *
 * The cookie holds a 256-bit random token; the database only ever stores the
 * SHA-256 hash of that token, so a database leak does not hand over live
 * sessions. Because sessions live in the database they can be revoked
 * server-side - which is exactly what happens on password change/reset
 * ("invalidate session lama").
 *
 * Cookie flags: httpOnly, sameSite=lax, secure in production, path=/.
 */

export const SESSION_COOKIE = "ist_session";
const DAY_MS = 86_400_000;
const REMEMBER_DAYS = 30;
const DEFAULT_HOURS = 12;

const isProd = process.env.NODE_ENV === "production";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

export interface SessionRecord {
  sessionId: string;
  expiresAt: Date;
  user: SessionUser;
}

export async function createSession(userId: string, remember = false): Promise<void> {
  const token = generateToken();
  const expiresAt = new Date(
    Date.now() + (remember ? REMEMBER_DAYS * DAY_MS : DEFAULT_HOURS * 3_600_000),
  );

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    expires: expiresAt,
  });
}

/** Read the current session from the cookie, validating expiry against the DB. */
export async function getSession(): Promise<SessionRecord | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: { select: { id: true, username: true, email: true, createdAt: true } },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return { sessionId: session.id, expiresAt: session.expiresAt, user: session.user };
}

/** Throwing accessor for Server Actions / protected pages. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session.user;
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}

/** Revoke every session of a user (used after password change/reset). */
export async function revokeAllSessions(userId: string, keepCurrent = false): Promise<void> {
  let currentToken: string | undefined;
  try {
    const store = await cookies();
    currentToken = store.get(SESSION_COOKIE)?.value;
  } catch {
    // Outside a request scope (CLI, tests, cron): nothing to keep.
    currentToken = undefined;
  }

  await prisma.session.deleteMany({
    where: {
      userId,
      ...(keepCurrent && currentToken ? { tokenHash: { not: hashToken(currentToken) } } : {}),
    },
  });
}
