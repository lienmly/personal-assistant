import type { LedgerJob } from "@prisma/client";

import { db } from "@/lib/db";
import { SYNC_STALE_HOURS } from "@/lib/ledger-rules";
import { moneyLabel } from "@/lib/money";
import { lastScanAt, scanMail } from "@/lib/gmail-ingest";
import { staleValuations } from "@/lib/property";
import { extractStatement } from "@/lib/statement-extract";
import { draftRuleSetFor, shouldDraftNextYear } from "@/lib/tax/rules-update";
import {
  MONTHLY_CALL_CEILING,
  estimateProperty,
  rentcastConfigured,
  rentcastProblem,
} from "@/lib/rentcast";
import { PlaidError } from "@/lib/plaid";
import {
  refreshItemMeta,
  syncBalances,
  syncHoldingsFor,
  syncLiabilitiesFor,
  syncTransactionsFor,
} from "@/lib/plaid-sync";

/**
 * The Ledger's outbound work, made visible.
 *
 * This app has no cron and no scheduler, and that is a decision rather than an
 * omission: `ensureSeriesSlots` has kept the posting cadence alive on a
 * materialise-on-read since Phase 2, and `ensureDistilled` does the same for
 * Montblanc's memory. The bargain is the same here — there is nothing in the
 * Ledger worth standing infrastructure up to run, because a bank balance that is
 * an hour stale is a bank balance, and Plaid's sync cursor never expires so
 * nothing is ever *lost* by looking late.
 *
 * What is different is the failure mode, and it is why this file exists at all.
 * `ensureSeriesSlots` computes rows from data already in hand; these jobs reach
 * a third party over a network, so they can fail — and **the failure mode of
 * automation is that it stops without saying so.** A materialise-on-read that
 * swallows an exception is worse than a cron, because with a cron there is at
 * least a log. So every outbound call gets a row, `/ledger/connections` is a
 * list of those rows, and the sync strip at the top of every Ledger page reads
 * the worst of them.
 *
 * The second job of this file is to keep the slow half off the render.
 * `ensureLedgerJobs()` runs during the page's data pass, decides what is due,
 * enqueues it and returns — it never awaits a bank. `components/ledger/jobs-kick.tsx`
 * POSTs `/api/ledger/jobs/run` once the page has painted, and that is what
 * actually drains the queue.
 */

/** Five, then give up and say so. A bank that has failed five times with
 *  backoff is not having a bad minute, and a queue that retries forever is a
 *  queue that hides a broken credential behind an endless "pending". */
const MAX_ATTEMPTS = 5;

/** How many jobs one drain may run. The runner is called from a page that has
 *  already rendered, so this bounds how long that request stays open. */
const DRAIN_LIMIT = 4;

export type LedgerJobKind =
  | "plaid_item_meta"
  | "plaid_balances"
  // Layer 2 onward. Listed here so the dispatch table below is a total switch
  // and adding one is a compile error until it is handled.
  | "plaid_sync"
  | "plaid_holdings"
  | "plaid_liabilities"
  | "gmail_scan"
  | "statement_extract"
  | "rentcast_refresh"
  | "tax_rules_draft";

/**
 * Exponential, ×5, capped at six hours.
 *
 * Living on the row rather than in a retry loop is what stops a bank being down
 * for an hour from being hammered once per page load — the queue simply does not
 * pick the job up again until `runAfter`. A tight in-process retry would also
 * hold the runner's request open through every one of them.
 */
export function backoffFor(attempts: number): Date {
  const minutes = Math.min(6 * 60, 1 * 5 ** attempts);
  return new Date(Date.now() + minutes * 60_000);
}

/**
 * Add a job unless the same one is already waiting.
 *
 * Deduping on `(kind, refId, pending|running)` is what makes this safe to call
 * from a render. Without it, opening the Ledger in three tabs queues three
 * balance refreshes for the same bank, and Plaid rate-limits per item.
 */
export async function enqueue(
  kind: LedgerJobKind,
  refId: string | null = null,
): Promise<void> {
  const existing = await db.ledgerJob.findFirst({
    where: { kind, refId, status: { in: ["pending", "running"] } },
    select: { id: true },
  });
  if (existing) return;

  await db.ledgerJob.create({
    data: { kind, refId },
    select: { id: true },
  });
}

/**
 * Decide what is due, and queue it. Never awaits a third party.
 *
 * Called from `/ledger`'s data pass. The one rule it follows is that everything
 * it enqueues is **idempotent and cheap to have queued** — this runs on every
 * page load, so a job that is expensive to schedule wrongly does not belong
 * here.
 *
 * This is also what makes the Plaid webhook an *optimisation* rather than a
 * dependency: an item nobody has heard from in a day gets refreshed because you
 * opened the page, so a webhook that never arrived costs a delay and never a
 * hole. It is what let Layer 1 be built and verified before a public URL for the
 * webhook existed at all.
 */
