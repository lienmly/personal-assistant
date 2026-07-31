import { redirect } from "next/navigation";

/**
 * Clan Centurio is entirely auth-gated, so there's no public landing page to
 * show. Signed-in visitors go straight to Today; everyone else is caught by
 * `proxy.ts` and sent to /login before they ever reach this.
 *
 * (This replaced the Phase 0 "hello world" shell, which had done its job of
 * proving the Railway pipeline end to end.)
 */
export default function RootPage() {
  redirect("/today");
}
