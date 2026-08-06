"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash2, X } from "lucide-react";

import type { AreaOption, ProjectEditView } from "@/components/projects/types";
import { deleteProject, saveProject } from "@/lib/project-actions";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";
const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-faint";

/** The second axis (CLAUDE.md §6). Each option carries the sentence that says
 *  what picking it actually changes — "side" vs "later" is meaningless
 *  otherwise, and a tier you can't tell apart is a tier you set at random. */
const PRIORITIES = [
  { value: "main", label: "Main", hint: "Opens expanded on the board, and leads on Today." },
  { value: "side", label: "Side", hint: "Real, but nothing new goes in right now." },
  { value: "later", label: "Later", hint: "Parked. Kept off the planning surfaces entirely." },
] as const;

const STATUSES = [
  { value: "active", label: "Active — moving" },
  { value: "simmering", label: "Simmering — deliberately quiet" },
  { value: "paused", label: "Paused — stopped on purpose" },
  { value: "archived", label: "Archived — done with" },
] as const;

export function ProjectPanel({
  project,
  areas,
  onClose,
}: {
  /** null opens the panel empty, as "New project". */
  project: ProjectEditView | null;
  areas: AreaOption[];
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [priority, setPriority] = useState<string>(project?.priority ?? "side");
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
        await saveProject(form);
        dismiss();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save");
      }
    });
  }

  const chosen = PRIORITIES.find((option) => option.value === priority);

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
            {project ? "Edit project" : "New project"}
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
          <form id="project-form" onSubmit={submit} className="space-y-4">
            {project && <input type="hidden" name="id" value={project.id} />}

            <div>
              <label className={labelCls} htmlFor="project-name">
                Name
              </label>
              <input
                id="project-name"
                name="name"
                defaultValue={project?.name ?? ""}
                placeholder="Sleepy Cat"
                autoFocus
                className={field}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="project-area">
                Area
              </label>
              <select
                id="project-area"
                name="areaId"
                defaultValue={project?.areaId ?? areas[0]?.id ?? ""}
                className={field}
              >
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
              {project && (
                <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
                  Moving this takes its tasks with it — they carry the area too.
                </p>
              )}
            </div>

            <div>
              <label className={labelCls} htmlFor="project-description">
                What it is
              </label>
              <textarea
                id="project-description"
                name="description"
                rows={3}
                defaultValue={project?.description ?? ""}
                placeholder="A cosy cat game, headed for a Steam release."
                className={cn(field, "resize-y")}
              />
            </div>

            {/* Sits directly under "what it is" because the two are read as a
                pair, and separating them is what makes people write the wrong
                thing in the wrong box. This is the line Today leads with. */}
            <div>
              <label className={labelCls} htmlFor="project-focus">
                What it’s aiming at right now
              </label>
              <textarea
                id="project-focus"
                name="focus"
                rows={2}
                defaultValue={project?.focus ?? ""}
                placeholder="Get the Steam page live so wishlists can start."
                className={cn(field, "resize-y")}
              />
              <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
                One sentence, rewritten whenever it stops being true. Today
                shows this above the project’s tasks.
              </p>
            </div>

            <div>
              <span className={labelCls}>How much of you it gets</span>
              <input type="hidden" name="priority" value={priority} />
              <div className="flex items-center gap-1 rounded-full bg-inset p-1">
                {PRIORITIES.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPriority(option.value)}
                    className={cn(
                      "flex-1 rounded-full px-3 py-1.5 text-[13px] transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-[0.97]",
                      priority === option.value
                        ? "bg-obsidian font-medium text-white"
                        : "text-muted hover:text-ink",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {chosen && (
                <p
                  key={chosen.value}
                  className="mt-1.5 animate-rise text-[12px] leading-relaxed text-faint"
                >
                  {chosen.hint}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="project-status">
                  Status
                </label>
                <select
                  id="project-status"
                  name="status"
                  defaultValue={project?.status ?? "active"}
                  className={field}
                >
                  {STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls} htmlFor="project-cadence">
                  Cadence
                </label>
                <input
                  id="project-cadence"
                  name="cadenceDays"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  defaultValue={project?.cadenceDays ?? ""}
                  placeholder="days"
                  className={field}
                />
              </div>
            </div>

            <p className="text-[12px] leading-relaxed text-faint">
              Cadence is the gap after which a quiet project starts warning you
              on Today. Leave it blank and it never will — which is the honest
              setting for something with no rhythm to be behind on.
            </p>

            {error && (
              <p className="animate-rise rounded-chip bg-accent-soft px-3 py-2 text-[13px] leading-relaxed text-accent">
                {error}
              </p>
            )}
          </form>

          {project && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  try {
                    await deleteProject(project.id);
                    dismiss();
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not delete",
                    );
                  }
                });
              }}
              className="group mt-6 flex items-center gap-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-accent"
            >
              <Trash2
                className="size-3.5 transition-transform duration-(--duration-base) ease-soft group-hover:-rotate-12"
                strokeWidth={1.8}
              />
              Delete this project
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
            form="project-form"
            disabled={pending}
            className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform,opacity] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save project"}
          </button>
        </div>
      </div>
    </div>
  );
}
