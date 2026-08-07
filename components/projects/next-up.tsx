"use client";

import { useState } from "react";

import { TaskPanel } from "@/components/board/task-panel";
import type {
  AreaView,
  BoardProjectView,
  TaskView,
} from "@/components/board/types";
import { cn } from "@/lib/utils";

/**
 * The "Next up" list on a project's Overview tab, made openable.
 *
 * It was five static rows: a project page's Overview said *what is next* and
 * gave you nowhere to act on it, so fixing a due date on the row you had just
 * read meant a trip to the Tasks tab to find the same row again. Now the row is
 * the way in, which is the rule the Hunt Board, the Tasks tab and — since this
 * change — Today all already follow.
 *
 * Deliberately still read-only in every other respect: no tick, no play. The
 * Overview is a summary, and putting the full row controls here would make it a
 * second, worse copy of the Tasks tab (the same argument CLAUDE.md §6 makes
 * about the calendar not being an editor for tasks).
 */
export function NextUp({
  tasks,
  projects,
  areas,
}: {
  tasks: TaskView[];
  projects: BoardProjectView[];
  areas: AreaView[];
}) {
  const [open, setOpen] = useState<TaskView | null>(null);

  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {tasks.map((task, index) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => setOpen(task)}
              style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              className="flex w-full animate-rise items-center gap-3 rounded-tile bg-inset px-3.5 py-2.5 text-left transition-[background-color,transform] duration-(--duration-base) ease-soft hover:translate-x-0.5 hover:bg-line/50 active:scale-[0.99]"
            >
              {task.track && (
                <span className="shrink-0 rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">
                  {task.track}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                {task.title}
              </span>
              {task.dueLabel && (
                <span
                  className={cn(
                    "shrink-0 text-[11.5px]",
                    task.overdue ? "text-accent" : "text-faint",
                  )}
                >
                  {task.dueLabel}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <TaskPanel
          key={open.id}
          task={open}
          projects={projects}
          areas={areas}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
