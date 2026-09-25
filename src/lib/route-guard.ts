/**
 * Route guard rules, kept out of middleware.ts because Next.js only allows
 * `middleware` and `config` to be exported from that file.
 *
 * This is the cheap cookie-level check that runs at the edge. The
 * authoritative check (database-verified session) happens in the (app) layout.
 */

export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/expenses",
  "/history",
  "/journal",
  "/statistics",
  "/budget",
  "/profile",
];

export const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

export const SESSION_COOKIE = "ist_session";

export type RedirectDecision =
  | { type: "redirect"; to: string; next?: string }
  | { type: "next" };

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Where should a request go, given its path and whether a session cookie exists? */
export function decideRedirect(
  pathname: string,
  search: string,
  hasSessionCookie: boolean,
): RedirectDecision {
  if (isProtectedPath(pathname) && !hasSessionCookie) {
    return { type: "redirect", to: "/login", next: `${pathname}${search}` };
  }

  if (hasSessionCookie && AUTH_PAGES.includes(pathname)) {
    return { type: "redirect", to: "/dashboard" };
  }

  return { type: "next" };
}
