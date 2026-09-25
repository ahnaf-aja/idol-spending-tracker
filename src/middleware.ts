import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, decideRedirect } from "@/lib/route-guard";

/**
 * Fast, cookie-only gate. Middleware runs before any page or server action, so
 * an unauthenticated request to a protected route is redirected to /login
 * without ever rendering the page. The cookie's authenticity and expiry are
 * verified for real in the (app) layout against the database.
 *
 * Authenticated users are also bounced away from the auth pages.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const decision = decideRedirect(pathname, search, hasSessionCookie);

  if (decision.type === "redirect") {
    const url = request.nextUrl.clone();
    url.pathname = decision.to;
    url.search = "";
    if (decision.next) url.searchParams.set("next", decision.next);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/expenses/:path*",
    "/history/:path*",
    "/journal/:path*",
    "/statistics/:path*",
    "/budget/:path*",
    "/profile/:path*",
    "/login",
    "/register",
    "/forgot-password",
  ],
};
