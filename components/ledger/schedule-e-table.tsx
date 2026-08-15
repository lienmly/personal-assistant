import { Info } from "lucide-react";

import type { ScheduleE } from "@/lib/tax/schedule-e";
import { cn } from "@/lib/utils";

/**
 * One property's Schedule E, for one year.
 *
 * **No figure here is ever labelled as a form line.** Never "Line 24"; always a
 * sentence — "What the rentals lost this year, after depreciation". A number
 * that looks like a return invites being copied onto one, and this is a working
 * estimate assembled from statements and bank rows, not a filing.
 *
 * Every line says where it came from. A figure summed out of accepted
 * statements, one taken from claimed bank rows and one reported by the mortgage
 * servicer are three different kinds of certainty, and collapsing them into an
 * undifferentiated column is how a number stops being traceable.
 */

const SOURCE_LABEL: Record<ScheduleE["lines"][number]["source"], string> = {
  statements: "from statements",
  transactions: "from claimed bank rows",
  servicer: "from the servicer",
  computed: "computed",
};

export function ScheduleETable({ schedule }: { schedule: ScheduleE }) {
  return (
    <div className="animate-rise">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">
          {schedule.propertyLabel}
        </h3>
        <span className="text-[12.5px] text-faint">
          {schedule.statementCount}{" "}
          {schedule.statementCount === 1 ? "statement" : "statements"} ·{" "}
          {schedule.transactionCount} claimed rows
        </span>
      </div>

      <dl className="flex flex-col">
        <Row
          label="Rent and other income"
          value={schedule.incomeLabel}
          tone="in"
        />

        {schedule.lines.map((line) => (
          <Row
            key={line.key}
            label={line.label}
            value={line.centsLabel}
            note={SOURCE_LABEL[line.source]}
          />
        ))}

        {schedule.depreciationLabel ? (
          <Row
            label="Depreciation"
            value={schedule.depreciationLabel}
            note="27.5-year straight line, mid-month"
          />
        ) : (
          <div className="flex items-start gap-2 rounded-tile bg-warn-soft px-3.5 py-2.5 text-[12.5px] text-warn">
            <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />
            <span>
              <strong className="font-medium">Depreciation not computed.</strong>{" "}
              {schedule.depreciationBlocker}
            </span>
          </div>
        )}
      </dl>

      <div className="mt-3 border-0 border-t border-line pt-3">
        {schedule.netLabel ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-muted">
              {schedule.netCents !== null && schedule.netCents < 0
                ? "What it lost this year, after depreciation"
                : "What it made this year, after depreciation"}
            </span>
            <span
              className={cn(
                "text-[18px] font-semibold tabular-nums",
                schedule.netCents !== null && schedule.netCents < 0
                  ? "text-bad"
                  : "text-ink",
              )}
            >
              {schedule.netLabel}
            </span>
          </div>
        ) : (
          <p className="text-[13px] text-muted">
            The net figure needs depreciation, so it is not shown rather than
            shown wrong.
          </p>
        )}
      </div>

      {schedule.notes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {schedule.notes.map((note) => (
            <li key={note} className="text-xs leading-relaxed text-faint">
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  note,
  tone = "out",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "in" | "out";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="min-w-0 text-[13px] text-ink">
        {label}
        {note && <span className="ml-2 text-[11.5px] text-faint">{note}</span>}
      </dt>
      <dd
        className={cn(
          "shrink-0 text-[13.5px] tabular-nums",
          tone === "in" ? "text-good" : "text-ink",
        )}
      >
        {tone === "out" && "−"}
        {value}
      </dd>
    </div>
  );
}
