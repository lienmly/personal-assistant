"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Pencil,
  Play,
  Plus,
  Repeat,
} from "lucide-react";

import { Checklist, ticksTheLastBox } from "@/components/tasks/checklist";
import type {
  ProjectBoardView,
  TaskLineView,
  TaskReason,
} from "@/components/today/types";
import { setTaskStatus } from "@/lib/task-actions";
import { cn } from "@/lib/utils";

/**
 * One project on Today: what it's for, and the few things on it worth seeing.
 *
 * This replaced the sprint focus list on 2026-08-04. The list it replaced was a
 * better answer to "what is the single next thing" and a worse answer to the
 * question actually asked each morning, which is "what have I got on". Its rows
 * were ranked across every project at once, so the one fact you needed to make
 * a choice — *which* project this belongs to — was a muted word at the end of a
 * line, and the ordering made the choice for you anyway.
 *
 * Nothing here counts down or reports a shortfall. That is the point: the
 * pressure was the complaint.
 *
 * **Since 2026-08-05 this card is also the project's editor.** The Projects
 * roster was a second list of the same projects and it is gone (CLAUDE.md §6),
 * so the pencil here opens the settings panel that used to live on it — which
 * makes this the only place a project can be renamed, re-tiered or archived.
 */
export function ProjectBoard({
  board,
  delay,
  onEdit,
}: {
  board: ProjectBoardView;
  delay: number;
  /** Opens the settings panel. Not called for "One-offs", which has no row. */
  onEdit: () => void;
}) {
  return (
    <div
      style={{ animationDelay: `${delay}ms` }}
      // A *named* group. `TaskLine` below uses the unnamed `group` for its
      // play button, and an unnamed `group-hover` matches any ancestor — so
      // sharing one would light up every row's controls on card hover.
      className="group/card animate-rise rounded-tile bg-inset/60 p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: board.areaColor }}
            />
            {board.slug ? (
              <Link
                href={`/projects/${board.slug}`}
                className="truncate text-[14px] font-semibold tracking-tight text-ink transition-colors duration-(--duration-quick) hover:text-accent"
              >
                {board.name}
              </Link>
            ) : (
              <span className="truncate text-[14px] font-semibold tracking-tight text-ink">
                {board.name}
              </span>
            )}
            {board.priority === "main" && (
              <span className="rounded-full bg-card px-2 py-px text-[10px] font-medium text-muted">
                main
              </span>
            )}
            {/* Visible outright on touch, revealed on hover on a pointer
                device — CLAUDE.md §9. A hover-only control does not exist on a
                phone, and this one is now the only route to archiving. */}
            {board.edit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${board.name}`}
                title={`Edit ${board.name}`}
                className="shrink-0 text-faint transition-[color,opacity,transform] duration-(--duration-base) ease-soft hover:text-ink active:scale-90 sm:opacity-0 sm:group-hover/card:opacity-100"
              >
                <Pencil className="size-3" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* The focal point. Falls back to the description so a project that
              has never had one written is still legible — but the placeholder
              on an empty card asks for it, because "what is this for" is the
              question this whole screen was rebuilt to answer. */}
          {(board.focus || board.description) && (
            <p className="mt-1.5 line-clamp-2 pl-4 text-[12.5px] leading-relaxed text-muted">
              {board.focus ?? board.description}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          {board.overdue > 0 && (
            <span className="rounded-full bg-accent-soft px-2 py-px text-[10px] font-medium text-accent">
              {board.overdue} overdue
            </span>
          )}
          {board.touchedLabel && (
            <p
              className={cn(
                "mt-1 text-[11px]",
                board.drifting ? "text-warn" : "text-faint",
              )}
            >
              {board.touchedLabel}
            </p>
          )}
        </div>
      </div>

      {board.tasks.length > 0 ? (
        <div className="flex flex-col">
          {board.tasks.map((task) => (
            <TaskLine key={task.id} task={task} />
          ))}
        </div>
      ) : board.openTotal > 0 ? (
        // Not the same sentence as "nothing open". Everything this project has
        // left repeats and is waiting for its day, so saying the card is empty
        // would be untrue — and the "N more →" below already points at where
        // those rows live.
        <p className="px-2 py-2 text-[12.5px] leading-relaxed text-faint">
          Nothing due today.
        </p>
      ) : (
        <p className="px-2 py-2 text-[12.5px] leading-relaxed text-faint">
          Nothing open here.{" "}
          {board.slug && (
            <Link
              href={`/projects/${board.slug}?tab=tasks`}
              className="text-muted underline decoration-line underline-offset-2 transition-colors duration-(--duration-quick) hover:text-ink"
            >
              Put something on it
            </Link>
          )}
        </p>
      )}

      {(board.openTotal > board.tasks.length || board.slug) && (
        <div className="mt-2 flex items-center justify-between gap-3 pl-2">
          {board.openTotal > board.tasks.length ? (
            <Link
              href={`/projects/${board.slug}?tab=tasks`}
              className="text-[12px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
            >
              {board.openTotal - board.tasks.length} more →
            </Link>
          ) : (
            <span />
          )}
          {board.slug && (
            <Link
              href={`/projects/${board.slug}?tab=tasks`}
              aria-label={`Add a task to ${board.name}`}
              title={`Add a task to ${board.name}`}
              className="flex items-center gap-1 text-[12px] text-faint transition-colors duration-(--duration-quick) hover:text-ink"
            >
              <Plus className="size-3.5" strokeWidth={2} />
              Add
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

const BADGE: Record<TaskReason, { label: string; className: string } | null> = {
  doing: { label: "in flight", className: "bg-warn-soft text-warn" },
  overdue: { label: "overdue", className: "bg-accent-soft text-accent" },
  today: { label: "today", className: "bg-card text-muted" },
  soon: null,
  open: null,
};

function TaskLine({ task }: { task: TaskLineView }) {
  // Two transitions, not one. Ticking done removes the row so it folds away;
  // the other buttons leave it in place, so they only recede. Sharing a single
  // `isPending` would collapse the row every time you pressed "start".
  const [leaving, startDone] = useTransition();
  const [pending, startEdit] = useTransition();
  // A third, for the checklist. Ticking a step usually leaves the row alone —
  // except the step that empties it, which finishes the job. Recorded at click
  // time because the list has already changed by the time the action returns.
  const [subPending, startSubtask] = useTransition();
  const [subtaskFinishes, setSubtaskFinishes] = useState(false);
  const busy = leaving || pending || subPending;
  const badge = BADGE[task.reason];
  const doing = task.status === "doing";

  // Every route out of this row now removes it from Today. A one-off is done;
  // a recurring job re-arms onto its next day, which `dueByToday` hides. It
  // used to stay put with tomorrow's date, which is the thing that made a
  // finished job look outstanding.
  const folding = leaving || (subPending && subtaskFinishes);

  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-(--duration-base) ease-exit",
        folding
          ? "grid-rows-[0fr] opacity-0 delay-[140ms]"
          : "grid-rows-[1fr] opacity-100",
      )}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            "group flex items-center gap-2.5 rounded-tile px-2 py-1.5 transition-[background-color,opacity,transform] duration-(--duration-base) ease-soft hover:translate-x-0.5 hover:bg-card",
            pending && "pointer-events-none opacity-45",
          )}
        >
          <button
            type="button"
            disabled={busy}
            aria-label={`Mark "${task.title}" as done`}
            onClick={() => startDone(() => setTaskStatus(task.id, "done"))}
            className="grid size-5 shrink-0 place-items-center rounded-full bg-card text-transparent transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:bg-good hover:text-white active:scale-90"
          >
            <Check className="size-3" strokeWidth={3} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] leading-snug text-ink">
              {task.title}
            </p>
            {(badge || task.track || task.dueLabel || task.repeatLabel) && (
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
                {task.track && <span className="truncate">{task.track}</span>}
                {task.dueLabel && task.reason !== "today" && (
                  <>
                    {task.track && <span>·</span>}
                    <span>{task.dueLabel}</span>
                  </>
                )}
                {/* A repeating row must say so, because the tick beside it does
                    something else: it records today and moves the task on. */}
                {task.repeatLabel && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Repeat className="size-3" strokeWidth={2.2} />
                      {task.repeatLabel}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>

          {/* "Doing" is the one thing on the screen that says *this is what I
              am on right now*, so it is a toggle and not a dropdown. */}
          <button
            type="button"
            disabled={busy}
            aria-label={doing ? "Stop working on this" : "Start working on this"}
            title={doing ? "Stop working on this" : "Start working on this"}
            onClick={() =>
              startEdit(() => setTaskStatus(task.id, doing ? "open" : "doing"))
            }
            className={cn(
              "shrink-0 transition-[color,transform] duration-(--duration-base) ease-soft hover:scale-110 active:scale-100",
              doing
                ? "text-warn"
                : "text-faint hover:text-ink sm:opacity-0 sm:group-hover:opacity-100",
            )}
          >
            <Play
              className="size-3.5"
              strokeWidth={1.8}
              fill={doing ? "currentColor" : "none"}
            />
          </button>

          {/* A task's link is usually a post worth copying, which wants a new
              tab. But a link can point *into* the app, and opening your own
              dashboard in a second tab is nobody's intent. */}
          {task.link &&
            (task.link.startsWith("/") ? (
              <Link
                href={task.link}
                aria-label="Go there"
                className="shrink-0 text-faint transition-colors duration-(--duration-quick) hover:text-accent"
              >
                <ArrowRight className="size-3.5" strokeWidth={2} />
              </Link>
            ) : (
              <a
                href={task.link}
                target="_blank"
                rel="noreferrer"
                aria-label="Open the linked post"
                className="shrink-0 text-faint transition-colors duration-(--duration-quick) hover:text-ink"
              >
                <ExternalLink className="size-3.5" strokeWidth={1.8} />
              </a>
            ))}
        </div>

        {/* Open by default here and nowhere else. Today is the screen you are
            on in order to *tick*, and a checklist you have to expand first is
            one tap of friction on the thing this row exists for. */}
        {task.subtasks.length > 0 && (
          <div className="pb-1 pl-9">
            <Checklist
              subtasks={task.subtasks}
              defaultOpen
              busy={busy}
              onTick={(subtaskId, subtaskDone) => {
                setSubtaskFinishes(
                  subtaskDone && ticksTheLastBox(task.subtasks, subtaskId),
                );
                startSubtask(() =>
                  setTaskStatus(subtaskId, subtaskDone ? "done" : "open"),
                );
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
