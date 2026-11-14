import { NextResponse, type NextRequest } from "next/server";

const AUTH_ROUTES = ["/login", "/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get("opsledger_session")?.value);
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  // Cookie presence alone is not proof of a valid session. Redirecting away
  // from /login here would loop when the database no longer has the session;
  // the auth layout validates it against the database instead.
  if (!hasSession && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/requests/:path*",
    "/approvals/:path*",
    "/vendors/:path*",
    "/analytics/:path*",
    "/contracts/:path*",
    "/audit/:path*",
    "/settings/:path*",
    "/login",
    "/signup",
  ],
};
