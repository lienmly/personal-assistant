"use client";

import { useState, useTransition } from "react";
import { Check, Sparkles } from "lucide-react";

import { addTasksToSprint } from "@/lib/sprint-actions";
import { cn } from "@/lib/utils";

export type SuggestionView = {
  id: string;
  title: string;
  track: string | null;
  projectName: string | null;
  dueLabel: string | null;
  overdue: boolean;
  color: string;
};

/**
 * The banner on an empty sprint.
 *
 * A sprint that rolls over automatically arrives empty, and an empty sprint
 * with a "go and plan it" link is just the Hunt Board's blank page moved one
 * screen earlier — which is the thing the sprint exists to avoid. So the
 * suggestion is already made and already ticked; the interaction is *removing*
 * the two you don't want and pressing one button, which is a thing that can be
 * done at 7am.
 */
export function SprintPlanner({
  sprintId,
  sprintName,
  suggestions,
  rollover,
}: {
  sprintId: string;
  sprintName: string;
  suggestions: SuggestionView[];
  /** What happened to last week, when this sprint replaced one. */
  rollover: { closedName: string; carried: number; done: number } | null;
}) {
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(suggestions.map((task) => task.id)),
  );
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div
      className={cn(
        "animate-rise rounded-tile bg-inset p-4",
        pending && "pointer-events-none opacity-45",
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        <Sparkles className="size-3.5 text-accent" strokeWidth={2} />
        <p className="text-[13px] font-medium text-ink">
          {sprintName} is empty
        </p>
      </div>

      <p className="mb-3 text-[12.5px] leading-relaxed text-muted">
        {rollover
          ? `${rollover.closedName} closed with ${rollover.done} done. ${
              rollover.carried === 0
                ? "Nothing was left over."
                : `${rollover.carried} unfinished went back to the backlog — this week starts clean on purpose.`
            }`
          : "Pick this week's few and Today becomes the only list you need to read."}
      </p>

      {suggestions.length > 0 ? (
        <>
          <div className="mb-3 flex flex-col gap-1.5">
            {suggestions.map((task) => {
              const on = chosen.has(task.id);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => toggle(task.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-tile px-3 py-2 text-left transition-[background-color,opacity] duration-(--duration-quick) active:scale-[0.985]",
                    on ? "bg-card shadow-card" : "bg-transparent opacity-55",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-4.5 shrink-0 place-items-center rounded-full transition-colors duration-(--duration-base)",
                      on ? "bg-accent text-white" : "bg-card text-transparent",
                    )}
                  >
                    <Check className="size-2.5" strokeWidth={3.2} />
                  </span>

                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {task.title}
                  </span>

                  {task.projectName && (
                    <span className="hidden shrink-0 items-center gap-1.5 text-[11.5px] text-faint sm:flex">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ background: task.color }}
                      />
                      {task.projectName}
                    </span>
                  )}

                  {task.dueLabel && (
                    <span
                      className={cn(
                        "shrink-0 text-[11.5px]",
                        task.overdue ? "font-medium text-accent" : "text-faint",
                      )}
                    >
                      {task.dueLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={chosen.size === 0}
            onClick={() =>
              startTransition(() => addTasksToSprint([...chosen], sprintId))
            }
            className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97] disabled:opacity-40"
          >
            {pending
              ? "Committing…"
              : `Commit ${chosen.size} to ${sprintName}`}
          </button>
        </>
      ) : (
        <p className="text-[12.5px] text-faint">
          Nothing in the backlog to suggest. Add something on the Hunt Board.
        </p>
      )}
    </div>
  );
}
