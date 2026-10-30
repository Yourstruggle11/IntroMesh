import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/home", "/discover", "/connect", "/intros", "/billing", "/settings", "/onboarding", "/pay", "/admin", "/people", "/notifications"];

/**
 * Lightweight gate: bounce visitors without a session cookie away from app pages.
 * Real authorization happens server-side on every page, action and route handler.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (needsAuth && !request.cookies.get("im_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
