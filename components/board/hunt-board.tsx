"use client";

import { useMemo, useState, useTransition } from "react";
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
        />
        {areas.map((area) => (
          <FilterChip
            key={area.id}
            active={areaFilter === area.id}
            onClick={() =>
              setAreaFilter(areaFilter === area.id ? null : area.id)
            }
            dot={area.color}
            label={area.name}
          />
        ))}

        <button
          type="button"
          onClick={() => setShowDone((value) => !value)}
          className={cn(
            "ml-auto rounded-chip px-3 py-2 text-[13px] transition-colors duration-(--duration-quick)",
            showDone ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink",
          )}
        >
          {showDone ? "Hide done" : "Show done"}
        </button>

        <button
          type="button"
          onClick={() => setPanel({ mode: "new", projectId: null, track: null })}
          className="flex items-center gap-1.5 rounded-chip bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
        >
          <Plus className="size-3.5" strokeWidth={2.4} />
          New mark
        </button>
      </div>

      <ExperimentCapture projectId={experimentProjectId} areaId={areas[0]?.id ?? ""} />

      <div className="mt-5 flex flex-col gap-4">
        {groups.map((group, index) => (
          <section
            key={group.key}
            style={{ animationDelay: `${index * 45}ms` }}
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
                className="w-full rounded-tile border border-dashed border-line py-4 text-[13px] text-faint transition-colors duration-(--duration-quick) hover:border-muted hover:text-muted"
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
                        className="text-faint transition-colors duration-(--duration-quick) hover:text-ink"
                      >
                        <Plus className="size-3" strokeWidth={2.4} />
                      </button>
                    </div>
                    <div className="flex flex-col">
                      {track.rows.map((mark) => (
                        <MarkRow
                          key={mark.id}
                          mark={mark}
                          onOpen={() => setPanel({ mode: "edit", mark })}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
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

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await captureExperiment(form);
        setLink("");
        setTitle("");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
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
            className="w-full rounded-chip bg-white/10 py-2 pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-white/35 focus:ring-2 focus:ring-white/25"
          />
        </div>
        <input
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What to try (optional)"
          className="rounded-chip bg-white/10 px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35 focus:ring-2 focus:ring-white/25 sm:w-[220px]"
        />
        <button
          type="submit"
          disabled={pending || link.trim() === ""}
          className="rounded-chip bg-white px-4 py-2 text-[13px] font-medium text-ink transition-[transform,opacity] duration-(--duration-base) ease-soft active:scale-[0.97] disabled:opacity-35"
        >
          {pending ? "Saving…" : "Capture"}
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] text-white/70">{error}</p>}
    </form>
  );
}

function MarkRow({ mark, onOpen }: { mark: MarkView; onOpen: () => void }) {
  const [pending, startTransition] = useTransition();
  const done = mark.status === "done";

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-tile px-2 py-2 transition-[background-color,opacity] duration-(--duration-base) ease-soft hover:bg-inset",
        pending && "pointer-events-none opacity-45",
      )}
    >
      <button
        type="button"
        disabled={pending}
        aria-label={done ? "Reopen this mark" : "Mark as done"}
        onClick={() =>
          startTransition(() => setMarkStatus(mark.id, done ? "open" : "done"))
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
            "truncate text-[13px] leading-snug",
            done ? "text-faint line-through" : "text-ink",
          )}
        >
          {mark.title}
        </p>
        {(mark.dueLabel || mark.notes) && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
            {mark.dueLabel && (
              <span className={cn(mark.overdue && !done && "font-medium text-accent")}>
                {mark.dueLabel}
              </span>
            )}
            {mark.dueLabel && mark.notes && <span>·</span>}
            {mark.notes && <span className="truncate">{mark.notes}</span>}
          </p>
        )}
      </button>

      {mark.status === "doing" && (
        <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-medium text-warn">
          doing
        </span>
      )}

      {mark.link && (
        <a
          href={mark.link}
          target="_blank"
          rel="noreferrer"
          aria-label="Open the linked post"
          className="shrink-0 text-faint transition-colors duration-(--duration-quick) hover:text-ink"
        >
          <ExternalLink className="size-3.5" strokeWidth={1.8} />
        </a>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  dot,
  label,
}: {
  active: boolean;
  onClick: () => void;
  dot: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-chip px-3 py-2 text-[13px] transition-[background-color,color,box-shadow,transform] duration-(--duration-base) ease-soft active:scale-[0.97]",
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
