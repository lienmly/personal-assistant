import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Next.js 16 renamed Middleware to Proxy — same behaviour, new filename.
 *
 * This is an *optimistic* gate: it keeps signed-out visitors from ever seeing
 * the shell. It is not the last line of defence — every surface also calls
 * `auth()` server-side via the (app) layout.
 */
export default auth((req) => {
  const isSignedIn = Boolean(req.auth);
  const { pathname } = req.nextUrl;
  const isLoginRoute = pathname === "/login";

  if (!isSignedIn && !isLoginRoute) {
    const url = new URL("/login", req.nextUrl.origin);
    if (pathname !== "/") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (isSignedIn && isLoginRoute) {
    return NextResponse.redirect(new URL("/today", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  // Skip the auth API itself, static assets, and image optimisation.
  //
  // The install files have to be here too, and for a reason that is easy to
  // miss: the browser fetches the manifest, the icons and the service worker
  // *before* anyone has signed in. Gated, each one 302s to /login — a manifest
  // that fails to parse costs the install prompt outright, and it does it
  // silently, with no error anywhere except a line in devtools nobody is
  // reading. None of them is private; they are a name, a moogle and a
  // twenty-line cache policy.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.svg$|.*\\.png$).*)",
  ],
};
