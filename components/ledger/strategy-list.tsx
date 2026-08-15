"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";

import type { SurfacedStrategy } from "@/lib/tax/strategies";
import { setStrategyState } from "@/lib/tax-actions";
import { cn } from "@/lib/utils";

/**
 * Things worth asking an accountant about.
 *
 * **There is no button here that says "Do this."** Every entry is a question,
 * every question begins "Ask your accountant whether…", and the only action is
 * *Mark as raised*. That is structural rather than cautious: the gap between
 * "here is something worth asking about" and "here is what you should do" is the
 * gap between a tool and an unlicensed adviser.
 *
 * The figure beside each one is **an order of magnitude, not a promise** — every
 * strategy here turns on facts the app cannot see, so the number exists to say
 * "worth an hour of somebody's time", and the card says so.
 *
 * A declined strategy stops resurfacing for the year and comes back next year,
 * when the facts have changed.
 */

const STATE_LABEL: Record<string, string> = {
  surfaced: "Not looked at",
  raised: "Raised with CPA",
  doing: "In progress",
  declined: "Not for this year",
  done: "Done",
};

export function StrategyList({
  strategies,
  taxYear,
  notes,
}: {
  strategies: SurfacedStrategy[];
  taxYear: number;
  notes: Record<string, { state: string; note: string | null }>;
}) {
  if (strategies.length === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-muted">
        Nothing worth raising from this year&rsquo;s figures. That is a real
        answer rather than an empty list — these appear when the numbers make
        them worth a conversation.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {strategies.map((strategy, index) => (
        <StrategyCard
          key={strategy.slug}
          strategy={strategy}
          taxYear={taxYear}
          state={notes[strategy.slug]?.state ?? "surfaced"}
          index={index}
        />
      ))}
    </ul>
  );
}

function StrategyCard({
  strategy,
  taxYear,
  state,
  index,
}: {
  strategy: SurfacedStrategy;
  taxYear: number;
  state: string;
  index: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const set = (next: string) => {
    startTransition(async () => {
      await setStrategyState(taxYear, strategy.slug, next, strategy.amountCents);
      router.refresh();
    });
  };

  const settled = state === "declined" || state === "done";

  return (
    <li
      className={cn(
        "animate-rise rounded-tile bg-inset px-4 py-3.5 transition-opacity duration-(--duration-base)",
        pending && "pointer-events-none opacity-45",
        settled && "opacity-60",
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h4 className="text-[13.5px] font-medium text-ink">
              {strategy.title}
            </h4>
            {strategy.verdict === "maybe" && (
              <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">
                might apply
              </span>
            )}
            {state !== "surfaced" && (
              <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">
                {STATE_LABEL[state] ?? state}
              </span>
            )}
          </div>

          <p className="text-[13px] leading-relaxed text-muted">
            {strategy.question}
          </p>

          {strategy.amountLabel && (
            <p className="mt-1.5 text-[12.5px] text-faint">
              Roughly {strategy.amountLabel} is in play — an order of magnitude,
              not a promise.
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
      >
        <ChevronDown
          className={cn(
            "size-3 transition-transform duration-(--duration-base)",
            open && "rotate-180",
          )}
          strokeWidth={2}
        />
        {open ? "Less" : "Why"}
      </button>

      {open && (
        <div className="mt-2">
          <p className="text-[12.5px] leading-relaxed text-muted">
            {strategy.why}
          </p>
          <p className="mt-1.5 text-[11.5px] text-faint">{strategy.citation}</p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["raised", "doing", "done", "declined"] as const).map((next) => (
          <button
            key={next}
            type="button"
            onClick={() => set(state === next ? "surfaced" : next)}
            className={cn(
              "rounded-chip px-3 py-1.5 text-[12px] transition-[background-color,color] duration-(--duration-quick) active:scale-[0.97]",
              state === next
                ? "bg-obsidian font-medium text-white"
                : "bg-card text-muted hover:text-ink",
            )}
          >
            {state === next && (
              <Check className="mr-1 inline size-3" strokeWidth={2.4} />
            )}
            {next === "raised"
              ? "Mark as raised"
              : next === "doing"
                ? "In progress"
                : next === "done"
                  ? "Done"
                  : "Not this year"}
          </button>
        ))}
      </div>
    </li>
  );
}
