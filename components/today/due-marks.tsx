"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";

import type { DueMarkView } from "@/components/today/types";
import { setMarkStatus } from "@/lib/mark-actions";
import { cn } from "@/lib/utils";

/**
 * Section 1 of Today. Ticking here is the whole interaction — if finishing a
 * task required opening the Hunt Board first, this screen would be a report
 * rather than somewhere you get things done.
 */
export function DueMarks({
  marks,
  total,
}: {
  marks: DueMarkView[];
  total: number;
}) {
  return (
    <>
      <div className="flex flex-col">
        {marks.map((mark) => (
          <Row key={mark.id} mark={mark} />
        ))}
      </div>

      {total > marks.length && (
        <Link
          href="/board"
          className="mt-3 inline-block text-[12px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
        >
          {total - marks.length} more on the Hunt Board →
        </Link>
      )}
    </>
  );
}

function Row({ mark }: { mark: DueMarkView }) {
  const [pending, startTransition] = useTransition();

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
        aria-label="Mark as done"
        onClick={() => startTransition(() => setMarkStatus(mark.id, "done"))}
        className="grid size-5 shrink-0 place-items-center rounded-full bg-inset text-transparent transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:bg-good hover:text-white active:scale-90"
      >
        <Check className="size-3" strokeWidth={3} />
      </button>

      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: mark.areaColor }}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] leading-snug text-ink">{mark.title}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
          <span className={cn(mark.overdue && "font-medium text-accent")}>
            {mark.dueLabel}
          </span>
          {mark.projectName && (
            <>
              <span>·</span>
              <span className="truncate">{mark.projectName}</span>
            </>
          )}
          {mark.track && (
            <>
              <span>·</span>
              <span>{mark.track}</span>
            </>
          )}
        </p>
      </div>

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
