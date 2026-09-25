/**
 * Normalisation helpers.
 *
 * Every text field that can be grouped on (member names above all) is
 * normalised **on the server** before it reaches the database, and the same
 * functions run in the browser for live feedback. Server-side is the source of
 * truth: the client helper is only a preview, so a bypassed/lowercased request
 * can never create a second "Freya" alongside "FREYA".
 *
 * Rules:
 *   "freya"   -> "FREYA"
 *   "Freya"   -> "FREYA"
 *   "fReYa"   -> "FREYA"
 *   "  freya  " -> "FREYA"
 *   ""/"   "/null -> null  (never an empty string)
 */

/** trim -> collapse inner whitespace -> uppercase. Returns null when empty. */
export function normalizeMemberName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const collapsed = input.trim().replace(/\s+/g, " ");
  if (!collapsed) return null;
  return collapsed.toUpperCase();
}

/** Uppercase normaliser for other free-text labels (custom idol names). */
export function normalizeLabel(input: unknown): string | null {
  return normalizeMemberName(input);
}

/** Free-text notes: trimmed, empty becomes null. Case is preserved. */
export function normalizeNote(input: unknown, max = 500): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

/** Usernames: lowercase, no spaces, used for uniqueness checks and login. */
export function normalizeUsername(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, "");
  return cleaned || null;
}

/** Emails: lowercase + trim only (validation happens in Zod). */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.trim().toLowerCase();
  return cleaned || null;
}

export const NO_MEMBER_LABEL = "NO MEMBER";
