"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Plus,
  Repeat,
} from "lucide-react";

import { TaskPanel } from "@/components/board/task-panel";
import type { AreaView, BoardProjectView, TaskView } from "@/components/board/types";
import { Checklist, ticksTheLastBox } from "@/components/tasks/checklist";
import { setTaskStatus } from "@/lib/task-actions";
import { repeatLabel } from "@/lib/task-view";
import { trackRank } from "@/lib/tracks";
import { cn } from "@/lib/utils";

/**
 * One owner's task list — as three stage columns, or grouped by track.
 *
 * Not the Hunt Board with a filter applied: the board's job is *choosing*
 * across projects, so it carries scope pills and a capture box, neither of
 * which means anything once you have already decided which project you are in. What is left is the list and the tracks — which is the whole of what
 * "open Sleepy Cat and see where it stands" needs.
 *
 * Was `ProjectTasks` until 2026-08-05. An area page needs the identical screen —
 * the Baby area has tasks and no project to hang them off — and the only thing
 * that differed was what a *new* row defaults to, which is now a prop.
 *
 * **Two views since 2026-08-07, and they answer different questions.** Stages
 * (`open` → `doing` → `done`) answer *how is this moving*, which a flat list
 * cannot: a project with forty rows and three of them in flight looks exactly
 * like a project with forty rows and none. Tracks answer *what kind of work is
 * left*, which is why they exist at all (CLAUDE.md §6, "free text, not an
 * enum") and why they are one tap away rather than gone. Stages lead because
 * progress is what a Tasks tab is opened to check; each column is still cut into
 * track runs under its own heading, so choosing the columns never costs you
 * which workstream a row belongs to.
 *
 * **The track is on the run, not on the card**, and that is the whole reason the
 * heading exists. A chip per card put the same word — "Setup", four times
 * running — on a line of its own beneath every title, which both repeated itself
 * and doubled the height of every card in the column. Said once per run it is
 * the same information in a third of the space.
 */

type View = "stages" | "tracks";

const STAGES = [
  { id: "open", label: "To do" },
  { id: "doing", label: "Doing" },
  { id: "done", label: "Done" },
] as const;

type Stage = (typeof STAGES)[number]["id"];

/**
 * How many cards a column shows before it offers the rest.
 *
 * This is what replaced an inner scrollbar per column. The cap was always
 * needed — Sleepy Cat is 88 · 0 · 1, and an uncapped board is a page 88 cards
 * tall with two empty columns beside it — but `overflow-y-auto` was the wrong
 * way to get it. It put a scrollbar inside a design that has none anywhere else
 * (§9: chrome is near-invisible), and worse, it made the wheel do two different
 * things depending on where the pointer was: a column that had hit its own
 * bottom simply swallowed the scroll instead of moving the page.
 *
 * One number for all three columns, rather than a queue rule and a record rule.
 * The mechanism is the same and a single cap is the one you can predict.
 */
const SHOWN_PER_COLUMN = 12;

/**
 * Rows → track runs, in track order. Shared by both views, which is the point:
 * the columns and the track list must not disagree about what order the tracks
 * come in or what an untracked row is called.
 */
