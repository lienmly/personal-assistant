import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Clan Centurio is a private dashboard. Only e-mail addresses listed in
 * AUTH_ALLOWLIST (comma-separated) may sign in — everyone else is bounced at
 * the `signIn` callback, even though they hold a valid Google account.
 *
 * This deliberately FAILS CLOSED: an empty or missing allowlist locks
 * everybody out rather than letting the whole internet in. If you can't log
 * in, check AUTH_ALLOWLIST first.
 */
const allowlist = (process.env.AUTH_ALLOWLIST ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  // JWT sessions mean no database is required yet. When Postgres and Prisma
  // land in Phase 2 we can switch to a database adapter for persisted
  // sessions — nothing else in the app has to change.
  session: { strategy: "jwt" },
  // Railway sits behind a proxy and isn't Vercel, so Auth.js needs to be told
  // it can trust the forwarded host header when building callback URLs.
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email || !profile?.email_verified) return false;
      return allowlist.includes(email);
    },
  },
});
