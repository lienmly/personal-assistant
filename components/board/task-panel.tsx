"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Plus, Trash2, X } from "lucide-react";

import type { Recurrence } from "@prisma/client";

import type {
  AreaView,
  BoardProjectView,
  SubtaskView,
  TaskCommentView,
  TaskView,
} from "@/components/board/types";
import {
  addComment,
  addSubtask,
  deleteComment,
  deleteTask,
  getTaskComments,
  renameSubtask,
  saveTask,
} from "@/lib/task-actions";
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
  /** What a *new* task starts as. `areaId` matters for a task created from an
   *  area page: without it the select falls back to `areas[0]`, so a task added
   *  from Baby would quietly file itself under Work. Ignored once a project is
   *  chosen — the project's area wins, which `saveTask` enforces anyway. */
  defaults?: {
    projectId?: string | null;
    areaId?: string | null;
    track?: string | null;
  };
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
          "absolute inset-0 bg-scrim",
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
                  defaultValue={
                    task?.areaId ?? defaults?.areaId ?? areas[0]?.id ?? ""
                  }
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

          {/* Outside the form on purpose: it has its own field and its own
              buttons, and inside a `<form>` every one of them would submit the
              task. It also only exists once the task does — there is nothing to
              hang a step off until the row has an id. */}
          {task && <ChecklistEditor taskId={task.id} initial={task.subtasks} />}

          {/* Outside the form for the same reason the checklist is, and after
              it for a second one: the steps are part of what the task *is*, and
              a comment is what has happened to it since. */}
          {task && <CommentThread taskId={task.id} />}
        </div>

        <div className="flex items-center justify-end gap-2 bg-shell px-5 py-3">
          {/* `mr-auto` rather than `justify-between` on the row: on a *new* task
              there is nothing to delete, and a two-child `justify-between`
              would push Cancel to the far left the moment this one is absent. */}
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
              className="group mr-auto flex items-center gap-2 rounded-chip px-2 py-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-accent"
            >
              <Trash2
                className="size-3.5 transition-transform duration-(--duration-base) ease-soft group-hover:-rotate-12"
                strokeWidth={1.8}
              />
              Delete this task
            </button>
          )}
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

/**
 * The checklist, editable: add a step, rename one, drop one.
 *
 * It holds its own copy of the list rather than reading the `task` prop on
 * every render, and that is not an optimisation — the panel is opened with a
 * *snapshot* of the row the board was holding, so a revalidation after adding
 * a step never reaches it. Without local state you would add "Instagram", watch
 * nothing happen, and add it again.
 *
 * There is no drag handle. Steps arrive in the order they are written, which
 * for "the accounts I post to" is the order they were opened in, and a reorder
 * affordance is a lot of machinery for a list of three.
 */
function ChecklistEditor({
  taskId,
  initial,
}: {
  taskId: string;
  initial: SubtaskView[];
}) {
  const [steps, setSteps] = useState(initial);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add() {
    const title = draft.trim();
    if (!title) return;
    setError(null);
    startTransition(async () => {
      try {
        // The real id, not a placeholder — the × and the rename-on-blur beside
        // each row both address it, so a made-up one throws the moment you
        // touch a step you have just added.
        const id = await addSubtask(taskId, title);
        setSteps((current) => [...current, { id, title, status: "open" }]);
        setDraft("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not add it");
      }
    });
  }

  return (
    <div className="mt-6">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className={cn(labelCls, "mb-0")}>Steps</span>
        <span className="text-[11.5px] text-faint">
          Where this gets done — tick them off and the task ticks itself
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-line" />
            <input
              defaultValue={step.title}
              aria-label={`Rename "${step.title}"`}
              onBlur={(event) => {
                const title = event.target.value.trim();
                if (!title || title === step.title) {
                  event.target.value = step.title;
                  return;
                }
                startTransition(() => renameSubtask(step.id, title));
                setSteps((current) =>
                  current.map((row) =>
                    row.id === step.id ? { ...row, title } : row,
                  ),
                );
              }}
              className={cn(field, "flex-1")}
            />
            <button
              type="button"
              disabled={pending}
              aria-label={`Remove "${step.title}"`}
              onClick={() => {
                startTransition(() => deleteTask(step.id));
                setSteps((current) =>
                  current.filter((row) => row.id !== step.id),
                );
              }}
              className="grid size-7 shrink-0 place-items-center rounded-full text-faint transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:bg-inset hover:text-accent active:scale-90"
            >
              <X className="size-3.5" strokeWidth={2.2} />
            </button>
          </div>
        ))}
      </div>

      <div className={cn("flex items-center gap-2", steps.length > 0 && "mt-2")}>
        <span className="size-1.5 shrink-0 rounded-full bg-line/60" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          // A step is one short phrase, and Enter is what your hands do after
          // typing one. Without this it submits the *task* form instead.
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
          placeholder="Add a step — TikTok @utaitai_cn"
          className={cn(field, "flex-1")}
        />
        <button
          type="button"
          disabled={pending || draft.trim() === ""}
          onClick={add}
          aria-label="Add this step"
          className="grid size-7 shrink-0 place-items-center rounded-full bg-inset text-muted transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:bg-line hover:text-ink active:scale-90 disabled:opacity-35"
        >
          <Plus className="size-3.5" strokeWidth={2.4} />
        </button>
      </div>

      {error && (
        <p className="mt-2 animate-rise text-[12px] text-accent">{error}</p>
      )}
    </div>
  );
}

