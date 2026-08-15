import { cn } from "@/lib/utils";

/**
 * Every figure the tax engine produces goes through here.
 *
 * **The caveat attaches to the number, not to the page.** A banner at the top
 * saying "these are estimates" is read once and then scrolled past for the rest
 * of the year; a hairline `est.` beside every one of forty figures cannot be.
 * That is the whole design, and it is §6's "an estimate is structural, not a
 * disclaimer" made into a component so it cannot be forgotten at one call site.
 *
 * Two further rules it enforces:
 *
 * **A draft rule set badges every figure derived from it.** `loadRules` prefers
 * `verified` and returns a flag when it falls back — that flag ends up here, so
 * a number computed from constants nobody has confirmed says so where it is
 * read, rather than in a note somewhere above.
 *
 * **Nothing is ever labelled as a form line.** The `label` is always a sentence
 * — "What the rentals lost this year, after depreciation", never "Line 24". A
 * number that looks like a return invites being copied onto one, and this is a
 * planning figure assembled from statements and bank rows.
 */
export function EstimateFigure({
  label,
  value,
  note,
  from,
  draft = false,
  tone = "plain",
  size = "normal",
}: {
  label: string;
  /** Null renders as "not computed" — never as a zero. */
  value: string | null;
  note?: string;
  /** What it was derived from, on hover. A figure that cannot say where it came
   *  from is one you have to take on trust. */
  from?: string;
  draft?: boolean;
  tone?: "plain" | "good" | "bad";
  size?: "normal" | "hero";
}) {
  return (
    <div>
      <p className="text-[12.5px] text-muted">{label}</p>

      {value === null ? (
        <p
          className={cn(
            "mt-1 font-medium leading-none tracking-tight text-faint",
            size === "hero" ? "text-[20px]" : "text-[15px]",
          )}
          title={note}
        >
          not computed
        </p>
      ) : (
        <p
          className={cn(
            "mt-1 flex items-baseline gap-1.5 font-semibold leading-none tracking-tight tabular-nums",
            size === "hero" ? "text-[28px]" : "text-[17px]",
            tone === "good" && "text-good",
            tone === "bad" && "text-bad",
            tone === "plain" && "text-ink",
          )}
          title={from}
        >
          {value}
          <span
            className="text-[10px] font-normal tracking-normal text-faint"
            title="An estimate for planning, not a return"
          >
            est.
          </span>
          {draft && (
            <span
              className="rounded-full bg-warn-soft px-1.5 py-0.5 text-[10px] font-normal text-warn"
              title="Computed from constants that have not been confirmed against their published source"
            >
              draft rules
            </span>
          )}
        </p>
      )}

      {note && <p className="mt-1.5 text-[11.5px] leading-tight text-faint">{note}</p>}
    </div>
  );
}
