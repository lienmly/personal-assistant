import { AlertCircle, Check, Clock, Loader } from "lucide-react";

import type { JobView } from "@/components/ledger/types";
import { cn } from "@/lib/utils";

/**
 * What the automation has actually been doing.
 *
 * Failures sort first regardless of age, which is the whole point: a job that
 * failed on Tuesday matters more than one that succeeded this morning, and a
 * strictly chronological list is how three weeks of stale balances go unnoticed.
 *
 * A failed row says what failed *and* stops there — the retry is automatic with
 * backoff until it gives up, so a "retry" button here would mostly be a way to
 * burn through the remaining attempts by hand.
 */
export function JobLog({ jobs }: { jobs: JobView[] }) {
  if (jobs.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        Nothing has run yet. Jobs are queued when you open the Ledger and run
        once the page has painted.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {jobs.map((job) => (
        <li
          key={job.id}
          className="flex items-start gap-2.5 rounded-chip px-2 py-1.5 text-[13px]"
        >
          <span className="mt-0.5 shrink-0">
            {job.status === "failed" ? (
              <AlertCircle className="size-3.5 text-bad" strokeWidth={2} />
            ) : job.status === "running" ? (
              <Loader className="size-3.5 text-muted" strokeWidth={2} />
            ) : job.status === "pending" ? (
              <Clock className="size-3.5 text-faint" strokeWidth={2} />
            ) : (
              <Check className="size-3.5 text-good" strokeWidth={2} />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="text-ink">{job.kindLabel}</span>
            {job.result && (
              <span className="ml-1.5 text-muted">{job.result}</span>
            )}
            {job.error && (
              <span
                className={cn(
                  "ml-1.5",
                  job.status === "failed" ? "text-bad" : "text-warn",
                )}
              >
                {job.error}
                {job.status === "pending" && job.attempts > 0 && (
                  <span className="text-faint">
                    {" "}
                    — retrying (attempt {job.attempts})
                  </span>
                )}
              </span>
            )}
          </span>

          <span className="shrink-0 text-xs text-faint">{job.whenLabel}</span>
        </li>
      ))}
    </ul>
  );
}