/**
 * The comment thread: what has happened on this task, in order, each stamped.
 *
 * The stamp is the whole feature. `Notes` above says what the task is and is
 * rewritten in place, which destroys what it said before; this is a row per
 * moment, so "the export is timing out at 30s" and "it was the proxy, not the
 * query" stay two facts on two days instead of one field that only remembers
 * the second.
 *
 * Oldest at the top, newest at the bottom, with the box you type into at the
 * end of it — the journal's argument (§6, "A day is a thread"), which is the
 * same shape: a sequence of things that happened to one object is an order, not
 * a list, and an order read newest-first is read backwards.
 *
 * Fetched when the panel opens rather than carried on the `TaskView` the board
 * handed us: a board holds ninety tasks and shows none of this, and the panel
 * is the one place it is ever read.
 */
function CommentThread({ taskId }: { taskId: string }) {
  // `null` is "not back yet", which is a different thing from "none" — the
  // empty state invites you to write the first one, and flashing it while the
  // read is in flight would be the app claiming a thread is empty before it has
  // looked.
  const [comments, setComments] = useState<TaskCommentView[] | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void getTaskComments(taskId)
      .then((rows) => {
        if (live) setComments(rows);
      })
      .catch(() => {
        if (live) setComments([]);
      });
    // The panel outlives nothing here — it unmounts on close — but a task id
    // that changed under a mounted panel would otherwise let a slow read
    // overwrite a fast one with the wrong task's thread.
    return () => {
      live = false;
    };
  }, [taskId]);

  function add() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    startTransition(async () => {
      try {
        // The stamped row comes back from the server rather than being guessed
        // at here: the time is the database's, and formatting it twice is how
        // the new row comes to read differently from the one above it.
        const comment = await addComment(taskId, body);
        setComments((current) => [...(current ?? []), comment]);
        setDraft("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not add it");
      }
    });
  }

  function remove(id: string) {
    setComments((current) => current?.filter((row) => row.id !== id) ?? null);
    startTransition(() => {
      void deleteComment(id);
    });
  }

  return (
    <div className="mt-6">
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className={cn(labelCls, "mb-0")}>Comments</span>
        <span className="text-[11.5px] text-faint">
          What’s happened since, each one stamped
        </span>
      </div>

      {comments === null ? (
        <p className="text-[12px] text-faint">Looking…</p>
      ) : comments.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-faint">
          Nothing yet. What you found out, what you tried, what the person you
          were waiting on said.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="group animate-rise flex items-start gap-2 rounded-2xl bg-inset px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                {/* `break-words`, because a pasted URL is one unbroken word and
                    a 440px panel is the width it has to fit in. */}
                <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink">
                  {comment.body}
                </p>
                <p className="mt-1 text-[11px] text-faint" title={comment.at}>
                  {comment.when}
                </p>
              </div>
              <button
                type="button"
                disabled={pending}
                aria-label={`Delete this comment from ${comment.when}`}
                onClick={() => remove(comment.id)}
                // Visible outright on touch, revealed on hover on a pointer
                // device — §9, hover is not an affordance on a phone.
                className="grid size-6 shrink-0 place-items-center rounded-full text-faint transition-[background-color,color,opacity,transform] duration-(--duration-base) ease-soft hover:bg-card hover:text-accent active:scale-90 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X className="size-3.5" strokeWidth={2.2} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={2}
          // Enter makes a new line, as it does in every textarea in this app;
          // ⌘/Ctrl+Enter posts. Binding bare Enter to submit is what makes a
          // two-sentence comment impossible to write.
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey))
              return;
            event.preventDefault();
            add();
          }}
          placeholder="Turned out to be the clock, not the token."
          aria-label="Write a comment"
          className={cn(field, "resize-y")}
        />
        <div className="mt-1.5 flex items-center justify-end gap-2">
          {/* "Ctrl" rather than "⌘", matching the Markdown toolbar's hints — the
              handler takes either, and picking one at render time would be a
              platform check for a five-character label. */}
          <span className="text-[11px] text-faint">Ctrl + ↵ to post</span>
          <button
            type="button"
            disabled={pending || draft.trim() === ""}
            onClick={add}
            className="rounded-chip bg-inset px-3 py-1.5 text-[12.5px] text-muted transition-[background-color,color,transform,opacity] duration-(--duration-base) ease-soft hover:bg-line hover:text-ink active:scale-[0.97] disabled:opacity-35"
          >
            {pending ? "Posting…" : "Comment"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 animate-rise text-[12px] text-accent">{error}</p>
      )}
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