export async function ensureLedgerJobs(): Promise<void> {
  const stale = new Date(Date.now() - SYNC_STALE_HOURS * 60 * 60_000);

  const items = await db.plaidItem.findMany({
    where: {
      // A revoked or removed item is not refreshed: the call would fail, and
      // the answer is a human running Link again, not a retry.
      status: { notIn: ["revoked", "removed"] },
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: stale } }],
    },
    select: { id: true },
  });

  for (const item of items) {
    // Order matters and is not alphabetical. Balances create the `Account` rows,
    // and `syncTransactionsFor` *skips* a transaction whose account it has never
    // seen — sync only ever reports changes, so a skipped row is never offered
    // again. Balances first, therefore, on every path that creates an item.
    await enqueue("plaid_balances", item.id);
    await enqueue("plaid_sync", item.id);
    await enqueue("plaid_holdings", item.id);
    await enqueue("plaid_liabilities", item.id);
  }

  // Valuations, only where RentCast is configured at all — queueing a job that
  // can only fail would fill the connections page with red about a feature
  // nobody switched on.
  if (rentcastConfigured()) {
    for (const property of await staleValuations()) {
      await enqueue("rentcast_refresh", property.id);
    }
  }

  // The mailbox, at most once an hour. Gmail push would need a Pub/Sub topic and
  // a `users.watch` that expires every seven days — a scheduler, for a document
  // that arrives monthly. Once an hour on a monthly document is absurd headroom
  // for zero infrastructure (§6).
  const lastScan = await lastScanAt();
  const hourAgo = new Date(Date.now() - 60 * 60_000);
  if (!lastScan || lastScan < hourAgo) {
    const connected = await db.oAuthCredential.findFirst({
      where: { provider: "google", revokedAt: null },
      select: { id: true },
    });
    if (connected) await enqueue("gmail_scan");
  }

  // Next year's tax constants, once the IRS has published them. Drafting is
  // automatic; **confirming is not** — the draft is filed beside the verified
  // set with each number's source line, and nothing goes live until a person
  // reads them (§6).
  const nextYear = shouldDraftNextYear();
  if (nextYear && process.env.DEEPSEEK_API_KEY) {
    for (const jurisdiction of ["federal", "wa"] as const) {
      const already = await db.taxRuleSet.findFirst({
        where: { taxYear: nextYear, jurisdiction },
        select: { id: true },
      });
      if (!already) {
        await enqueue("tax_rules_draft", `${nextYear}:${jurisdiction}`);
      }
    }
  }
}

/**
 * Refresh one property's value, if the month's allowance has room.
 *
 * The quota check is **inside the job rather than at the call site**, because
 * this is the only place that knows how many calls have already gone out — and
 * because a refusal here is recorded as a job result, which is where somebody
 * would look to find out why a value stopped updating.
 *
 * Going over the allowance returns a sentence rather than throwing: it is an
 * expected condition, and a `failed` job with backoff would keep retrying
 * against a limit that only resets on the 1st.
 */
async function refreshPropertyValuation(propertyId: string): Promise<string> {
  const problem = rentcastProblem();
  if (problem) return problem;

  const monthStart = new Date();
  const since = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1),
  );
  const used = await db.propertyValuation.count({
    where: { createdAt: { gte: since } },
  });
  // Two calls per refresh — value and rent.
  if (used * 2 >= MONTHLY_CALL_CEILING) {
    return `This month's valuation allowance is spent (${used} refreshes). It resets on the 1st.`;
  }

  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      label: true,
      addressLine: true,
      city: true,
      state: true,
      postalCode: true,
    },
  });
  if (!property) throw new Error("No such property.");

  const estimate = await estimateProperty(property);

  const now = new Date();
  const on = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  await db.property.update({
    where: { id: property.id },
    data: {
      valueCents: estimate.valueCents,
      valueLowCents: estimate.valueLowCents,
      valueHighCents: estimate.valueHighCents,
      rentEstimateCents: estimate.rentCents,
      valuationAt: now,
      valuationSource: "RentCast",
    },
    select: { id: true },
  });

  await db.propertyValuation.upsert({
    where: { propertyId_on: { propertyId: property.id, on } },
    update: {
      valueCents: estimate.valueCents,
      valueLowCents: estimate.valueLowCents,
      valueHighCents: estimate.valueHighCents,
      rentCents: estimate.rentCents,
      source: "RentCast",
    },
    create: {
      propertyId: property.id,
      on,
      valueCents: estimate.valueCents,
      valueLowCents: estimate.valueLowCents,
      valueHighCents: estimate.valueHighCents,
      rentCents: estimate.rentCents,
      source: "RentCast",
    },
    select: { id: true },
  });

  return `Valued ${property.label} at ${moneyLabel(estimate.valueCents)}.`;
}

