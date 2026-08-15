import { ArrowLeftRight, Clock } from "lucide-react";

import type { CategoryView } from "@/lib/ledger";
import type { TransactionView } from "@/lib/ledger";
import { cn } from "@/lib/utils";

/**
 * What actually happened, most recent first.
 *
 * **Transfers are listed and labelled rather than hidden.** They are excluded
 * from every *figure* — see `markTransfers` — but a list that silently omitted
 * a card payment would disagree with the bank statement beside it, and a ledger
 * you cannot reconcile against the source is one you stop trusting. The chip
 * says why it is not in the total.
 *
 * **Only a negative amount is coloured**, and only because its sign is the
 * point. §8's rule for `--color-bad`: a balance is never coloured, an expense is
 * not a loss, and a screen of red says nothing. Money in gets `--color-good`;
 * money out is ordinary ink, because most rows are money out and colouring them
 * all would make the colour meaningless.
 */
export function TransactionList({
  transactions,
}: {
  transactions: TransactionView[];
}) {
  if (transactions.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        No transactions yet. They arrive with the next sync — the first one after
        linking a bank pulls up to two years.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {transactions.map((tx, index) => (
        <li
          key={tx.id}
          className="animate-rise flex items-center gap-3 border-0 py-2.5"
          style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
        >
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[13.5px] text-ink">
              <span className="truncate">{tx.name}</span>
              {tx.pending && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-inset px-1.5 py-0.5 text-[11px] text-muted"
                  title="Not settled yet — still counted, because you have spent it"
                >
                  <Clock className="size-2.5" strokeWidth={2} />
                  Pending
                </span>
              )}
              {tx.isTransfer && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-inset px-1.5 py-0.5 text-[11px] text-muted"
                  title="Between two of your own accounts, so it is left out of spending"
                >
                  <ArrowLeftRight className="size-2.5" strokeWidth={2} />
                  Transfer
                </span>
              )}
            </p>
            <p className="mt-0.5 truncate text-xs text-faint">
              {[tx.dayLabel, tx.accountName, tx.categoryLabel]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <span
            className={cn(
              "shrink-0 text-[13.5px] tabular-nums",
              tx.amountCents > 0 ? "text-good" : "text-ink",
            )}
          >
            {tx.amountLabel}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Where this month's spending went.
 *
 * A bar per category on a shared scale, which is the same argument the monthly
 * columns make: the useful comparison is between categories, and separate scales
 * would flatten it.
 */
export function CategoryBreakdown({
  categories,
  monthLabel,
}: {
  categories: CategoryView[];
  monthLabel: string;
}) {
  if (categories.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        Nothing spent in {monthLabel} yet.
      </p>
    );
  }

  const peak = Math.max(...categories.map((category) => category.totalCents), 1);

  return (
    <ul className="flex flex-col gap-2.5">
      {categories.slice(0, 8).map((category, index) => (
        <li
          key={category.key}
          className="animate-rise"
          style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
        >
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink">{category.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {category.totalLabel}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-inset">
            <div
              className="h-full rounded-full bg-ink/45"
              style={{ width: `${(category.totalCents / peak) * 100}%` }}
              title={`${category.count} ${category.count === 1 ? "transaction" : "transactions"}`}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
