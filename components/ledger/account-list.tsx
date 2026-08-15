"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

import type { AccountView, GroupView } from "@/components/ledger/types";
import { setAccountIncluded } from "@/lib/ledger-actions";
import { cn } from "@/lib/utils";

/**
 * Every account, grouped by what it means rather than by which bank it is at.
 *
 * Grouping by institution is the obvious alternative and it answers a question
 * nobody asks. You do not think "what is at Chase"; you think "how much can I
 * spend" and "how much do I owe", and those are `netWorthGroupFor`'s buckets.
 * The institution is still on every row, in the place a subtitle goes.
 */
export function AccountList({ groups }: { groups: GroupView[] }) {
  const withAccounts = groups.filter((group) => group.accounts.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {withAccounts.map((group, index) => (
        <section
          key={group.group}
          className="animate-rise"
          style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
        >
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-[13px] font-medium text-muted">{group.label}</h3>
            <span
              className={cn(
                "text-[13px] tabular-nums",
                group.group === "owed" ? "text-bad" : "text-ink",
              )}
            >
              {group.totalLabel}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {group.accounts.map((account) => (
              <AccountRow key={account.id} account={account} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function AccountRow({ account }: { account: AccountView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      const result = await setAccountIncluded(
        account.id,
        !account.includeInNetWorth,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-tile bg-inset px-4 py-3 transition-opacity duration-(--duration-base) ease-soft",
        pending && "pointer-events-none opacity-45",
        // An excluded account stays listed and reads as set aside. Hiding it
        // outright would make it impossible to put back.
        !account.includeInNetWorth && "opacity-55",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] text-ink">
          {account.name}
          {account.mask && (
            <span className="ml-1.5 text-faint">···{account.mask}</span>
          )}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 truncate text-xs text-muted">
          <span>{account.institutionName}</span>
          <span className="text-faint">·</span>
          <span>{account.kindLabel}</span>
          {account.syncedLabel && (
            <>
              <span className="text-faint">·</span>
              <span className="text-faint">{account.syncedLabel}</span>
            </>
          )}
          {account.needsAttention && (
            <span className="inline-flex items-center gap-1 text-bad">
              <AlertCircle className="size-3" strokeWidth={2} />
              Needs signing in again
            </span>
          )}
        </p>
        {error && <p className="mt-1 text-xs text-bad">{error}</p>}
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[14px] tabular-nums text-ink">
          {account.balanceLabel}
        </p>
        {account.availableLabel && account.group !== "owed" && (
          <p className="text-xs text-faint">{account.availableLabel} available</p>
        )}
        {account.limitLabel && account.group === "owed" && (
          <p className="text-xs text-faint">of {account.limitLabel}</p>
        )}
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-label={
          account.includeInNetWorth
            ? `Leave ${account.name} out of net worth`
            : `Count ${account.name} in net worth`
        }
        title={
          account.includeInNetWorth
            ? "Counted in net worth"
            : "Not counted in net worth"
        }
        // §9: hover is not an affordance on a phone, so this is visible outright
        // below `sm` and revealed on hover on a pointer device.
        className="shrink-0 rounded-chip p-1.5 text-faint transition-[color,opacity] duration-(--duration-quick) hover:text-ink active:scale-[0.97] sm:opacity-0 sm:group-hover:opacity-100"
      >
        {account.includeInNetWorth ? (
          <Eye className="size-4" strokeWidth={1.8} />
        ) : (
          <EyeOff className="size-4" strokeWidth={1.8} />
        )}
      </button>
    </div>
  );
}
