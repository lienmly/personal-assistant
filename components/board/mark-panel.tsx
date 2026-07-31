"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Trash2, X } from "lucide-react";

import type { AreaView, BoardProjectView, MarkView } from "@/components/board/types";
import { deleteMark, saveMark } from "@/lib/mark-actions";
import { TRACKS } from "@/lib/tracks";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";
const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-faint";

export function MarkPanel({
  mark,
  projects,
  areas,
  defaults,
  onClose,
}: {
  mark: MarkView | null;
  projects: BoardProjectView[];
  areas: AreaView[];
  defaults?: { projectId?: string | null; track?: string | null };
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(
    mark?.projectId ?? defaults?.projectId ?? "",
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
        await saveMark(form);
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
            {mark ? "Edit mark" : "New mark"}
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
          <form id="mark-form" onSubmit={submit} className="space-y-4">
            {mark && <input type="hidden" name="id" value={mark.id} />}

            <div>
              <label className={labelCls} htmlFor="mark-title">
                What needs doing
              </label>
              <input
                id="mark-title"
                name="title"
                defaultValue={mark?.title ?? ""}
                placeholder="Ship the iOS build to TestFlight"
                autoFocus
                className={field}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="mark-project">
                  Project
                </label>
                <select
                  id="mark-project"
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
                <label className={labelCls} htmlFor="mark-track">
                  Track
                </label>
                <input
                  id="mark-track"
                  name="track"
                  list="mark-tracks"
                  defaultValue={mark?.track ?? defaults?.track ?? ""}
                  placeholder="Ship"
                  className={field}
                />
                <datalist id="mark-tracks">
                  {TRACKS.map((track) => (
                    <option key={track} value={track} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Only asked for when there's no project to inherit from — a mark
                with a project takes that project's area, so showing both would
                offer a choice the server is going to overrule. */}
            {!projectId && (
              <div>
                <label className={labelCls} htmlFor="mark-area">
                  Area
                </label>
                <select
                  id="mark-area"
                  name="areaId"
                  defaultValue={mark?.areaId ?? areas[0]?.id ?? ""}
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
                <label className={labelCls} htmlFor="mark-due">
                  Due
                </label>
                <input
                  id="mark-due"
                  type="date"
                  name="dueDate"
                  defaultValue={mark?.dueDate ?? ""}
                  className={field}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="mark-status">
                  Status
                </label>
                <select
                  id="mark-status"
                  name="status"
                  defaultValue={mark?.status ?? "open"}
                  className={field}
                >
                  <option value="open">Open</option>
                  <option value="doing">Doing</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="mark-link">
                Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="mark-link"
                  name="link"
                  type="url"
                  inputMode="url"
                  defaultValue={mark?.link ?? ""}
                  placeholder="https://tiktok.com/@…/video/…"
                  className={field}
                />
                {mark?.link && (
                  <a
                    href={mark.link}
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
              <label className={labelCls} htmlFor="mark-notes">
                Notes
              </label>
              <textarea
                id="mark-notes"
                name="notes"
                rows={4}
                defaultValue={mark?.notes ?? ""}
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

          {mark && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteMark(mark.id);
                  dismiss();
                })
              }
              className="group mt-6 flex items-center gap-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-accent"
            >
              <Trash2
                className="size-3.5 transition-transform duration-(--duration-base) ease-soft group-hover:-rotate-12"
                strokeWidth={1.8}
              />
              Delete this mark
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
            form="mark-form"
            disabled={pending}
            className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform,opacity] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save mark"}
          </button>
        </div>
      </div>
    </div>
  );
}
