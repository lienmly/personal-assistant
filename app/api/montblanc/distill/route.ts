import { auth } from "@/lib/auth";
import { distill, ensureDistilled } from "@/lib/montblanc/memory";

/**
 * Turns a finished conversation into notes. Nobody is ever waiting on this.
 *
 * Two triggers, and the second exists because the first is not reliable:
 *
 * - **`{ conversationId }`**, sent when the drawer closes, so a note is in place
 *   within seconds of the conversation ending.
 * - **`{ sweep: true }`**, sent when the drawer opens, which picks up whatever
 *   the close never delivered — a tab killed, a phone locked, a request that
 *   lost its network on the way out. It is deliberately not a cron:
 *   `ensureSeriesSlots` (`lib/studio.ts`) has kept the posting cadence alive
 *   since Phase 2 on exactly this bargain, and there is nothing here worth
 *   standing up infrastructure to run.
 *
 * A route handler rather than a server action because the close call has to
 * survive the component unmounting, which is what `fetch(..., { keepalive:
 * true })` is for and what a server action cannot promise.
 *
 * **It re-checks the session**, like every other route handler here — this one
 * spends money on model calls, so ungated it is a bill anybody could run up.
 */

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Not signed in", { status: 401 });
  }

  let body: { conversationId?: unknown; sweep?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // `sendBeacon` and a keepalive fetch can both arrive with an empty body.
    // Treating that as a sweep is the useful reading rather than an error.
    body = { sweep: true };
  }

  try {
    if (typeof body.conversationId === "string" && body.conversationId) {
      await distill(body.conversationId);
    } else if (body.sweep) {
      await ensureDistilled();
    }
  } catch {
    // Swallowed on purpose. There is no screen this could report to, and a
    // failed distillation costs one set of notes rather than anything the
    // person can see.
  }

  // 204: there is nothing to say back, and the caller is not listening.
  return new Response(null, { status: 204 });
}
