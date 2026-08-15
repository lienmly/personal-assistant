"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

import type { PendingFigure } from "@/lib/tax";
import { confirmRuleFigure } from "@/lib/tax-actions";
import { cn } from "@/lib/utils";

/**
 * Confirming a drafted tax constant against the sentence it came from.
 *
 * **This screen is the verification** — there is no separate checking step
 * elsewhere. Each row puts the extracted number beside the verbatim line it was
 * read from, so confirming is *reading* rather than looking anything up. That is
 * what makes the annual chore small enough to actually happen, and it is the
 * whole reason `rules-update.ts` insists on a source line for every figure and
 * discards any value that arrives without one.
 *
 * **The number is editable.** An extraction that misread a digit should be
 * correctable here rather than re-run, because the reviewer is already looking
 * at the source line and can see what it should have been.
 *
 * Confirming the last outstanding figure flips the set to `verified`
 * automatically — there is no button that declares a rule set finished while it
 * still contains a null, because the engine's refusal to compute is keyed on
 * exactly that.
 */
export function RuleSetDiff({ figures }: { figures: PendingFigure[] }) {
  if (figures.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[13px] leading-relaxed text-muted">
        {figures.length}{" "}
        {figures.length === 1 ? "number was" : "numbers were"} found in the
        published source. Each one is shown beside the line it came from —
        confirming is reading, not looking up. Nothing is used until it is
        confirmed.
      </p>

      <ul className="flex flex-col gap-1.5">
        {figures.map((figure) => (
          <FigureRow
            key={`${figure.ruleSetId}:${figure.path}`}
            figure={figure}
          />
        ))}
      </ul>
    </div>
  );
}

/** Cents back to a readable number for the input, without pretending a rate is
 *  money. A rate is a decimal under 1; everything else is cents. */
function forInput(value: number): string {
  return value > 0 && value < 1 ? String(value) : String(value);
}

function FigureRow({ figure }: { figure: PendingFigure }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(forInput(figure.value));
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const confirm = () => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      setError("That is not a number.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await confirmRuleFigure(
        figure.ruleSetId,
        figure.path,
        parsed,
        figure.source,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <li
      className={cn(
        "rounded-tile bg-inset px-3.5 py-2.5",
        pending && "pointer-events-none opacity-45",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 font-mono text-[11.5px] text-muted">
          <span className="text-faint">{figure.jurisdiction}</span> ·{" "}
          {figure.path}
        </span>

        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          inputMode="decimal"
          aria-label={`Value for ${figure.path}`}
          className="w-32 rounded-chip bg-card px-2.5 py-1.5 text-right font-mono text-[12.5px] text-ink outline-none focus:ring-2 focus:ring-accent/25"
        />

        <button
          type="button"
          onClick={confirm}
          className="inline-flex items-center gap-1 rounded-chip bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
        >
          <Check className="size-3" strokeWidth={2.4} />
          Confirm
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Skip this one"
          title="Leave it unconfirmed for now"
          className="rounded-chip p-1.5 text-faint transition-colors duration-(--duration-quick) hover:text-ink"
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* The verbatim line. This is the thing being checked against, and it is
          why the whole extraction insists on one. */}
      <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-faint">
        {figure.where && (
          <span className="text-muted">{figure.where} — </span>
        )}
        {figure.source}
      </p>

      {error && <p className="mt-1.5 text-[12px] text-bad">{error}</p>}
    </li>
  );
}
