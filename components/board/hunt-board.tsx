"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, ExternalLink, Link2, Plus, Sparkles } from "lucide-react";

import { MarkPanel } from "@/components/board/mark-panel";
import type {
  AreaView,
  BoardProjectView,
  MarkView,
} from "@/components/board/types";
import { captureExperiment, setMarkStatus } from "@/lib/mark-actions";
import { trackRank } from "@/lib/tracks";
import { cn } from "@/lib/utils";

type PanelState =
  | { mode: "edit"; mark: MarkView }
  | { mode: "new"; projectId: string | null; track: string | null };

export function HuntBoard({
  marks,
  projects,
  areas,
  experimentProjectId,
}: {
  marks: MarkView[];
  projects: BoardProjectView[];
  areas: AreaView[];
  /** Where a pasted link lands by default — Utaitai, in practice. */
  experimentProjectId: string | null;
}) {
  const [areaFilter, setAreaFilter] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [panel, setPanel] = useState<PanelState | null>(null);

  const visible = useMemo(() => {
    return marks.filter(
      (mark) =>
        (areaFilter === null || mark.areaId === areaFilter) &&
        (showDone || mark.status !== "done"),
    );
  }, [marks, areaFilter, showDone]);

  /**
   * Project → track → marks. Two levels because a project like Utaitai runs
   * "ship the apps", "talk to users" and "marketing" concurrently, and a flat
   * dozen rows under one heading reads as noise.
   */
  const groups = useMemo(() => {
    const byProject = new Map<string, MarkView[]>();
    for (const mark of visible) {
      const key = mark.projectId ?? `area:${mark.areaId}`;
      const bucket = byProject.get(key);
      if (bucket) bucket.push(mark);
      else byProject.set(key, [mark]);
    }

    const headings = [
      ...projects.map((project) => ({
        key: project.id,
        title: project.name,
        color: project.area.color,
        subtitle: project.area.name,
        projectId: project.id as string | null,
      })),
      ...areas.map((area) => ({
        key: `area:${area.id}`,
        title: area.name,
        color: area.color,
        subtitle: "One-offs",
        projectId: null,
      })),
    ];

    return headings
      .map((heading) => {
        const rows = byProject.get(heading.key) ?? [];
        const tracks = new Map<string, MarkView[]>();
        for (const mark of rows) {
          const name = mark.track ?? "";
          const bucket = tracks.get(name);
          if (bucket) bucket.push(mark);
          else tracks.set(name, [mark]);
        }
        return {
          ...heading,
          openCount: rows.filter((mark) => mark.status !== "done").length,
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
      .filter((group) => group.projectId !== null || group.tracks.length > 0);
  }, [visible, projects, areas]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FilterChip
          active={areaFilter === null}
          onClick={() => setAreaFilter(null)}
          dot="#14110f"
          label="All areas"
          delay={0}
        />
        {areas.map((area, index) => (
          <FilterChip
            key={area.id}
            active={areaFilter === area.id}
            onClick={() =>
              setAreaFilter(areaFilter === area.id ? null : area.id)
            }
            dot={area.color}
            label={area.name}
            delay={(index + 1) * 35}
          />
        ))}

        <button
          type="button"
          onClick={() => setShowDone((value) => !value)}
          style={{ animationDelay: `${(areas.length + 1) * 35}ms` }}
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
          style={{ animationDelay: `${(areas.length + 2) * 35}ms` }}
          className="group flex animate-rise items-center gap-1.5 rounded-chip bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
        >
          <Plus
            className="size-3.5 transition-transform duration-(--duration-base) ease-soft group-hover:rotate-90"
            strokeWidth={2.4}
          />
          New mark
        </button>
      </div>

      <ExperimentCapture projectId={experimentProjectId} areaId={areas[0]?.id ?? ""} />

      <div className="mt-5 flex flex-col gap-4">
        {groups.map((group, index) => {
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
            <div className="mb-4 flex items-center gap-2.5">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: group.color }}
              />
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                {group.title}
              </h2>
              <span className="text-[12px] text-faint">{group.subtitle}</span>
              <span className="ml-auto rounded-full bg-inset px-2.5 py-1 text-xs font-medium text-muted">
                {group.openCount} open
              </span>
            </div>

            {group.tracks.length === 0 ? (
              <button
                type="button"
                onClick={() =>
                  setPanel({
                    mode: "new",
                    projectId: group.projectId,
                    track: null,
                  })
                }
                className="w-full rounded-tile border border-dashed border-line py-4 text-[13px] text-faint transition-[border-color,color,transform] duration-(--duration-base) ease-soft hover:border-muted hover:text-muted active:scale-[0.985]"
              >
                Nothing on this project yet — add the first mark
              </button>
            ) : (
              <div className="flex flex-col gap-4">
                {group.tracks.map((track) => (
                  <div key={track.name}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                        {track.name || "Unfiled"}
                      </h3>
                      <button
                        type="button"
                        aria-label={`Add a mark to ${track.name || "this project"}`}
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
                      {track.rows.map((mark) => (
                        <MarkRow
                          key={mark.id}
                          mark={mark}
                          delay={60 + Math.min(rowIndex++, 8) * 28}
                          collapseOnDone={!showDone}
                          onOpen={() => setPanel({ mode: "edit", mark })}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          );
        })}
      </div>

      {panel && (
        <MarkPanel
          mark={panel.mode === "edit" ? panel.mark : null}
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
 * Paste a link, get a mark. This exists because the moment you find a format
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

  // The captured mark lands in a card further down the page, which is easy to
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
      className="animate-rise rounded-card bg-obsidian p-4 text-white"
    >
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      {!projectId && <input type="hidden" name="areaId" value={areaId} />}

      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-3.5 text-white/50" strokeWidth={1.8} />
        <h2 className="text-[13px] font-medium">Saw a format worth stealing?</h2>
        <span className="text-[12px] text-white/40">
          Paste the link — it lands under Experiments
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-white/35" />
          <input
            name="link"
            type="url"
            inputMode="url"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://tiktok.com/@…/video/…"
            className="w-full rounded-chip bg-white/10 py-2 pl-9 pr-3 text-[13px] text-white outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-white/35 hover:bg-white/[0.14] focus:bg-white/[0.14] focus:ring-2 focus:ring-white/25"
          />
        </div>
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What to try (optional)"
          className="rounded-chip bg-white/10 px-3 py-2 text-[13px] text-white outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-white/35 hover:bg-white/[0.14] focus:bg-white/[0.14] focus:ring-2 focus:ring-white/25 sm:w-[220px]"
        />
        <button
          type="submit"
          disabled={pending || link.trim() === ""}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-chip bg-white px-4 py-2 text-[13px] font-medium transition-[color,transform,opacity] duration-(--duration-base) ease-soft active:scale-[0.97] disabled:opacity-35",
            saved ? "text-good" : "text-ink",
          )}
        >
          {saved && <Check className="size-3.5" strokeWidth={3} />}
          {saved ? "Captured" : pending ? "Saving…" : "Capture"}
        </button>
      </div>

      {error && (
        <p className="mt-2 animate-rise text-[12px] text-white/70">{error}</p>
      )}
    </form>
  );
}

function MarkRow({
  mark,
  onOpen,
  delay,
  collapseOnDone,
}: {
  mark: MarkView;
  onOpen: () => void;
  delay: number;
  /** True when "show done" is off, so ticking this row will remove it. */
  collapseOnDone: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const done = mark.status === "done";

  // The row folds away while the tick is in flight, because the server
  // round-trip is what unmounts it and an un-animated disappearance is the
  // jankiest thing on the board. Derived from `pending` rather than held in
  // state, so a failed action simply unfolds it again instead of leaving a
  // blank gap where the row was.
  const leaving = pending && collapseOnDone && !done;

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
            pending && "pointer-events-none opacity-45",
          )}
        >
          <button
            type="button"
            disabled={pending}
            aria-label={done ? "Reopen this mark" : "Mark as done"}
            onClick={() =>
              startTransition(() =>
                setMarkStatus(mark.id, done ? "open" : "done"),
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
              {mark.title}
            </p>
            {(mark.dueLabel || mark.notes) && (
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
                {mark.dueLabel && (
                  <span
                    className={cn(mark.overdue && !done && "font-medium text-accent")}
                  >
                    {mark.dueLabel}
                  </span>
                )}
                {mark.dueLabel && mark.notes && <span>·</span>}
                {mark.notes && <span className="truncate">{mark.notes}</span>}
              </p>
            )}
          </button>

          {mark.status === "doing" && (
            <span className="shrink-0 animate-rise rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-medium text-warn">
              doing
            </span>
          )}

          {mark.link && (
            <a
              href={mark.link}
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
