"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Trash2, X } from "lucide-react";

import type { Recurrence } from "@prisma/client";

import type { AreaView, BoardProjectView, TaskView } from "@/components/board/types";
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
  defaults,
  onClose,
}: {
  task: TaskView | null;
  projects: BoardProjectView[];
  areas: AreaView[];
  defaults?: { projectId?: string | null; track?: string | null };
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(
    task?.projectId ?? defaults?.projectId ?? "",
  );
  const [recurrence, setRecurrence] = useState(task?.recurrence ?? "none");
  const [days, setDays] = useState<number[]>(task?.daysOfWeek ?? []);
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

            <RepeatField
              recurrence={recurrence}
              setRecurrence={setRecurrence}
              days={days}
              setDays={setDays}
              repeatUntil={task?.repeatUntil ?? ""}
            />

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

const WEEKDAYS = [
  { day: 1, label: "M" },
  { day: 2, label: "T" },
  { day: 3, label: "W" },
  { day: 4, label: "T" },
  { day: 5, label: "F" },
  { day: 6, label: "S" },
  { day: 7, label: "S" },
];

const REPEATS: { id: Recurrence; label: string }[] = [
  { id: "none", label: "Once" },
  { id: "daily", label: "Daily" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
];

/**
 * The repeat control. Deliberately the same vocabulary as the event panel —
 * one mental model for "how often does this happen" across the app, which is
 * the whole reason `Recurrence` is shared rather than duplicated per model.
 *
 * The consequence is stated out loud, as it is on an event: ticking a repeating
 * task does not finish it, it moves it to the next day. That is a surprising
 * thing for a checkbox to do, and finding out by surprise is worse than reading
 * one line.
 */
function RepeatField({
  recurrence,
  setRecurrence,
  days,
  setDays,
  repeatUntil,
}: {
  recurrence: Recurrence;
  setRecurrence: (value: Recurrence) => void;
  days: number[];
  setDays: (value: number[]) => void;
  repeatUntil: string;
}) {
  const toggleDay = (day: number) =>
    setDays(
      days.includes(day)
        ? days.filter((value) => value !== day)
        : [...days, day].sort(),
    );

  return (
    <div>
      <span className={labelCls}>Repeats</span>

      <input type="hidden" name="recurrence" value={recurrence} />
      {days.map((day) => (
        <input key={day} type="hidden" name="daysOfWeek" value={day} />
      ))}

      <div className="flex flex-wrap gap-1.5">
        {REPEATS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setRecurrence(option.id)}
            className={cn(
              "rounded-chip px-3 py-1.5 text-[12.5px] transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-[0.97]",
              recurrence === option.id
                ? "bg-obsidian text-white"
                : "bg-inset text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {recurrence === "weekly" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {WEEKDAYS.map((entry) => (
            <button
              key={entry.day}
              type="button"
              onClick={() => toggleDay(entry.day)}
              aria-pressed={days.includes(entry.day)}
              className={cn(
                "size-8 rounded-full text-[12px] transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-90",
                days.includes(entry.day)
                  ? "bg-accent text-white"
                  : "bg-inset text-muted hover:text-ink",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      )}

      {recurrence !== "none" && (
        <>
          <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
            Ticking this doesn’t finish it — it records the day and moves the
            task to its next one.
          </p>
          <div className="mt-2">
            <label className={labelCls} htmlFor="task-until">
              Until
            </label>
            <input
              id="task-until"
              type="date"
              name="repeatUntil"
              defaultValue={repeatUntil}
              className={field}
            />
          </div>
        </>
      )}
    </div>
  );
}
