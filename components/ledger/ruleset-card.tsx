import { AlertTriangle, Check, ExternalLink } from "lucide-react";

import type { RuleSetView } from "@/lib/tax";
import { cn } from "@/lib/utils";

/**
 * What the engine is allowed to compute with.
 *
 * **This card sits above the estimate, not below it**, and when a rule set is
 * incomplete it is the first thing on the tab. That placement is the design: the
 * alternative — a badge next to a figure, or a footnote — makes the numbers the
 * headline and their provenance an aside, which is the wrong way round for a
 * screen whose figures are only as good as constants nobody has looked up yet.
 *
 * A set with **any** unconfirmed number is unusable. Not "used with defaults",
 * not "used with a warning": a figure whose inputs include a guess is not
 * computed at all. See `lib/tax/rules.ts` for why that is worth the
 * inconvenience — the short version is that a tax number that is 4% wrong looks
 * exactly like one that is right, and nothing downstream will contradict it.
 */
export function RuleSetCard({ ruleSet }: { ruleSet: RuleSetView }) {
  const confirmed = ruleSet.totalFigures - ruleSet.missingCount;

  return (
    <div
      className={cn(
        "rounded-tile px-4 py-3.5",
        ruleSet.usable ? "bg-inset" : "bg-warn-soft",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
            {ruleSet.usable ? (
              <Check className="size-3.5 text-good" strokeWidth={2.4} />
            ) : (
              <AlertTriangle className="size-3.5 text-warn" strokeWidth={2} />
            )}
            {ruleSet.jurisdictionLabel} {ruleSet.taxYear}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-normal",
                ruleSet.status === "verified"
                  ? "bg-card text-good"
                  : "bg-card text-warn",
              )}
            >
              {ruleSet.status === "absent" ? "not started" : ruleSet.status}
            </span>
          </p>

          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            {ruleSet.usable ? (
              <>All {ruleSet.totalFigures} numbers confirmed against their source.</>
            ) : (
              <>
                {confirmed} of {ruleSet.totalFigures} numbers confirmed —{" "}
                <strong className="font-medium text-warn">
                  {ruleSet.missingCount} still to look up
                </strong>
                . Nothing is estimated from a figure nobody checked.
              </>
            )}
          </p>
        </div>

        {ruleSet.sourceUrl && (
          <a
            href={ruleSet.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-chip bg-card px-3 py-1.5 text-[12.5px] text-muted shadow-card transition-colors duration-(--duration-quick) hover:text-ink active:scale-[0.97]"
          >
            <ExternalLink className="size-3" strokeWidth={1.8} />
            The source
          </a>
        )}
      </div>

      {ruleSet.sourceLabel && (
        <p className="mt-2 text-[11.5px] text-faint">{ruleSet.sourceLabel}</p>
      )}

      {!ruleSet.usable && ruleSet.missing.length > 0 && (
        <details className="mt-2.5">
          <summary className="cursor-pointer text-[12.5px] text-muted hover:text-ink">
            What is missing
          </summary>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {ruleSet.missing.slice(0, 40).map((path) => (
              <li key={path} className="font-mono text-[11px] text-faint">
                {path}
              </li>
            ))}
            {ruleSet.missing.length > 40 && (
              <li className="text-[11px] text-faint">
                and {ruleSet.missing.length - 40} more
              </li>
            )}
          </ul>
        </details>
      )}
    </div>
  );
}
