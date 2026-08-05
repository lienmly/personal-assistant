"use client";

import { useState } from "react";
import { Check, ChevronRight } from "lucide-react";

import type { SubtaskView } from "@/components/board/types";
import { cn } from "@/lib/utils";

/**
 * The checklist under a task: the several places one job actually gets done.
 *
 * Presentational on purpose — it does not call the server itself, it calls
 * `onTick` and lets the row above decide what that means. The row is the only
 * thing that knows whether ticking the last box will make it disappear (a
 * one-off finishes; a recurring one re-arms for tomorrow and stays), and
 * CLAUDE.md §10 requires a row a server action removes to fold out rather than
 * blink. Owning the transition here would have put that knowledge in the wrong
 * component and animated the wrong thing.
 *
 * Collapsed by default and opened by its own count. On a planning surface the
 * unit is the job, and four projects' worth of expanded checklists is the
 * "board dumps everything on my face" problem one level down; on Today, where
 * you are there to *tick*, the caller passes `defaultOpen`.
 *
 * Indentation follows the reference's sidebar tree (§9): a hairline rule, muted
 * text a size down, nothing bordered or boxed. A checklist is part of the row
 * above it, and drawing it as its own card would say otherwise.
 */
export function Checklist({
  subtasks,
  onTick,
  defaultOpen = false,
  busy = false,
}: {
  subtasks: SubtaskView[];
  /** `done` is the state being moved *to*. */
  onTick: (subtaskId: string, done: boolean) => void;
  defaultOpen?: boolean;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (subtasks.length === 0) return null;

  const doneCount = subtasks.filter((task) => task.status === "done").length;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex items-center gap-1 rounded-full bg-inset py-0.5 pl-1 pr-2 text-[10.5px] font-medium text-muted transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:text-ink active:scale-[0.97]"
      >
        <ChevronRight
          className={cn(
            "size-3 transition-transform duration-(--duration-base) ease-soft",
            open && "rotate-90",
          )}
          strokeWidth={2.4}
        />
        {doneCount}/{subtasks.length}
      </button>

      {open && (
        <ul
          className={cn(
            "ml-1.5 mt-1 flex flex-col border-l border-line pl-3",
            busy && "pointer-events-none opacity-45",
          )}
        >
          {subtasks.map((subtask, index) => {
            const done = subtask.status === "done";
            return (
              <li
                key={subtask.id}
                style={{ animationDelay: `${index * 30}ms` }}
                className="flex animate-rise items-center gap-2 py-1"
              >
                <button
                  type="button"
                  disabled={busy}
                  aria-label={
                    done
                      ? `Undo "${subtask.title}"`
                      : `Mark "${subtask.title}" as done`
                  }
                  onClick={() => onTick(subtask.id, !done)}
                  className={cn(
                    "grid size-4 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-90",
                    done
                      ? "bg-good text-white"
                      : "bg-line/70 text-transparent hover:bg-line hover:text-muted",
                  )}
                >
                  <Check
                    key={done ? "done" : "todo"}
                    className={cn("size-2.5", done && "animate-pop")}
                    strokeWidth={3.4}
                  />
                </button>
                <span
                  className={cn(
                    "truncate text-[12px] leading-snug transition-colors duration-(--duration-base) ease-soft",
                    done ? "text-faint line-through" : "text-muted",
                  )}
                >
                  {subtask.title}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Would ticking `subtaskId` empty the checklist?
 *
 * The rows use it to decide whether to fold themselves away, because the tick
 * that clears the last box completes the parent (`completeParentIfFinished`)
 * and the parent is what leaves the list.
 */
export function ticksTheLastBox(
  subtasks: SubtaskView[],
  subtaskId: string,
): boolean {
  return subtasks.every(
    (task) => task.status === "done" || task.id === subtaskId,
  );
}
