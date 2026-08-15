"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Drains the job queue once, after the page has painted. Renders nothing.
 *
 * `ensureLedgerJobs()` runs in the page's data pass and only *enqueues* — it
 * never awaits a bank, because a render that waits on Plaid is a Ledger that
 * takes four seconds to open on a phone. Something still has to run the queue,
 * and with no cron in this app (§6) that something is the page you just opened.
 *
 * Three details it needs:
 *
 * 1. **A ref guard, not just the effect's dependency array.** React runs effects
 *    twice in development's strict mode, and this one POSTs — two drains racing
 *    is survivable (the claim is an atomic `updateMany`) but it doubles the
 *    calls to a rate-limited API for nothing.
 * 2. **It only refreshes when something actually ran.** A router refresh on
 *    every page load would re-render the whole surface a second time to display
 *    identical data.
 * 3. **A failure is silent here and loud on the connections page.** There is
 *    nothing useful to say in a corner of the Net worth tab about a fetch that
 *    did not return; the job row records it, and the sync strip is what points
 *    at it.
 */
export function JobsKick() {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const controller = new AbortController();

    void fetch("/api/ledger/jobs/run", {
      method: "POST",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { ran?: number } | null) => {
        if (payload && typeof payload.ran === "number" && payload.ran > 0) {
          router.refresh();
        }
      })
      .catch(() => {
        // Aborted on unmount, or offline. The job row is the record.
      });

    return () => controller.abort();
  }, [router]);

  return null;
}
