import Link from "next/link";
import { AlertCircle, Check } from "lucide-react";

import type { LedgerStatusView } from "@/components/ledger/types";

/**
 * One calm line saying whether the automation is actually running.
 *
 * This is where "automate everything" becomes visible, and it exists because of
 * the one thing automation does badly: **it stops without saying so.** Every
 * other surface in this app shows you data you entered, so a bug is obvious. A
 * Ledger whose last successful sync was eleven days ago looks exactly like a
 * Ledger that synced this morning — the numbers are all still there, they are
 * just wrong.
 *
 * So the strip is on every Ledger page, it names how long ago, and it turns
 * crimson for the single case no amount of engineering can fix: a bank that
 * wants a person and a phone. That case gets the accent, which is §9's one per
 * region spent on the only thing here that needs a human.
 */
export function SyncStrip({ status }: { status: LedgerStatusView }) {
  if (status.setupProblem) return null;
  if (status.items.length === 0) return null;

  const attention = status.attention;

  const parts = [
    `${status.accountCount} ${status.accountCount === 1 ? "account" : "accounts"}`,
    status.syncedLabel ? `synced ${status.syncedLabel}` : "not synced yet",
  ];

  return (
    <Link
      href="/ledger/connections"
      className="mb-5 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-chip bg-inset px-3.5 py-2 text-[12.5px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
    >
      {attention.length > 0 ? (
        <AlertCircle className="size-3.5 shrink-0 text-accent" strokeWidth={2} />
      ) : (
        <Check className="size-3.5 shrink-0 text-good" strokeWidth={2} />
      )}

      <span>{parts.join(" · ")}</span>

      {attention.length > 0 && (
        <span className="font-medium text-accent">
          ·{" "}
          {attention.length === 1
            ? `${attention[0].institutionName} needs signing in again`
            : `${attention.length} banks need signing in again`}
        </span>
      )}
    </Link>
  );
}
