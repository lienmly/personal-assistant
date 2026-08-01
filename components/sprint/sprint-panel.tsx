"use client";

import { useEffect, useState, useTransition } from "react";
import { X } from "lucide-react";

import type { SprintView } from "@/components/sprint/types";
import { startSprint } from "@/lib/sprint-actions";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";
const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-faint";

/** Today, and today + 6, as "YYYY-MM-DD" in the *local* calendar — the same
 *  rule as `todayKey`, and for the same reason. */
function localDay(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Start a sprint, or edit the running one.
 *
 * A week is the default length and the field is still editable: with a baby in
 * the house some weeks are three days long, and a sprint you can't shorten is
 * one you abandon rather than adjust.
 */
export function SprintPanel({
  sprint,
  suggestedName,
  onClose,
}: {
  /** The sprint being edited, or null to start a new one. */
  sprint: SprintView | null;
  /** "Week 3" — worked out from the count of sprints so far. */
  suggestedName: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
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
        await startSprint(form);
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
            {sprint ? "Edit sprint" : "Start a sprint"}
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
          <form id="sprint-form" onSubmit={submit} className="space-y-4">
            {sprint && <input type="hidden" name="id" value={sprint.id} />}

            <div>
              <label className={labelCls} htmlFor="sprint-name">
                Name
              </label>
              <input
                id="sprint-name"
                name="name"
                defaultValue={sprint?.name ?? suggestedName}
                autoFocus
                className={field}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="sprint-goal">
                What this week is for
              </label>
              <textarea
                id="sprint-goal"
                name="goal"
                rows={3}
                defaultValue={sprint?.goal ?? ""}
                placeholder="Get the Steam page live for wishlists."
                className={cn(field, "resize-y")}
              />
              <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
                One sentence. If it needs two, that&apos;s usually two sprints.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="sprint-start">
                  Starts
                </label>
                <input
                  id="sprint-start"
                  type="date"
                  name="startsOn"
                  defaultValue={sprint?.startsOn ?? localDay()}
                  className={field}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="sprint-end">
                  Ends
                </label>
                <input
                  id="sprint-end"
                  type="date"
                  name="endsOn"
                  defaultValue={sprint?.endsOn ?? localDay(6)}
                  className={field}
                />
              </div>
            </div>

            {!sprint && (
              <p className="rounded-tile bg-inset px-3 py-2.5 text-[12px] leading-relaxed text-muted">
                Starting a sprint closes the one that&apos;s running. Anything
                left unfinished in it goes back to the backlog — it isn&apos;t
                lost, and it doesn&apos;t follow you into the new week.
              </p>
            )}

            {error && (
              <p className="animate-rise rounded-chip bg-accent-soft px-3 py-2 text-[13px] text-accent">
                {error}
              </p>
            )}
          </form>
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
            form="sprint-form"
            disabled={pending}
            className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform,opacity] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
          >
            {pending ? "Saving…" : sprint ? "Save sprint" : "Start sprint"}
          </button>
        </div>
      </div>
    </div>
  );
}
