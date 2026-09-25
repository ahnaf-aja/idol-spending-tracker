import bcrypt from "bcryptjs";

/**
 * Password hashing. bcrypt with cost 12 (>= 250ms on commodity hardware).
 * Passwords are only ever handled here - never logged, never returned to a
 * client, never stored in plaintext.
 */

const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Constant-time-ish dummy verification used when a login identifier does not
 * exist, so response timing does not reveal which accounts are registered.
 */
export async function fakeVerify(plain: string): Promise<void> {
  await bcrypt.compare(plain, "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7UK0dG0lp0M5cL4F6mQpB7AcXH0Bm4S");
}