function groupByTrack(rows: TaskView[]) {
  const byTrack = new Map<string, TaskView[]>();
  for (const task of rows) {
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
}

export function TaskList({
  tasks,
  defaults,
  projects,
  areas,
  emptyHint,
}: {
  tasks: TaskView[];
  /** What the panel pre-fills when you add a row here: a project on a project
   *  page, an area on an area page. */
  defaults: { projectId?: string; areaId?: string };
  projects: BoardProjectView[];
  areas: AreaView[];
  emptyHint?: string;
}) {
  const [view, setView] = useState<View>("stages");
  const [showDone, setShowDone] = useState(false);
  /** Which columns are showing everything. Per stage, because expanding "To do"
   *  should not also unfurl 80 finished rows underneath it. */
  const [expanded, setExpanded] = useState<Partial<Record<Stage, boolean>>>({});
  const [panel, setPanel] = useState<
    { mode: "edit"; task: TaskView } | { mode: "new"; track: string | null } | null
  >(null);

  const groups = useMemo(
    () => groupByTrack(tasks.filter((task) => showDone || task.status !== "done")),
    [tasks, showDone],
  );

  /** The same rows, split by stage. Within a column the order the query gave
   *  them is kept — `sortOrder` then `createdAt` — so a card does not jump
   *  position when its neighbour moves. */
  const columns = useMemo(() => {
    const byStage: Record<Stage, TaskView[]> = { open: [], doing: [], done: [] };
    for (const task of tasks) {
      const stage = (task.status as Stage) ?? "open";
      (byStage[stage] ?? byStage.open).push(task);
    }
    return byStage;
  }, [tasks]);

  const doneCount = columns.done.length;

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

        {/* A segmented control, black for the selection — the reference's own
            pattern for a two-option switch, and small enough not to compete
            with the page's hero tile (§9). */}
        <div className="flex gap-1 rounded-chip bg-inset p-1">
          {(
            [
              { id: "stages", label: "Stages" },
              { id: "tracks", label: "Tracks" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setView(option.id)}
              className={cn(
                "rounded-chip px-3 py-1.5 text-[12.5px] transition-[background-color,color] duration-(--duration-base) ease-soft active:scale-[0.97]",
                view === option.id
                  ? "bg-obsidian font-medium text-white"
                  : "text-muted hover:text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Only in the track view. In columns the finished rows have their own
            column, so a control that hides them would be hiding a third of the
            layout. */}
        {view === "tracks" && doneCount > 0 && (
          <button
            type="button"
            onClick={() => setShowDone((value) => !value)}
            className="ml-auto rounded-chip bg-inset px-3 py-2 text-[12.5px] text-muted transition-colors duration-(--duration-quick) hover:text-ink active:scale-[0.97]"
          >
            {showDone ? "Hide done" : `Show ${doneCount} done`}
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-tile bg-inset px-4 py-8 text-center text-[13px] text-muted">
          {emptyHint ??
            "Nothing open on this project. Add the next thing before you forget it."}
        </p>
      ) : view === "stages" ? (
        <div className="grid gap-3 md:grid-cols-3">
          {STAGES.map((stage, index) => {
            const all = columns[stage.id];
            const open = expanded[stage.id] ?? false;
            const rows = open ? all : all.slice(0, SHOWN_PER_COLUMN);
            return (
              <section
                key={stage.id}
                style={{ animationDelay: `${index * 45}ms` }}
                className="animate-rise rounded-tile bg-inset p-3"
              >
                <div className="mb-2.5 flex items-center justify-between gap-2 px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
                    {stage.label}
                  </span>
                  <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-muted">
                    {all.length}
                  </span>
                </div>

                {all.length === 0 ? (
                  <p className="px-1 py-4 text-center text-[12px] text-faint">
                    {stage.id === "open"
                      ? "Nothing waiting"
                      : stage.id === "doing"
                        ? "Nothing in flight"
                        : "Nothing ticked off yet"}
                  </p>
                ) : (
                  // No inner scroll: the column is as tall as what it shows,
                  // and what it shows is capped. There is one scroll region on
                  // this page and it is the page.
                  <div className="flex flex-col gap-3">
                    {groupByTrack(rows).map((group) => (
                      <div key={group.track || "untracked"} className="flex flex-col">
                        {/* The track, said once for the run rather than on every
                            card — a chip per card repeated the same word down
                            the column and cost each card a second line. */}
                        <p className="pb-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint">
                          {group.track || "Untracked"}
                        </p>
                        <div className="flex flex-col gap-2">
                          {group.rows.map((task) => (
                            <StageCard
                              key={task.id}
                              task={task}
                              stage={stage.id}
                              onOpen={() => setPanel({ mode: "edit", task })}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {all.length > SHOWN_PER_COLUMN && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((current) => ({
                        ...current,
                        [stage.id]: !open,
                      }))
                    }
                    className="mt-2 w-full rounded-tile px-2 py-1.5 text-[12px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
                  >
                    {open
                      ? "Show fewer"
                      : `${all.length - SHOWN_PER_COLUMN} more →`}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-tile bg-inset px-4 py-8 text-center text-[13px] text-muted">
          {emptyHint ??
            "Nothing open on this project. Add the next thing before you forget it."}
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
            panel.mode === "new" ? { ...defaults, track: panel.track } : undefined
          }
          onClose={() => setPanel(null)}
        />
      )}
    </>
  );
}

/** Where each arrow sends a card. `null` means the arrow is not drawn — there
 *  is nothing to the left of "To do" and nothing to the right of "Done". */
const MOVE: Record<Stage, { back: Stage | null; next: Stage | null }> = {
  open: { back: null, next: "doing" },
  doing: { back: "open", next: "done" },
  done: { back: "open", next: null },
};

const MOVE_LABEL: Record<Stage, string> = {
  open: "To do",
  doing: "Doing",
  done: "Done",
};

/**
 * One card in a stage column.
 *
 * The tick is kept beside the arrows rather than replaced by them: it is the
 * same control in the same place on every other surface in this app, and it is
 * the one-tap path from "To do" straight to done, which is most rows. The
 * arrows are what the columns add — they are the only way to say *I have
 * started this* without opening the panel.
 *
 * A repeating card is deliberately not special-cased. Ticking it advances the
 * row rather than finishing it, so it reappears under "To do" dated forward,
 * which is exactly what happens everywhere else and is what the `Repeat` chip
 * on the card warns about.
 *
 * It carries no track: the column groups by track and says it once per run.
 * What is left — a repeat badge, a due date, a link — sits on the title's row
 * rather than under it, so an ordinary card is one line tall.
 */
function StageCard({
  task,
  stage,
  onOpen,
}: {
  task: TaskView;
  stage: Stage;
  onOpen: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [subPending, startSubtask] = useTransition();
  const [subtaskFinishes, setSubtaskFinishes] = useState(false);
  const done = stage === "done";
  const busy = pending || subPending;
  const repeat = repeatLabel(task);
  const moves = MOVE[stage];

  // The card leaves this column while the move is in flight, for the reason
  // CLAUDE.md §10 gives: what removes it is the revalidated data arriving, so
  // without this it blinks out. Derived from `isPending`, so a failed action
  // unfolds it again rather than leaving a gap.
  const leaving =
    pending || (subPending && subtaskFinishes && task.recurrence === "none");

  const move = (to: Stage) => startTransition(() => setTaskStatus(task.id, to));

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
          className={cn(
            "group rounded-tile bg-card p-2.5 shadow-card transition-[opacity,transform] duration-(--duration-base) ease-soft",
            busy && "pointer-events-none opacity-45",
            done && "opacity-70",
          )}
        >
          <div className="flex items-start gap-2.5">
            <button
              type="button"
              disabled={busy}
              aria-label={done ? "Reopen this task" : "Mark as done"}
              onClick={() => move(done ? "open" : "done")}
              className={cn(
                "mt-px grid size-5 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-90",
                done
                  ? "bg-good text-white"
                  : "bg-inset text-transparent hover:bg-line hover:text-muted",
              )}
            >
              <Check
                key={done ? "done" : "todo"}
                className={cn("size-3", done && "animate-pop")}
                strokeWidth={3}
              />
            </button>

            <button
              type="button"
              onClick={onOpen}
              title="Open this task"
              className="min-w-0 flex-1 text-left"
            >
              <span
                className={cn(
                  "block text-[12.5px] leading-snug text-ink",
                  done && "line-through",
                )}
              >
                {task.title}
              </span>
            </button>

            {/* On the title's row, not under it. A chip on its own line
                doubles the height of every card in the column, and a card is
                mostly a title — so what is left after the track moved to the
                run heading is short enough to sit beside one. */}
            {repeat && (
              <span
                className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-inset px-1.5 py-0.5 text-[10.5px] text-muted"
                title="Repeats — ticking it moves it to the next day"
              >
                <Repeat className="size-2.5" strokeWidth={2.4} />
                {repeat}
              </span>
            )}
            {task.dueLabel && (
              <span
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10.5px]",
                  task.overdue && !done
                    ? "bg-accent-soft text-accent"
                    : "bg-inset text-muted",
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
                className="grid size-5 shrink-0 place-items-center rounded-full text-faint transition-colors duration-(--duration-quick) hover:text-ink"
              >
                <ExternalLink className="size-3" strokeWidth={2} />
              </a>
            )}

            {/* Visible outright on touch, revealed on hover on a pointer
                device — §9. These are the only way to move a card without
                opening the panel. */}
            <div className="flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100">
              {moves.back && (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Move to ${MOVE_LABEL[moves.back]}`}
                  title={`Move to ${MOVE_LABEL[moves.back]}`}
                  onClick={() => moves.back && move(moves.back)}
                  className="grid size-5 place-items-center rounded-full text-faint transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:bg-inset hover:text-ink active:scale-90"
                >
                  <ChevronLeft className="size-3.5" strokeWidth={2.4} />
                </button>
              )}
              {moves.next && (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Move to ${MOVE_LABEL[moves.next]}`}
                  title={`Move to ${MOVE_LABEL[moves.next]}`}
                  onClick={() => moves.next && move(moves.next)}
                  className="grid size-5 place-items-center rounded-full text-faint transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:bg-inset hover:text-ink active:scale-90"
                >
                  <ChevronRight className="size-3.5" strokeWidth={2.4} />
                </button>
              )}
            </div>
          </div>

          {task.subtasks.length > 0 && (
            <div className="pl-7.5">
              <Checklist
                subtasks={task.subtasks}
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
    </div>
  );
}

function TaskRow({ task, onOpen }: { task: TaskView; onOpen: () => void }) {
  const [pending, startTransition] = useTransition();
  const [subPending, startSubtask] = useTransition();
  const [subtaskFinishes, setSubtaskFinishes] = useState(false);
  const done = task.status === "done";
  const repeat = repeatLabel(task);

  // Ticking the last box completes the job — but only a one-off actually
  // leaves; a recurring row re-arms for its next day and stays put.
  const folding =
    (pending && !done) ||
    (subPending && subtaskFinishes && task.recurrence === "none");

  return (
    // The fold-out on completion: `grid-template-rows` 1fr → 0fr, with the
    // collapsed state *derived* from `isPending` so a failed action unfolds the
    // row again instead of leaving a gap. See CLAUDE.md §10.
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-(--duration-slow) ease-soft",
        folding ? "grid-rows-[0fr] delay-[140ms]" : "grid-rows-[1fr]",
      )}
    >
      <div className="overflow-hidden">
        <div
          className={cn(
            "rounded-tile bg-inset px-3.5 py-2.5 transition-[background-color] duration-(--duration-quick) hover:bg-line/50",
            done && "opacity-55",
          )}
        >
        <div className="flex items-center gap-3">
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

          {task.status === "doing" && (
            <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-medium text-warn">
              doing
            </span>
          )}

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

        {/* Collapsed, like the board: a project page is where you survey the
            work, and the steps of one job are detail below that. */}
        {task.subtasks.length > 0 && (
          <div className="pl-8">
            <Checklist
              subtasks={task.subtasks}
              busy={subPending}
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
    </div>
  );
}
