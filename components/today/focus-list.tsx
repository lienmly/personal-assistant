"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check, CirclePlus, ExternalLink, Play } from "lucide-react";

import type { FocusMarkView, FocusReason } from "@/components/today/types";
import { setMarkStatus } from "@/lib/mark-actions";
import { setMarkSprint } from "@/lib/sprint-actions";
import { cn } from "@/lib/utils";

/**
 * Section 1 of Today, rebuilt around the sprint.
 *
 * It used to be "every mark with a due date", which on a board where only one
 * project had due dates meant the screen was either empty or a list of one
 * project's admin. Now it is the sprint — the things actually committed to this
 * week — with due and overdue marks merged in wherever they came from, in that
 * order. The order is the answer to "what do I do right now": the top row is it.
 */
export function FocusList({
  marks,
  total,
  sprintId,
}: {
  marks: FocusMarkView[];
  total: number;
  /** Null when no sprint is running; the "pull into sprint" button hides. */
  sprintId: string | null;
}) {
  return (
    <>
      <div className="flex flex-col">
        {marks.map((mark, index) => (
          <Row
            key={mark.id}
            mark={mark}
            sprintId={sprintId}
            delay={60 + Math.min(index, 8) * 32}
          />
        ))}
      </div>

      {total > marks.length && (
        <Link
          href="/board"
          className="mt-3 inline-block text-[12px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
        >
          {total - marks.length} more in this sprint →
        </Link>
      )}
    </>
  );
}

const BADGE: Record<FocusReason, { label: string; className: string } | null> = {
  doing: { label: "in flight", className: "bg-warn-soft text-warn" },
  overdue: { label: "overdue", className: "bg-accent-soft text-accent" },
  today: { label: "due today", className: "bg-inset text-muted" },
  sprint: null,
};

function Row({
  mark,
  sprintId,
  delay,
}: {
  mark: FocusMarkView;
  sprintId: string | null;
  delay: number;
}) {
  // Two transitions, not one. Ticking done removes the row so it folds away;
  // the other three buttons leave it in place, so they only recede. Sharing a
  // single `isPending` would collapse the row every time you pressed "start",
  // and then spring it open again.
  const [leaving, startDone] = useTransition();
  const [pending, startEdit] = useTransition();
  const busy = leaving || pending;
  const badge = BADGE[mark.reason];
  const doing = mark.status === "doing";

  // What actually removes a ticked row is the revalidated data arriving, so it
  // folds while the action is in flight rather than blinking out. Derived from
  // `isPending`, so a failed action unfolds it again (CLAUDE.md §10).
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-(--duration-base) ease-exit",
        leaving
          ? "grid-rows-[0fr] opacity-0 delay-[140ms]"
          : "grid-rows-[1fr] opacity-100",
      )}
    >
      <div className="overflow-hidden">
        <div
          style={{ animationDelay: `${delay}ms` }}
          className={cn(
            "group flex animate-rise items-center gap-3 rounded-tile px-2 py-2 transition-[background-color,opacity,transform] duration-(--duration-base) ease-soft hover:translate-x-0.5 hover:bg-inset",
            pending && "pointer-events-none opacity-45",
          )}
        >
          <button
            type="button"
            disabled={busy}
            aria-label="Mark as done"
            onClick={() => startDone(() => setMarkStatus(mark.id, "done"))}
            className="grid size-5 shrink-0 place-items-center rounded-full bg-inset text-transparent transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:bg-good hover:text-white active:scale-90"
          >
            <Check className="size-3" strokeWidth={3} />
          </button>

          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: mark.areaColor }}
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] leading-snug text-ink">
              {mark.title}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
              {badge && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[10px] font-medium",
                    badge.className,
                  )}
                >
                  {badge.label}
                </span>
              )}
              {mark.projectName && (
                <span className="truncate">{mark.projectName}</span>
              )}
              {mark.track && (
                <>
                  <span>·</span>
                  <span>{mark.track}</span>
                </>
              )}
              {mark.dueLabel && mark.reason === "sprint" && (
                <>
                  <span>·</span>
                  <span>{mark.dueLabel}</span>
                </>
              )}
            </p>
          </div>

          {/* Not in the sprint but due anyway — one tap to make it official,
              rather than a trip to the Hunt Board to fix the planning. */}
          {!mark.inSprint && sprintId && (
            <button
              type="button"
              disabled={busy}
              aria-label="Add to the sprint"
              title="Add to the sprint"
              onClick={() =>
                startEdit(() => setMarkSprint(mark.id, sprintId))
              }
              className="shrink-0 text-faint transition-[color,transform] duration-(--duration-base) ease-soft hover:scale-110 hover:text-ink active:scale-100"
            >
              <CirclePlus className="size-3.5" strokeWidth={1.8} />
            </button>
          )}

          {/* "Doing" is the one thing on the screen that says *this is what I
              am on right now*, so it is a toggle and not a dropdown. */}
          <button
            type="button"
            disabled={busy}
            aria-label={doing ? "Stop working on this" : "Start working on this"}
            title={doing ? "Stop working on this" : "Start working on this"}
            onClick={() =>
              startEdit(() =>
                setMarkStatus(mark.id, doing ? "open" : "doing"),
              )
            }
            className={cn(
              "shrink-0 transition-[color,transform] duration-(--duration-base) ease-soft hover:scale-110 active:scale-100",
              doing ? "text-warn" : "text-faint hover:text-ink",
            )}
          >
            <Play
              className="size-3.5"
              strokeWidth={1.8}
              fill={doing ? "currentColor" : "none"}
            />
          </button>

          {mark.link && (
            <a
              href={mark.link}
              target="_blank"
              rel="noreferrer"
              aria-label="Open the linked post"
              className="shrink-0 text-faint transition-colors duration-(--duration-quick) hover:text-ink"
            >
              <ExternalLink className="size-3.5" strokeWidth={1.8} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
