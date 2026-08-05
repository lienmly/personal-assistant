"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ExternalLink, Plus, Repeat } from "lucide-react";

import { TaskPanel } from "@/components/board/task-panel";
import type { AreaView, BoardProjectView, TaskView } from "@/components/board/types";
import { setTaskStatus } from "@/lib/task-actions";
import { repeatLabel } from "@/lib/task-view";
import { trackRank } from "@/lib/tracks";
import { cn } from "@/lib/utils";

/**
 * The project's own task list, grouped by track.
 *
 * Not the Hunt Board with a filter applied: the board's job is *choosing*
 * across projects, so it carries scope pills and a capture box, neither of
 * which means anything once you have already decided which project you are in. What is left is the list and the tracks — which is the whole of what
 * "open Sleepy Cat and see where it stands" needs.
 */
export function ProjectTasks({
  tasks,
  project,
  projects,
  areas,
}: {
  tasks: TaskView[];
  project: BoardProjectView;
  projects: BoardProjectView[];
  areas: AreaView[];
}) {
  const [showDone, setShowDone] = useState(false);
  const [panel, setPanel] = useState<
    { mode: "edit"; task: TaskView } | { mode: "new"; track: string | null } | null
  >(null);

  const groups = useMemo(() => {
    const visible = tasks.filter(
      (task) => showDone || task.status !== "done",
    );
    const byTrack = new Map<string, TaskView[]>();
    for (const task of visible) {
      const key = task.track ?? "";
      const bucket = byTrack.get(key);
      if (bucket) bucket.push(task);
      else byTrack.set(key, [task]);
    }
    return [...byTrack.entries()]
      .map(([track, rows]) => ({ track, rows }))
      .sort(
        (a, b) =>
          trackRank(a.track || null) - trackRank(b.track || null) ||
          a.track.localeCompare(b.track),
      );
  }, [tasks, showDone]);

  const doneCount = tasks.filter((task) => task.status === "done").length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPanel({ mode: "new", track: null })}
          className="flex items-center gap-1.5 rounded-chip bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
        >
          <Plus className="size-4" strokeWidth={2.4} />
          New task
        </button>
        {doneCount > 0 && (
          <button
            type="button"
            onClick={() => setShowDone((value) => !value)}
            className="ml-auto rounded-chip bg-inset px-3 py-2 text-[12.5px] text-muted transition-colors duration-(--duration-quick) hover:text-ink active:scale-[0.97]"
          >
            {showDone ? "Hide done" : `Show ${doneCount} done`}
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="rounded-tile bg-inset px-4 py-8 text-center text-[13px] text-muted">
          Nothing open on this project. Add the next thing before you forget it.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group, index) => (
            <div
              key={group.track || "untracked"}
              className="animate-rise"
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
                  {group.track || "Untracked"}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPanel({ mode: "new", track: group.track || null })
                  }
                  aria-label={`Add to ${group.track || "Untracked"}`}
                  className="grid size-6 place-items-center rounded-full text-faint transition-colors duration-(--duration-quick) hover:bg-inset hover:text-ink sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Plus className="size-3.5" strokeWidth={2.4} />
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                {group.rows.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onOpen={() => setPanel({ mode: "edit", task })}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {panel && (
        <TaskPanel
          task={panel.mode === "edit" ? panel.task : null}
          projects={projects}
          areas={areas}
          defaults={
            panel.mode === "new"
              ? { projectId: project.id, track: panel.track }
              : undefined
          }
          onClose={() => setPanel(null)}
        />
      )}
    </>
  );
}

function TaskRow({ task, onOpen }: { task: TaskView; onOpen: () => void }) {
  const [pending, startTransition] = useTransition();
  const done = task.status === "done";
  const repeat = repeatLabel(task);

  return (
    // The fold-out on completion: `grid-template-rows` 1fr → 0fr, with the
    // collapsed state *derived* from `isPending` so a failed action unfolds the
    // row again instead of leaving a gap. See CLAUDE.md §10.
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-(--duration-slow) ease-soft",
        pending && !done ? "grid-rows-[0fr] delay-[140ms]" : "grid-rows-[1fr]",
      )}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            "flex items-center gap-3 rounded-tile bg-inset px-3.5 py-2.5 transition-[background-color] duration-(--duration-quick) hover:bg-line/50",
            done && "opacity-55",
          )}
        >
          <button
            type="button"
            aria-label={done ? "Reopen this task" : "Mark as done"}
            onClick={() =>
              startTransition(() =>
                setTaskStatus(task.id, done ? "open" : "done"),
              )
            }
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-90",
              done
                ? "animate-pop bg-accent text-white"
                : "bg-card text-transparent shadow-card hover:text-faint",
            )}
          >
            <Check className="size-3" strokeWidth={3} />
          </button>

          <button
            type="button"
            onClick={onOpen}
            className="min-w-0 flex-1 text-left"
          >
            <span
              className={cn(
                "block truncate text-[13px] text-ink",
                done && "line-through",
              )}
            >
              {task.title}
            </span>
          </button>

          {repeat && (
            <span
              className="flex shrink-0 items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[11px] text-muted"
              title={
                task.doneCount > 0
                  ? `Done ${task.doneCount} times`
                  : "Repeats — ticking it moves it to the next day"
              }
            >
              <Repeat className="size-3" strokeWidth={2.2} />
              {repeat}
              {task.doneCount > 0 && (
                <span className="text-faint">·{task.doneCount}</span>
              )}
            </span>
          )}

          {task.dueLabel && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                task.overdue
                  ? "bg-accent-soft text-accent"
                  : "bg-card text-muted",
              )}
            >
              {task.dueLabel}
            </span>
          )}

          {task.link && (
            <a
              href={task.link}
              target="_blank"
              rel="noreferrer"
              aria-label="Open link"
              className="grid size-6 shrink-0 place-items-center rounded-full text-faint transition-colors duration-(--duration-quick) hover:text-ink"
            >
              <ExternalLink className="size-3.5" strokeWidth={1.9} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
