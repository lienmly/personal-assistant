"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Landmark, RefreshCw } from "lucide-react";

import {
  completePlaidLink,
  createLinkTokenAction,
} from "@/lib/ledger-actions";
import { cn } from "@/lib/utils";

/**
 * The only thing in the app that talks to Plaid Link.
 *
 * **`next/script` and `Plaid.create`, not `react-plaid-link`** — that package is
 * a hook around this CDN script, and the hook is the whole package. Fifteen
 * lines here against a dependency in a repo that has six (§8).
 *
 * The script is loaded `lazyOnload` rather than in the layout, because it is
 * ~90KB that every other surface in the app has no use for. The cost is that
 * the first press may find `window.Plaid` still absent, so `open()` waits for
 * it rather than assuming — a button that silently does nothing on the first
 * click is worse than one that takes a moment.
 */

type PlaidHandler = { open: () => void; destroy: () => void };

type PlaidLinkMetadata = {
  institution?: { name?: string | null } | null;
};

declare global {
  interface Window {
    Plaid?: {
      create: (config: {
        token: string;
        onSuccess: (publicToken: string, metadata: PlaidLinkMetadata) => void;
        onExit: (error: unknown) => void;
      }) => PlaidHandler;
    };
  }
}

/** Waits for the CDN script, then gives up with a sentence rather than
 *  hanging. Ten seconds is long past the point where the network is the
 *  explanation. */
async function plaidReady(timeoutMs = 10_000): Promise<boolean> {
  const started = Date.now();
  while (!window.Plaid) {
    if (Date.now() - started > timeoutMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return true;
}

export function LinkBankButton({
  /** Set to reopen Link in update mode for a broken connection. */
  itemId,
  label = "Link a bank",
  tone = "accent",
}: {
  itemId?: string;
  label?: string;
  tone?: "accent" | "quiet";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => {
    setError(null);

    startTransition(async () => {
      const token = await createLinkTokenAction(itemId);
      if (!token.ok) {
        setError(token.message);
        return;
      }

      if (!(await plaidReady())) {
        setError("Plaid's script did not load. Check the connection and retry.");
        return;
      }

      const handler = window.Plaid!.create({
        token: token.linkToken,
        onSuccess: (publicToken, metadata) => {
          // Not inside `startTransition`: this fires from Plaid's own callback,
          // long after the transition that opened Link has settled.
          void completePlaidLink(
            publicToken,
            metadata.institution?.name ?? null,
          ).then((result) => {
            if (!result.ok) {
              setError(result.message);
              return;
            }
            // `revalidatePath` in the action marks the server cache; nothing
            // tells the client router to re-render without this. Same rule
            // Montblanc's writes follow (§6, "A receipt is what a confirmation
            // step would have cost you").
            router.refresh();
          });
          handler.destroy();
        },
        onExit: () => handler.destroy(),
      });

      handler.open();
    });
  }, [itemId, router]);

  return (
    <div className="flex flex-col items-start gap-2">
      <Script
        src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"
        strategy="lazyOnload"
      />

      <button
        type="button"
        onClick={open}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-2 rounded-chip px-4 py-2 text-[13px] font-medium transition-[background-color,transform,opacity] duration-(--duration-base) ease-soft active:scale-[0.97]",
          tone === "accent"
            ? "bg-accent text-white hover:bg-accent-hover"
            : "bg-inset text-ink hover:bg-line/60",
          pending && "pointer-events-none opacity-45",
        )}
      >
        {itemId ? (
          <RefreshCw className="size-3.5" strokeWidth={2} />
        ) : (
          <Landmark className="size-3.5" strokeWidth={2} />
        )}
        {pending ? "Opening…" : label}
      </button>

      {error && <p className="text-xs text-bad">{error}</p>}
    </div>
  );
}
