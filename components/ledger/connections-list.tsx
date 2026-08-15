"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, RefreshCw, Trash2 } from "lucide-react";

import { LinkBankButton } from "@/components/ledger/link-bank-button";
import type { ItemView } from "@/components/ledger/types";
import { disconnectItem, refreshAllItems } from "@/lib/ledger-actions";
import { cn } from "@/lib/utils";

/**
 * The banks, and what each one is doing.
 *
 * The screen that exists because automation fails quietly. Everything else in
 * the Ledger shows numbers; this shows whether those numbers are *current*, and
 * which connection to fix when they are not.
 */
export function ConnectionsList({ items }: { items: ItemView[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const refreshAll = () => {
    startTransition(async () => {
      await refreshAllItems();
      // The jobs are queued, not run — `JobsKick` on the next paint drains
      // them. Refreshing shows them as pending, which is the honest state.
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, index) => (
        <ConnectionRow key={item.id} item={item} index={index} />
      ))}

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <LinkBankButton label="Link another bank" tone="quiet" />
        {items.length > 0 && (
          <button
            type="button"
            onClick={refreshAll}
            disabled={pending}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-chip px-3.5 py-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink active:scale-[0.97]",
              pending && "pointer-events-none opacity-45",
            )}
          >
            <RefreshCw className="size-3.5" strokeWidth={1.8} />
            Refresh everything
          </button>
        )}
      </div>
    </div>
  );
}

function ConnectionRow({ item, index }: { item: ItemView; index: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await disconnectItem(item.id);
      if (!result.ok) {
        setError(result.message);
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        "animate-rise rounded-tile bg-inset px-4 py-3.5 transition-opacity duration-(--duration-base) ease-soft",
        pending && "pointer-events-none opacity-45",
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-medium text-ink">
            {item.institutionName}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {item.accountCount}{" "}
            {item.accountCount === 1 ? "account" : "accounts"}
            {item.syncedLabel ? ` · synced ${item.syncedLabel}` : " · not synced yet"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {/* Re-authentication is the one part of this that cannot be
              automated, so it gets the primary control on the row rather than
              being buried in a menu. */}
          {item.needsAttention && (
            <LinkBankButton
              itemId={item.id}
              label="Sign in again"
              tone="accent"
            />
          )}

          <button
            type="button"
            onClick={remove}
            onBlur={() => setConfirming(false)}
            aria-label={`Disconnect ${item.institutionName}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-xs transition-colors duration-(--duration-quick) active:scale-[0.97]",
              confirming
                ? "bg-accent-soft font-medium text-accent"
                : "text-faint hover:text-ink",
            )}
          >
            <Trash2 className="size-3.5" strokeWidth={1.8} />
            {confirming ? "Really disconnect?" : "Disconnect"}
          </button>
        </div>
      </div>

      {item.needsAttention && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-accent">
          <AlertCircle className="mt-0.5 size-3 shrink-0" strokeWidth={2} />
          <span>
            {item.statusDetail ??
              "The bank wants you to sign in again. Nothing syncs from here until you do."}
          </span>
        </p>
      )}

      {confirming && !error && (
        <p className="mt-2 text-xs text-muted">
          The accounts and their history stay — they just stop updating.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-bad">{error}</p>}
    </div>
  );
}
