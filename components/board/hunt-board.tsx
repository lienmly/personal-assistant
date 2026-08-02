"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronRight,
  ExternalLink,
  Link2,
  Minus,
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
import { SprintBar } from "@/components/sprint/sprint-bar";
import type { SprintView } from "@/components/sprint/types";
import { captureExperiment, setTaskStatus } from "@/lib/task-actions";
import { setTaskSprint } from "@/lib/sprint-actions";
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
  sprint,
  suggestedSprintName,
  experimentProjectId,
}: {
  tasks: TaskView[];
  projects: BoardProjectView[];
  areas: AreaView[];
  sprint: SprintView | null;
  suggestedSprintName: string;
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

  const inSprint = useMemo(
    () =>
      sprint === null
        ? []
        : tasks.filter(
            (task) =>
              task.sprintId === sprint.id &&
              (showDone || task.status !== "done"),
          ),
    [tasks, sprint, showDone],
  );

  /** The backlog: everything the sprint hasn't claimed, after the filters. */
  const visible = useMemo(() => {
    const mainProjects = new Set(
      projects.filter((p) => p.priority === "main").map((p) => p.id),
    );
    return tasks.filter(
      (task) =>
        !(sprint !== null && task.sprintId === sprint.id) &&
        (areaFilter === null || task.areaId === areaFilter) &&
        (showDone || task.status !== "done") &&
        (scope === "all" ||
          (task.projectId !== null && mainProjects.has(task.projectId))),
    );
  }, [tasks, projects, sprint, areaFilter, showDone, scope]);

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
      <SprintBar sprint={sprint} suggestedName={suggestedSprintName} />

      {sprint && (
        <section
          style={{ animationDelay: "60ms" }}
          className="mt-4 animate-rise rounded-card bg-card p-5 shadow-card"
        >
          <div className="mb-4 flex items-center gap-2.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">
              In the sprint
            </h2>
            <span className="text-[12px] text-faint">
              This week&apos;s commitment
            </span>
            <span className="ml-auto rounded-full bg-inset px-2.5 py-1 text-xs font-medium text-muted">
              {inSprint.filter((task) => task.status !== "done").length} open
            </span>
          </div>

          {inSprint.length === 0 ? (
            <p className="rounded-tile border border-dashed border-line py-4 text-center text-[13px] text-faint">
              Nothing committed yet — use the + on any task below.
            </p>
          ) : (
            <div className="flex flex-col">
              {inSprint.map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  delay={60 + Math.min(index, 8) * 28}
                  collapseOnDone={!showDone}
                  sprintId={sprint.id}
                  committed
                  onOpen={() => setPanel({ mode: "edit", task })}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="mt-5 mb-4 flex flex-wrap items-center gap-2">
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
                    {group.openCount === 0
                      ? "Nothing left on this project — add the next task"
                      : "Everything here is in the sprint"}
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
                              sprintId={sprint?.id ?? null}
                              committed={false}
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
          sprint={sprint}
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
  sprintId,
  committed,
}: {
  task: TaskView;
  onOpen: () => void;
  delay: number;
  /** True when "show done" is off, so ticking this row will remove it. */
  collapseOnDone: boolean;
  /** The running sprint, or null — the +/− button hides without one. */
  sprintId: string | null;
  /** True in the sprint section, where the button removes rather than adds. */
  committed: boolean;
}) {
  // Two transitions: ticking done folds the row away, moving it in or out of
  // the sprint moves it to another card. Both remove the row, but only the
  // first should collapse in place — see CLAUDE.md §10.
  const [pending, startTransition] = useTransition();
  const [moving, startMove] = useTransition();
  const done = task.status === "done";
  const busy = pending || moving;
  const repeat = repeatLabel(task);

  // The row folds away while the tick is in flight, because the server
  // round-trip is what unmounts it and an un-animated disappearance is the
  // jankiest thing on the board. Derived from `pending` rather than held in
  // state, so a failed action simply unfolds it again instead of leaving a
  // blank gap where the row was.
  const leaving = (pending && collapseOnDone && !done) || moving;

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
                    <span className="flex items-center gap-1 text-muted">
                      <Repeat className="size-3" strokeWidth={2.2} />
                      {repeat}
                    </span>
                    {(task.dueLabel || task.notes) && <span>·</span>}
                  </>
                )}
                {task.dueLabel && (
                  <span
                    className={cn(task.overdue && !done && "font-medium text-accent")}
                  >
                    {task.dueLabel}
                  </span>
                )}
                {task.dueLabel && task.notes && <span>·</span>}
                {task.notes && <span className="truncate">{task.notes}</span>}
              </p>
            )}
          </button>

          {task.status === "doing" && (
            <span className="shrink-0 animate-rise rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-medium text-warn">
              doing
            </span>
          )}

          {/* Sprint planning is this one button. Shown outright on touch and on
              hover on a pointer device — a hover-only control doesn't exist on
              the phone, which is where planning actually happens. */}
          {sprintId && !done && (
            <button
              type="button"
              disabled={busy}
              aria-label={
                committed ? "Take out of the sprint" : "Add to the sprint"
              }
              title={committed ? "Take out of the sprint" : "Add to the sprint"}
              onClick={() =>
                startMove(() =>
                  setTaskSprint(task.id, committed ? null : sprintId),
                )
              }
              className="shrink-0 rounded-full bg-inset p-1 text-muted transition-[opacity,background-color,color] duration-(--duration-quick) hover:bg-line hover:text-ink focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              {committed ? (
                <Minus className="size-3" strokeWidth={2.4} />
              ) : (
                <Plus className="size-3" strokeWidth={2.4} />
              )}
            </button>
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
