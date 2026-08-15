import { auth } from "@/lib/auth";
import { secretEquals } from "@/lib/crypto-box";
import { drain } from "@/lib/ledger-jobs";

/**
 * Runs whatever the Ledger has queued.
 *
 * Called by `components/ledger/jobs-kick.tsx` once a Ledger page has painted.
 * A route handler rather than a server action because it is fire-and-forget from
 * an effect, and because it needs a second way in.
 *
 * **Session or bearer token.** A route handler is its own public endpoint — the
 * same rule `app/api/journal/media/[id]/route.ts` states — so the session is
 * re-checked here rather than trusted from the proxy. The bearer alternative
 * exists so a Railway cron can hit this later without reopening the design: the
 * read-triggered pattern is honest but degrades if the Ledger is not opened for
 * a fortnight, and when that becomes annoying the fix should be a Railway
 * setting rather than a refactor.
 *
 * `LEDGER_JOB_TOKEN` is compared in constant time. It is a shared secret in a
 * header, so a timing oracle is the one attack it is actually exposed to.
 */
export async function POST(request: Request): Promise<Response> {
  if (!(await authorised(request))) {
    return new Response("Not signed in", { status: 401 });
  }

  try {
    const ran = await drain();
    return Response.json({ ran });
  } catch (cause) {
    // A throw here means the runner itself broke, not a job — a job's own
    // failure is caught and recorded on its row with a backoff.
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Job runner failed." },
      { status: 500 },
    );
  }
}

async function authorised(request: Request): Promise<boolean> {
  const session = await auth();
  if (session?.user) return true;

  const expected = process.env.LEDGER_JOB_TOKEN;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const offered = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!offered) return false;

  return secretEquals(offered, expected);
}
