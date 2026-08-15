import { auth } from "@/lib/auth";
import { exchangeCode, verifyState } from "@/lib/gmail";

/**
 * Where Google sends you back.
 *
 * Also session-gated: the redirect lands in the same browser that started it, so
 * the cookie is there. The signed `state` is checked on top of that, which is
 * belt and braces for a route that is already behind the gate — cheap, and it
 * means a link someone else crafts cannot attach *their* mailbox to this app.
 *
 * Failures come back as a query parameter on `/ledger/connections` rather than
 * as a 500, because this is a page a person is looking at: "Google returned no
 * refresh token" is actionable and a stack trace is not.
 */
export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user) return new Response("Not signed in", { status: 401 });

  const url = new URL(request.url);
  const back = new URL("/ledger/connections", url.origin);

  const denied = url.searchParams.get("error");
  if (denied) {
    back.searchParams.set("gmail", `Google said: ${denied}`);
    return Response.redirect(back, 302);
  }

  if (!verifyState(url.searchParams.get("state"))) {
    back.searchParams.set("gmail", "That sign-in did not start here. Try again.");
    return Response.redirect(back, 302);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    back.searchParams.set("gmail", "Google sent no authorisation code.");
    return Response.redirect(back, 302);
  }

  try {
    const { email } = await exchangeCode(code, url.origin);
    back.searchParams.set("gmailOk", email);
  } catch (cause) {
    back.searchParams.set(
      "gmail",
      cause instanceof Error ? cause.message : "Could not finish connecting Gmail.",
    );
  }

  return Response.redirect(back, 302);
}
