"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CirclePlus, Play } from "lucide-react";

import type { NextTaskView } from "@/components/today/types";
import { setTaskSprint } from "@/lib/sprint-actions";
import { setTaskStatus } from "@/lib/task-actions";
import { cn } from "@/lib/utils";

export type BandwidthGroupView = {
  /** The recurring task that put this project on today's screen. */
  anchorTitle: string;
  projectName: string;
  projectSlug: string;
  color: string;
  tasks: NextTaskView[];
};

/**
 * Section 5 of Today, and the smallest card on it by design.
 *
 * It only exists on the days a project is already being opened — Utaitai's
 * batching Wednesdays and Sundays — and it offers the two or three backlog rows
 * that are cheap *because the context is loaded*. Any other day this renders
 * nothing at all.
 *
 * Framed as an offer, not a list: "if you have bandwidth". A card that reads
 * like more commitment on a day that already has one is a card that gets
 * scrolled past.
 */
export function Bandwidth({
  groups,
  sprintId,
}: {
  groups: BandwidthGroupView[];
  sprintId: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.projectSlug}>
          <div className="mb-2 flex items-center gap-2 px-1">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: group.color }}
            />
            <Link
              href={`/projects/${group.projectSlug}`}
              className="text-[12.5px] font-medium text-ink hover:text-accent"
            >
              {group.projectName}
            </Link>
            <span className="truncate text-[11.5px] text-faint">
              you’re in it for “{group.anchorTitle}”
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {group.tasks.map((task) => (
              <Row key={task.id} task={task} sprintId={sprintId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({
  task,
  sprintId,
}: {
  task: NextTaskView;
  sprintId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-tile bg-inset px-3.5 py-2.5 transition-[background-color,opacity] duration-(--duration-quick) hover:bg-line/50",
        pending && "pointer-events-none opacity-45",
      )}
    >
      {task.track && (
        <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">
          {task.track}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
        {task.title}
      </span>

      {/* Start it now, or commit it to the sprint. Both visible outright on
          touch — a hover-only control doesn't exist on a phone (§9). */}
      <button
        type="button"
        onClick={() => startTransition(() => setTaskStatus(task.id, "doing"))}
        aria-label={`Start ${task.title}`}
        title="Start this now"
        className="grid size-7 shrink-0 place-items-center rounded-full text-faint transition-colors duration-(--duration-quick) hover:bg-card hover:text-ink active:scale-90 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Play className="size-3.5" strokeWidth={2} />
      </button>

      {sprintId && (
        <button
          type="button"
          onClick={() => startTransition(() => setTaskSprint(task.id, sprintId))}
          aria-label={`Add ${task.title} to the sprint`}
          title="Add to the sprint"
          className="grid size-7 shrink-0 place-items-center rounded-full text-faint transition-colors duration-(--duration-quick) hover:bg-card hover:text-accent active:scale-90 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <CirclePlus className="size-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
