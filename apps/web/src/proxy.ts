import { NextResponse, type NextRequest } from "next/server";

// Optimistic routing only: the hint cookie says "a session probably exists".
// Real authorization happens in the API on every request.
const SESSION_HINT = "cl_session";

const AUTH_PAGES = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_HINT);
  const isAuthPage = AUTH_PAGES.includes(pathname);

  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isAuthPage && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + search);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/dashboard/:path*",
    "/schedule/:path*",
    "/employees/:path*",
    "/time-off/:path*",
    "/settings/:path*",
    "/me/:path*",
  ],
};
