"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Lightbulb } from "lucide-react";

import { captureIdea } from "@/lib/task-actions";
import { cn } from "@/lib/utils";

/**
 * One field, on the screen that is already open.
 *
 * "Don't lose the thought" is a different job from "plan the week", and the
 * Hunt Board's capture box can't do it: it is a screen away and it wants a
 * link. Ideas arrive while doing something else, on a phone, one-handed —
 * anything more than a sentence and a return key is enough to lose them.
 *
 * Deliberately without a project picker. Filing is a decision, and a decision
 * is the thing that stops this being instant; it lands on the Experiments
 * track, where "Next up" reads from, and gets filed later if it earns it.
 */
export function QuickCapture({ projectId }: { projectId?: string | null }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    if (!String(form.get("title") ?? "").trim()) return;

    startTransition(async () => {
      await captureIdea(form);
      element.reset();
      // Stay focused: ideas arrive in threes. The tick is the only feedback,
      // because a toast on a screen this dense is one thing too many.
      input.current?.focus();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    });
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex items-center gap-2.5 rounded-tile bg-inset px-3.5 py-2.5 transition-opacity duration-(--duration-quick)",
        pending && "opacity-45",
      )}
    >
      {projectId && <input type="hidden" name="projectId" value={projectId} />}

      <span className="grid size-5 shrink-0 place-items-center text-faint">
        {saved ? (
          <Check className="size-3.5 animate-pop text-accent" strokeWidth={3} />
        ) : (
          <Lightbulb className="size-3.5" strokeWidth={2} />
        )}
      </span>

      <input
        ref={input}
        name="title"
        placeholder="Note an idea…"
        aria-label="Note an idea"
        autoComplete="off"
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
      />

      <button
        type="submit"
        className="shrink-0 rounded-chip px-2.5 py-1 text-[12px] text-muted transition-colors duration-(--duration-quick) hover:text-accent"
      >
        Save
      </button>
    </form>
  );
}
