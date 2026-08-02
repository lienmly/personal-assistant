"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Lightbulb, Plus } from "lucide-react";

import type { NextGroupView, NextTaskView } from "@/components/today/types";
import { setTaskSprint } from "@/lib/sprint-actions";
import { cn } from "@/lib/utils";

/**
 * "I've finished the sprint — now what."
 *
 * The other half of the answer to the overwhelm problem. The sprint keeps the
 * top of the screen short; this keeps the bottom of it *useful*, so running out
 * of committed work leads somewhere specific instead of back to a wall of sixty
 * rows. Two shapes, because they are two different moods: the next few tasks on
 * the projects that matter, and the ideas you meant to try and never did.
 *
 * Collapsed by default. It is deliberately not competing with the focus list —
 * you should have to decide to look at it.
 */
export function UpNext({
  groups,
  ideas,
  backlogTotal,
  sprintId,
}: {
  groups: NextGroupView[];
  ideas: NextTaskView[];
  backlogTotal: number;
  sprintId: string | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 text-left"
      >
        {/* One expression, not an expression sitting next to a text node with
            an entity in it: that splits into different text nodes on the server
            and the client, and React calls it a hydration mismatch. */}
        <span className="text-[13px] text-muted">
          {`${open ? "Hide" : "Show"} what’s next on the main projects`}
        </span>
        <span className="ml-auto rounded-full bg-inset px-2.5 py-1 text-xs font-medium text-muted">
          {backlogTotal} in backlog
        </span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          {groups.map((group, index) => (
            <div
              key={group.projectName}
              style={{ animationDelay: `${index * 40}ms` }}
              className="animate-rise"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: group.color }}
                />
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  {group.projectName}
                </h3>
              </div>
              <div className="flex flex-col">
                {group.tasks.map((task) => (
                  <Row key={task.id} task={task} sprintId={sprintId} />
                ))}
              </div>
            </div>
          ))}

          {ideas.length > 0 && (
            <div
              style={{ animationDelay: `${groups.length * 40}ms` }}
              className="animate-rise"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <Lightbulb className="size-3 text-faint" strokeWidth={2} />
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                  Wanted to try
                </h3>
              </div>
              <div className="flex flex-col">
                {ideas.map((task) => (
                  <Row key={task.id} task={task} sprintId={sprintId} />
                ))}
              </div>
            </div>
          )}

          {groups.length === 0 && ideas.length === 0 && (
            <p className="text-[13px] leading-relaxed text-faint">
              Nothing queued on the main projects. That&apos;s either a very good
              week or a sign the Hunt Board needs a top-up.
            </p>
          )}

          <Link
            href="/board"
            className="text-[12px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
          >
            Open the Hunt Board →
          </Link>
        </div>
      )}
    </>
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
        "group flex items-center gap-2.5 rounded-tile px-2 py-1.5 transition-[background-color,opacity] duration-(--duration-base) ease-soft hover:bg-inset",
        pending && "pointer-events-none opacity-45",
      )}
    >
      <p className="min-w-0 flex-1 truncate text-[13px] leading-snug text-muted">
        {task.title}
      </p>

      {task.link && (
        <a
          href={task.link}
          target="_blank"
          rel="noreferrer"
          aria-label="Open the linked post"
          className="shrink-0 text-faint transition-colors duration-(--duration-quick) hover:text-ink"
        >
          <ExternalLink className="size-3.5" strokeWidth={1.8} />
        </a>
      )}

      {/* Visible outright on touch, revealed on hover on a pointer device: a
          hover-only affordance is an affordance that doesn't exist on the
          phone, which is where this dashboard mostly gets read. */}
      {sprintId && (
        <button
          type="button"
          disabled={pending}
          aria-label="Pull into the sprint"
          title="Pull into the sprint"
          onClick={() => startTransition(() => setTaskSprint(task.id, sprintId))}
          className="shrink-0 rounded-chip bg-inset px-2 py-1 text-[11px] text-muted transition-[opacity,color] duration-(--duration-quick) hover:text-ink focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Plus className="size-3" strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}
