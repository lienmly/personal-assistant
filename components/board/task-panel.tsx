"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ExternalLink, Trash2, X } from "lucide-react";

import type { AreaView, BoardProjectView, TaskView } from "@/components/board/types";
import type { SprintView } from "@/components/sprint/types";
import { deleteTask, saveTask } from "@/lib/task-actions";
import { TRACKS } from "@/lib/tracks";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";
const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-faint";

export function TaskPanel({
  task,
  projects,
  areas,
  sprint,
  defaults,
  onClose,
}: {
  task: TaskView | null;
  projects: BoardProjectView[];
  areas: AreaView[];
  /** The running sprint, or null — the commit toggle hides without one. */
  sprint: SprintView | null;
  defaults?: { projectId?: string | null; track?: string | null };
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(
    task?.projectId ?? defaults?.projectId ?? "",
  );
  // A new task starts *out* of the sprint. Everything you write down landing
  // straight in this week's commitment is how the sprint stops being one.
  const [committed, setCommitted] = useState(
    sprint !== null && task?.sprintId === sprint.id,
  );
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const dismiss = () => setClosing(true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setClosing(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await saveTask(form);
        dismiss();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className={cn(
          "absolute inset-0 bg-obsidian/25",
          closing ? "animate-scrim-out" : "animate-scrim-in",
        )}
      />

      <div
        onAnimationEnd={(event) => {
          if (closing && event.target === event.currentTarget) onClose();
        }}
        className={cn(
          "relative flex h-full w-full max-w-[440px] flex-col bg-stage shadow-float",
          closing ? "animate-panel-out" : "animate-panel-in",
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            {task ? "Edit task" : "New task"}
          </h2>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full text-muted transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:rotate-90 hover:bg-card hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          <form id="task-form" onSubmit={submit} className="space-y-4">
            {task && <input type="hidden" name="id" value={task.id} />}

            <div>
              <label className={labelCls} htmlFor="task-title">
                What needs doing
              </label>
              <input
                id="task-title"
                name="title"
                defaultValue={task?.title ?? ""}
                placeholder="Ship the iOS build to TestFlight"
                autoFocus
                className={field}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="task-project">
                  Project
                </label>
                <select
                  id="task-project"
                  name="projectId"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className={field}
                >
                  <option value="">None — a one-off</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls} htmlFor="task-track">
                  Track
                </label>
                <input
                  id="task-track"
                  name="track"
                  list="task-tracks"
                  defaultValue={task?.track ?? defaults?.track ?? ""}
                  placeholder="Ship"
                  className={field}
                />
                <datalist id="task-tracks">
                  {TRACKS.map((track) => (
                    <option key={track} value={track} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Only asked for when there's no project to inherit from — a task
                with a project takes that project's area, so showing both would
                offer a choice the server is going to overrule. */}
            {!projectId && (
              <div>
                <label className={labelCls} htmlFor="task-area">
                  Area
                </label>
                <select
                  id="task-area"
                  name="areaId"
                  defaultValue={task?.areaId ?? areas[0]?.id ?? ""}
                  className={field}
                >
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="task-due">
                  Due
                </label>
                <input
                  id="task-due"
                  type="date"
                  name="dueDate"
                  defaultValue={task?.dueDate ?? ""}
                  className={field}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="task-status">
                  Status
                </label>
                <select
                  id="task-status"
                  name="status"
                  defaultValue={task?.status ?? "open"}
                  className={field}
                >
                  <option value="open">Open</option>
                  <option value="doing">Doing</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            {sprint && (
              <div>
                <input
                  type="hidden"
                  name="sprintId"
                  value={committed ? sprint.id : ""}
                />
                <button
                  type="button"
                  onClick={() => setCommitted((value) => !value)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-tile px-3 py-2.5 text-left transition-[background-color,transform] duration-(--duration-base) ease-soft active:scale-[0.985]",
                    committed ? "bg-obsidian text-white" : "bg-inset text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full transition-colors duration-(--duration-base)",
                      committed ? "bg-white text-ink" : "bg-card text-transparent",
                    )}
                  >
                    <Check
                      key={committed ? "in" : "out"}
                      className={cn("size-3", committed && "animate-pop")}
                      strokeWidth={3}
                    />
                  </span>
                  <span className="min-w-0 flex-1 text-[13px]">
                    {committed ? "In" : "Not in"} {sprint.name}
                  </span>
                </button>
              </div>
            )}

            <div>
              <label className={labelCls} htmlFor="task-link">
                Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="task-link"
                  name="link"
                  type="url"
                  inputMode="url"
                  defaultValue={task?.link ?? ""}
                  placeholder="https://tiktok.com/@…/video/…"
                  className={field}
                />
                {task?.link && (
                  <a
                    href={task.link}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open link"
                    className="shrink-0 text-faint transition-[color,transform] duration-(--duration-base) ease-soft hover:-translate-y-px hover:text-ink"
                  >
                    <ExternalLink className="size-4" strokeWidth={1.8} />
                  </a>
                )}
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
                The post worth copying, the console page, the thread with the
                user who asked.
              </p>
            </div>

            <div>
              <label className={labelCls} htmlFor="task-notes">
                Notes
              </label>
              <textarea
                id="task-notes"
                name="notes"
                rows={4}
                defaultValue={task?.notes ?? ""}
                placeholder="What makes it work, what to try, what's blocking it."
                className={cn(field, "resize-y")}
              />
            </div>

            {error && (
              <p className="animate-rise rounded-chip bg-accent-soft px-3 py-2 text-[13px] text-accent">
                {error}
              </p>
            )}
          </form>

          {task && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteTask(task.id);
                  dismiss();
                })
              }
              className="group mt-6 flex items-center gap-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-accent"
            >
              <Trash2
                className="size-3.5 transition-transform duration-(--duration-base) ease-soft group-hover:-rotate-12"
                strokeWidth={1.8}
              />
              Delete this task
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 bg-shell px-5 py-3">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-chip px-3.5 py-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="task-form"
            disabled={pending}
            className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform,opacity] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save task"}
          </button>
        </div>
      </div>
    </div>
  );
}
