"use client";

import { useState, useTransition } from "react";
import { Flag, Pencil, Plus } from "lucide-react";

import { SprintPanel } from "@/components/sprint/sprint-panel";
import type { SprintView } from "@/components/sprint/types";
import { closeSprint } from "@/lib/sprint-actions";
import { cn } from "@/lib/utils";

/**
 * The one black tile on the Hunt Board (see the reference in `/assets`: black
 * is the second emphasis and gets used once per screen). It carries the answer
 * to "what did I commit to this week, and how far in am I" so that everything
 * below it can safely be the long list it has to be.
 */
export function SprintBar({
  sprint,
  suggestedName,
}: {
  sprint: SprintView | null;
  suggestedName: string;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!sprint) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="flex w-full animate-rise items-center gap-3 rounded-card bg-obsidian px-5 py-4 text-left text-white transition-transform duration-(--duration-base) ease-soft active:scale-[0.985]"
        >
          <Flag className="size-4 shrink-0 text-white/50" strokeWidth={1.8} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">No sprint running</p>
            <p className="mt-0.5 text-[12px] text-white/50">
              Pick the handful of tasks that are actually this week&apos;s work.
              Everything else stays on the board.
            </p>
          </div>
          <span className="shrink-0 rounded-chip bg-white px-3.5 py-2 text-[13px] font-medium text-ink">
            Start one
          </span>
        </button>

        {panelOpen && (
          <SprintPanel
            sprint={null}
            suggestedName={suggestedName}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </>
    );
  }

  const percent = sprint.total === 0 ? 0 : (sprint.done / sprint.total) * 100;
  const over = sprint.daysLeft < 0;

  return (
    <>
      <section
        className={cn(
          "animate-rise rounded-card bg-obsidian px-5 py-4 text-white transition-opacity duration-(--duration-base)",
          pending && "pointer-events-none opacity-45",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Flag className="size-4 shrink-0 text-white/50" strokeWidth={1.8} />
          <h2 className="text-[15px] font-semibold tracking-tight">
            {sprint.name}
          </h2>
          <span className="text-[12px] text-white/45">
            Day {sprint.dayNumber} of {sprint.totalDays}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
              over ? "bg-accent text-white" : "bg-white/10 text-white/70",
            )}
          >
            {over
              ? `${-sprint.daysLeft}d over`
              : sprint.daysLeft === 0
                ? "Ends today"
                : `${sprint.daysLeft}d left`}
          </span>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-chip px-2.5 py-1.5 text-[12px] text-white/60 transition-[background-color,color] duration-(--duration-quick) hover:bg-white/10 hover:text-white"
            >
              <Pencil className="size-3" strokeWidth={2} />
              Edit
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => closeSprint(sprint.id))}
              className="rounded-chip px-2.5 py-1.5 text-[12px] text-white/60 transition-[background-color,color] duration-(--duration-quick) hover:bg-white/10 hover:text-white"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="group flex items-center gap-1.5 rounded-chip bg-white px-3 py-1.5 text-[12px] font-medium text-ink transition-transform duration-(--duration-base) ease-soft active:scale-[0.97]"
            >
              <Plus
                className="size-3 transition-transform duration-(--duration-base) ease-soft group-hover:rotate-90"
                strokeWidth={2.4}
              />
              New sprint
            </button>
          </div>
        </div>

        {sprint.goal && (
          <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-white/70">
            {sprint.goal}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/12">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-(--duration-slow) ease-soft"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="shrink-0 text-[12px] tabular-nums text-white/60">
            {sprint.done}/{sprint.total} done
          </span>
        </div>
      </section>

      {(panelOpen || editing) && (
        <SprintPanel
          sprint={editing ? sprint : null}
          suggestedName={suggestedName}
          onClose={() => {
            setPanelOpen(false);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}