/**
 * Run up to `limit` due jobs.
 *
 * The claim is an `updateMany` guarded on `status: "pending"` rather than a read
 * followed by a write, so two runners racing cannot both take the same job —
 * Postgres decides, and the loser sees `count === 0` and moves on. A
 * `SELECT … FOR UPDATE SKIP LOCKED` would be the textbook answer and needs a raw
 * query; this is the same guarantee for one statement of Prisma.
 */
export async function drain(limit = DRAIN_LIMIT): Promise<number> {
  const due = await db.ledgerJob.findMany({
    where: { status: "pending", runAfter: { lte: new Date() } },
    // `createdAt` breaks the tie when several jobs were queued together, and
    // `id` breaks it again when they landed in the same millisecond — cuids are
    // monotonic within a process, so this approximates insertion order. It is
    // only an approximation, which is why `syncTransactionsFor` refuses to
    // advance its cursor rather than trusting the queue to have ordered itself.
    orderBy: [{ runAfter: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true },
  });

  let ran = 0;

  for (const { id } of due) {
    const claimed = await db.ledgerJob.updateMany({
      where: { id, status: "pending" },
      data: { status: "running", startedAt: new Date() },
    });
    if (claimed.count !== 1) continue;

    const job = await db.ledgerJob.findUnique({ where: { id } });
    if (!job) continue;

    await runClaimed(job);
    ran += 1;
  }

  return ran;
}

async function runClaimed(job: LedgerJob): Promise<void> {
  try {
    const result = await runJob(job);
    await db.ledgerJob.update({
      where: { id: job.id },
      data: {
        status: "done",
        finishedAt: new Date(),
        result,
        error: null,
        attempts: job.attempts + 1,
      },
      select: { id: true },
    });
  } catch (cause) {
    const attempts = job.attempts + 1;
    const message = cause instanceof Error ? cause.message : String(cause);
    const exhausted = attempts >= MAX_ATTEMPTS;

    await db.ledgerJob.update({
      where: { id: job.id },
      data: {
        // Back to `pending` with a later `runAfter` is the retry; `failed` is
        // terminal and is what the connections page shows in crimson.
        status: exhausted ? "failed" : "pending",
        attempts,
        runAfter: backoffFor(attempts),
        finishedAt: exhausted ? new Date() : null,
        error: message,
      },
      select: { id: true },
    });
  }
}

/**
 * What each kind actually does.
 *
 * Returns the one sentence the connections page shows. Throwing is how a job
 * fails — the wrapper above turns that into a retry with backoff, so nothing
 * here needs a try/catch of its own.
 */
async function runJob(job: LedgerJob): Promise<string> {
  const kind = job.kind as LedgerJobKind;

  switch (kind) {
    case "plaid_item_meta": {
      if (!job.refId) throw new Error("plaid_item_meta needs an item.");
      await refreshItemMeta(job.refId);
      return "Checked the connection.";
    }

    case "plaid_balances": {
      if (!job.refId) throw new Error("plaid_balances needs an item.");
      return syncBalances(job.refId);
    }

    case "plaid_sync": {
      if (!job.refId) throw new Error("plaid_sync needs an item.");
      return syncTransactionsFor(job.refId);
    }

    case "plaid_holdings": {
      if (!job.refId) throw new Error("plaid_holdings needs an item.");
      return syncHoldingsFor(job.refId);
    }

    case "plaid_liabilities": {
      if (!job.refId) throw new Error("plaid_liabilities needs an item.");
      // Not every item has liabilities, and Plaid answers a request for a
      // product the institution does not support with an error rather than an
      // empty list. That is not a failure worth retrying five times with
      // backoff, so it is reported as a result instead.
      try {
        return await syncLiabilitiesFor(job.refId);
      } catch (cause) {
        if (
          cause instanceof PlaidError &&
          (cause.code === "PRODUCTS_NOT_SUPPORTED" ||
            cause.code === "NO_LIABILITY_ACCOUNTS" ||
            cause.code === "PRODUCT_NOT_READY")
        ) {
          return "No loans at this institution.";
        }
        throw cause;
      }
    }

    case "rentcast_refresh": {
      if (!job.refId) throw new Error("rentcast_refresh needs a property.");
      return refreshPropertyValuation(job.refId);
    }

    case "gmail_scan":
      return scanMail();

    case "statement_extract": {
      if (!job.refId) throw new Error("statement_extract needs a statement.");
      return extractStatement(job.refId);
    }

    case "tax_rules_draft": {
      // `refId` is "<year>:<jurisdiction>" — the one job whose subject is not a
      // database row, so it carries its own.
      const [year, jurisdiction] = (job.refId ?? "").split(":");
      const taxYear = Number(year);
      if (!Number.isInteger(taxYear) || (jurisdiction !== "federal" && jurisdiction !== "wa")) {
        throw new Error("tax_rules_draft needs a year and a jurisdiction.");
      }
      return draftRuleSetFor(taxYear, jurisdiction);
    }

    default: {
      const exhaustive: never = kind;
      throw new Error(`Unknown job kind: ${String(exhaustive)}`);
    }
  }
}
