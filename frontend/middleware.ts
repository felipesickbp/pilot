import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const APP_HOST = "app.bp-pilot.ch";
const MARKETING_HOSTS = new Set(["bp-pilot.ch", "www.bp-pilot.ch"]);
const AUTH_COOKIE = "bp_auth_sid";

// paths that belong to the app, not the marketing site
const APP_PATHS = [
  "/login",
  "/dashboard",
  "/upload",
  "/preview",
  "/cleanup",
  "/spreadsheet",
  "/posting-rules",
  "/direct-import",
  "/history",
  "/complete",
  "/clients",
];

const APP_PUBLIC_PATHS = new Set(["/login", "/terms"]);

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") || "").split(":")[0];
  const { pathname, search } = req.nextUrl;

  if (host === APP_HOST) {
    const authCookie = req.cookies.get(AUTH_COOKIE)?.value;

    if (pathname === "/") {
      const url = req.nextUrl.clone();
      url.pathname = authCookie ? "/dashboard" : "/login";
      return NextResponse.redirect(url, 307);
    }

    if (!APP_PUBLIC_PATHS.has(pathname) && !authCookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname + (search || ""));
      return NextResponse.redirect(url, 307);
    }

    if (pathname === "/login" && authCookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url, 307);
    }

    return NextResponse.next();
  }

  // Only apply marketing-domain rewrites/redirects on bp-pilot.ch
  if (!MARKETING_HOSTS.has(host)) return NextResponse.next();

  // Redirect app routes to app subdomain
  for (const p of APP_PATHS) {
    if (pathname === p || pathname.startsWith(p + "/")) {
      return NextResponse.redirect(`https://${APP_HOST}${pathname}${search}`, 308);
    }
  }

  // Rewrite root to landing page route
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/landing";
    return NextResponse.rewrite(url);
  }

  // everything else on bp-pilot.ch stays as-is (e.g. /terms)
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon.ico|robots.txt|sitemap.xml).*)"],
};
