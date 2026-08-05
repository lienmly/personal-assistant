"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronRight,
  ExternalLink,
  Link2,
  Plus,
  Repeat,
  Sparkles,
} from "lucide-react";

import { TaskPanel } from "@/components/board/task-panel";
import type {
  AreaView,
  BoardProjectView,
  TaskView,
} from "@/components/board/types";
import { Checklist, ticksTheLastBox } from "@/components/tasks/checklist";
import { captureExperiment, setTaskStatus } from "@/lib/task-actions";
import { repeatLabel } from "@/lib/task-view";
import { trackRank } from "@/lib/tracks";
import { cn } from "@/lib/utils";

type PanelState =
  | { mode: "edit"; task: TaskView }
  | { mode: "new"; projectId: string | null; track: string | null };

/** "Main projects" or "everything". Deliberately two options and not four: a
 *  scope control with a long menu is one more thing to read. */
type Scope = "main" | "all";

export function HuntBoard({
  tasks,
  projects,
  areas,
  experimentProjectId,
}: {
  tasks: TaskView[];
  projects: BoardProjectView[];
  areas: AreaView[];
  /** Where a pasted link lands by default — Utaitai, in practice. */
  experimentProjectId: string | null;
}) {
  const [scope, setScope] = useState<Scope>("main");
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [panel, setPanel] = useState<PanelState | null>(null);
  // Only the sections you have *explicitly* toggled. Everything else follows
  // the default below, so adding a project doesn't need this state seeding.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  /** Everything, after the filters. There is no longer a committed subset to
   *  hold back — the sprint was retired on 2026-08-04, and this board is the
   *  complete list it always claimed to be. */
  const visible = useMemo(() => {
    const mainProjects = new Set(
      projects.filter((p) => p.priority === "main").map((p) => p.id),
    );
    return tasks.filter(
      (task) =>
        (areaFilter === null || task.areaId === areaFilter) &&
        (showDone || task.status !== "done") &&
        (scope === "all" ||
          (task.projectId !== null && mainProjects.has(task.projectId))),
    );
  }, [tasks, projects, areaFilter, showDone, scope]);

  /**
   * Project → track → tasks. Two levels because a project like Sleepy Cat runs
   * "build the game", "make the art" and "get it on Steam" concurrently, and a
   * flat twenty rows under one heading reads as noise.
   */
  const groups = useMemo(() => {
    const byProject = new Map<string, TaskView[]>();
    for (const task of visible) {
      const key = task.projectId ?? `area:${task.areaId}`;
      const bucket = byProject.get(key);
      if (bucket) bucket.push(task);
      else byProject.set(key, [task]);
    }

    const headings = [
      ...projects.map((project) => ({
        key: project.id,
        title: project.name,
        color: project.area.color,
        subtitle: project.area.name,
        priority: project.priority as string,
        projectId: project.id as string | null,
      })),
      // One-offs belong to no project and so belong to no tier. They appear
      // under "everything", where a list of loose ends is what you came for.
      ...(scope === "all"
        ? areas.map((area) => ({
            key: `area:${area.id}`,
            title: area.name,
            color: area.color,
            subtitle: "One-offs",
            priority: "side",
            projectId: null,
          }))
        : []),
    ];

    return headings
      .map((heading) => {
        const rows = byProject.get(heading.key) ?? [];
        const tracks = new Map<string, TaskView[]>();
        for (const task of rows) {
          const name = task.track ?? "";
          const bucket = tracks.get(name);
          if (bucket) bucket.push(task);
          else tracks.set(name, [task]);
        }
        return {
          ...heading,
          openCount: rows.filter((task) => task.status !== "done").length,
          tracks: [...tracks.entries()]
            .map(([name, rows]) => ({ name, rows }))
            .sort(
              (a, b) =>
                trackRank(a.name || null) - trackRank(b.name || null) ||
                a.name.localeCompare(b.name),
            ),
        };
      })
      // A project with nothing on it still gets a heading — the empty roster
      // slot is a prompt. An *area* with nothing floating in it does not.
      .filter((group) => group.projectId !== null || group.tracks.length > 0)
      .filter(
        (group) =>
          scope === "all" ||
          group.projectId === null ||
          group.priority === "main",
      );
  }, [visible, projects, areas, scope]);

  /**
   * The fix for "the board dumps everything on my face": a section starts open
   * only if it's a main project. Sixty rows is the right *contents* for a
   * planning surface and the wrong thing to be shown all at once, so the side
   * projects are one click away rather than zero.
   */
  const isOpen = (key: string, priority: string) =>
    toggled[key] ?? priority === "main";

  // Areas with nothing in them are chips that do nothing. Right now three of
  // the four are empty, and a filter row of dead controls teaches you to stop
  // reading the filter row.
  const usedAreas = useMemo(() => {
    const live = new Set([
      ...projects.map((project) => project.areaId),
      ...tasks.filter((task) => task.projectId === null).map((m) => m.areaId),
    ]);
    return areas.filter((area) => live.has(area.id));
  }, [areas, projects, tasks]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ScopePill
          active={scope === "main"}
          onClick={() => setScope("main")}
          label="Main projects"
          delay={0}
        />
        <ScopePill
          active={scope === "all"}
          onClick={() => setScope("all")}
          label="Everything"
          delay={35}
        />

        {usedAreas.length > 1 &&
          usedAreas.map((area, index) => (
            <FilterChip
              key={area.id}
              active={areaFilter === area.id}
              onClick={() =>
                setAreaFilter(areaFilter === area.id ? null : area.id)
              }
              dot={area.color}
              label={area.name}
              delay={(index + 2) * 35}
            />
          ))}

        <button
          type="button"
          onClick={() => setShowDone((value) => !value)}
          style={{ animationDelay: `${(usedAreas.length + 2) * 35}ms` }}
          className={cn(
            "ml-auto animate-rise rounded-chip px-3 py-2 text-[13px] transition-[background-color,color,box-shadow,transform] duration-(--duration-base) ease-soft active:scale-[0.97]",
            showDone ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink",
          )}
        >
          {showDone ? "Hide done" : "Show done"}
        </button>

        <button
          type="button"
          onClick={() => setPanel({ mode: "new", projectId: null, track: null })}
          style={{ animationDelay: `${(usedAreas.length + 3) * 35}ms` }}
          className="group flex animate-rise items-center gap-1.5 rounded-chip bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
        >
          <Plus
            className="size-3.5 transition-transform duration-(--duration-base) ease-soft group-hover:rotate-90"
            strokeWidth={2.4}
          />
          New task
        </button>
      </div>

      <ExperimentCapture projectId={experimentProjectId} areaId={areas[0]?.id ?? ""} />

      <div className="mt-5 flex flex-col gap-4">
        {groups.map((group, index) => {
          const open = isOpen(group.key, group.priority);
          // Rows settle in reading order within their card. The counter runs
          // across tracks so the second track continues the ladder rather than
          // restarting it, and it's capped so a long project doesn't end up
          // dealing out its last rows a second later.
          let rowIndex = 0;
          return (
            <section
              key={group.key}
              style={{ animationDelay: `${180 + index * 45}ms` }}
              className="animate-rise rounded-card bg-card p-5 shadow-card"
            >
              <button
                type="button"
                onClick={() =>
                  setToggled((current) => ({ ...current, [group.key]: !open }))
                }
                className="flex w-full items-center gap-2.5 text-left"
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 shrink-0 text-faint transition-transform duration-(--duration-base) ease-soft",
                    open && "rotate-90",
                  )}
                  strokeWidth={2.4}
                />
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: group.color }}
                />
                <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                  {group.title}
                </h2>
                {group.priority === "main" && (
                  <span className="shrink-0 rounded-full bg-obsidian px-2 py-0.5 text-[10px] font-medium text-white">
                    main
                  </span>
                )}
                <span className="truncate text-[12px] text-faint">
                  {group.subtitle}
                </span>
                <span className="ml-auto shrink-0 rounded-full bg-inset px-2.5 py-1 text-xs font-medium text-muted">
                  {group.openCount} open
                </span>
              </button>

              {open &&
                (group.tracks.length === 0 ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPanel({
                        mode: "new",
                        projectId: group.projectId,
                        track: null,
                      })
                    }
                    className="mt-4 w-full rounded-tile border border-dashed border-line py-4 text-[13px] text-faint transition-[border-color,color,transform] duration-(--duration-base) ease-soft hover:border-muted hover:text-muted active:scale-[0.985]"
                  >
                    Nothing on this project — add the first task
                  </button>
                ) : (
                  <div className="mt-4 flex flex-col gap-4">
                    {group.tracks.map((track) => (
                      <div key={track.name}>
                        <div className="mb-1.5 flex items-center gap-2">
                          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                            {track.name || "Unfiled"}
                          </h3>
                          <button
                            type="button"
                            aria-label={`Add a task to ${track.name || "this project"}`}
                            onClick={() =>
                              setPanel({
                                mode: "new",
                                projectId: group.projectId,
                                track: track.name || null,
                              })
                            }
                            className="text-faint transition-[color,transform] duration-(--duration-base) ease-soft hover:scale-125 hover:text-ink active:scale-100"
                          >
                            <Plus className="size-3" strokeWidth={2.4} />
                          </button>
                        </div>
                        <div className="flex flex-col">
                          {track.rows.map((task) => (
                            <TaskRow
                              key={task.id}
                              task={task}
                              delay={60 + Math.min(rowIndex++, 8) * 28}
                              collapseOnDone={!showDone}
                              onOpen={() => setPanel({ mode: "edit", task })}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </section>
          );
        })}

        {groups.length === 0 && (
          <p className="rounded-card bg-card p-8 text-center text-[13px] text-faint shadow-card">
            Nothing here. Try &ldquo;Everything&rdquo; — the side projects are
            filtered out of this view on purpose.
          </p>
        )}
      </div>

      {panel && (
        <TaskPanel
          task={panel.mode === "edit" ? panel.task : null}
          projects={projects}
          areas={areas}
          defaults={
            panel.mode === "new"
              ? { projectId: panel.projectId, track: panel.track }
              : undefined
          }
          onClose={() => setPanel(null)}
        />
      )}
    </>
  );
}

/**
 * Paste a link, get a task. This exists because the moment you find a format
 * worth stealing you are scrolling on a phone — anything longer than one paste
 * and one tap doesn't get done, and the idea is gone by evening.
 */
function ExperimentCapture({
  projectId,
  areaId,
}: {
  projectId: string | null;
  areaId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The captured task lands in a card further down the page, which is easy to
  // miss on a phone — so the button itself confirms, then quietly reverts.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 1800);
    return () => clearTimeout(timer);
  }, [saved]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await captureExperiment(form);
        setLink("");
        setTitle("");
        setSaved(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      style={{ animationDelay: "120ms" }}
      className="animate-rise rounded-card bg-inset p-4"
    >
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      {!projectId && <input type="hidden" name="areaId" value={areaId} />}

      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-3.5 text-faint" strokeWidth={1.8} />
        <h2 className="text-[13px] font-medium text-ink">
          Saw a format worth stealing?
        </h2>
        <span className="text-[12px] text-faint">
          Paste the link — it lands under Experiments
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
          <input
            name="link"
            type="url"
            inputMode="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://tiktok.com/@…/video/…"
            className="w-full rounded-chip bg-card py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition-[box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint focus:ring-2 focus:ring-accent/25"
          />
        </div>
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What to try (optional)"
          className="rounded-chip bg-card px-3 py-2 text-[13px] text-ink outline-none transition-[box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint focus:ring-2 focus:ring-accent/25 sm:w-[220px]"
        />
        <button
          type="submit"
          disabled={pending || link.trim() === ""}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-chip bg-card px-4 py-2 text-[13px] font-medium shadow-card transition-[color,transform,opacity] duration-(--duration-base) ease-soft active:scale-[0.97] disabled:opacity-35",
            saved ? "text-good" : "text-ink",
          )}
        >
          {saved && <Check className="size-3.5" strokeWidth={3} />}
          {saved ? "Captured" : pending ? "Saving…" : "Capture"}
        </button>
      </div>

      {error && (
        <p className="mt-2 animate-rise text-[12px] text-accent">{error}</p>
      )}
    </form>
  );
}

function TaskRow({
  task,
  onOpen,
  delay,
  collapseOnDone,
}: {
  task: TaskView;
  onOpen: () => void;
  delay: number;
  /** True when "show done" is off, so ticking this row will remove it. */
  collapseOnDone: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [subPending, startSubtask] = useTransition();
  // Whether the subtask tick currently in flight is the one that empties the
  // checklist — and so completes this row and takes it off the board. Set at
  // click time because by the time the action returns the list has changed.
  const [subtaskFinishes, setSubtaskFinishes] = useState(false);
  const done = task.status === "done";
  const busy = pending || subPending;
  const repeat = repeatLabel(task);

  // The row folds away while the tick is in flight, because the server
  // round-trip is what unmounts it and an un-animated disappearance is the
  // jankiest thing on the board. Derived from `pending` rather than held in
  // state, so a failed action simply unfolds it again instead of leaving a
  // blank gap where the row was.
  //
  // A subtask tick folds it too, but only the last one, and only when this row
  // is going to *finish*: a recurring task re-arms and stays put, so folding it
  // there would animate away a row that is about to be redrawn.
  const leaving =
    collapseOnDone &&
    !done &&
    (pending || (subPending && subtaskFinishes && task.recurrence === "none"));

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
            busy && "pointer-events-none opacity-45",
          )}
        >
          <button
            type="button"
            disabled={busy}
            aria-label={done ? "Reopen this task" : "Mark as done"}
            onClick={() =>
              startTransition(() =>
                setTaskStatus(task.id, done ? "open" : "done"),
              )
            }
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-90",
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
            className="min-w-0 flex-1 text-left"
          >
            <p
              className={cn(
                "truncate text-[13px] leading-snug transition-colors duration-(--duration-base) ease-soft",
                done ? "text-faint line-through" : "text-ink",
              )}
            >
              {task.title}
            </p>
            {(task.dueLabel || task.notes || repeat) && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
                {repeat && (
                  <>
                    <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-muted">
                      <Repeat className="size-3" strokeWidth={2.2} />
                      {repeat}
                    </span>
                    {(task.dueLabel || task.notes) && <span>·</span>}
                  </>
                )}
                {/* `shrink-0` and no wrapping: the notes beside this are long
                    and flex was squeezing "1 Aug" onto two lines. */}
                {task.dueLabel && (
                  <span
                    className={cn(
                      "shrink-0 whitespace-nowrap",
                      task.overdue && !done && "font-medium text-accent",
                    )}
                  >
                    {task.dueLabel}
                  </span>
                )}
                {task.dueLabel && task.notes && (
                  <span className="shrink-0">·</span>
                )}
                {task.notes && <span className="truncate">{task.notes}</span>}
              </p>
            )}
          </button>

          {task.status === "doing" && (
            <span className="shrink-0 animate-rise rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-medium text-warn">
              doing
            </span>
          )}

          {task.link && (
            <a
              href={task.link}
              target="_blank"
              rel="noreferrer"
              aria-label="Open the linked post"
              className="shrink-0 text-faint transition-[color,transform] duration-(--duration-base) ease-soft hover:-translate-y-px hover:text-ink active:translate-y-0"
            >
              <ExternalLink className="size-3.5" strokeWidth={1.8} />
            </a>
          )}
        </div>

        {/* Below the row rather than in it, indented to the title: a checklist
            is *part of* this job, and the tree in the reference (§9) is the
            pattern for that. Collapsed by default — the board is where you
            choose which job, and an expanded checklist under every row is the
            same wall of detail the scope pills exist to hold back. */}
        {task.subtasks.length > 0 && (
          <div className="pb-1 pl-10">
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
  );
}

/** The scope control. Black-filled when active — the reference uses black as a
 *  second emphasis for exactly this: the currently-selected segment. */
function ScopePill({
  active,
  onClick,
  label,
  delay,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  delay: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "animate-rise rounded-chip px-3.5 py-2 text-[13px] transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-[0.97]",
        active
          ? "bg-obsidian font-medium text-white"
          : "text-muted hover:bg-card/60 hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  dot,
  label,
  delay,
}: {
  active: boolean;
  onClick: () => void;
  dot: string;
  label: string;
  delay: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={cn(
        "flex animate-rise items-center gap-2 rounded-chip px-3 py-2 text-[13px] transition-[background-color,color,box-shadow,transform] duration-(--duration-base) ease-soft active:scale-[0.97]",
        active
          ? "bg-card font-medium text-ink shadow-card"
          : "text-muted hover:bg-card/50 hover:text-ink",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full transition-transform duration-(--duration-base) ease-soft",
          active && "scale-125",
        )}
        style={{ background: dot }}
      />
      {label}
    </button>
  );
}
