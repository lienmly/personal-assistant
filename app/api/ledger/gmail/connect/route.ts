import { auth } from "@/lib/auth";
import { authUrl, gmailProblem, signState } from "@/lib/gmail";

/**
 * Starts the Gmail grant.
 *
 * **Session-gated, and it stays that way** — unlike the Plaid webhook, this is
 * reached from a button in a browser that already has a cookie, so there is no
 * reason to exempt it from `proxy.ts`. Sending an unauthenticated visitor into
 * Google's consent screen for *this* app's mailbox access is precisely what the
 * gate is for.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return new Response("Not signed in", { status: 401 });

  const problem = gmailProblem();
  if (problem) return new Response(problem, { status: 500 });

  const origin = new URL(request.url).origin;
  return Response.redirect(authUrl(origin, signState()), 302);
}
