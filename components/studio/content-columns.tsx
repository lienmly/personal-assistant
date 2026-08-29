"use client";

import { useTransition } from "react";
import { ChevronRight, Plus } from "lucide-react";

import type { ContentView } from "@/components/studio/types";
import { FORMATS, STAGES } from "@/lib/platforms";
import { moveContentItem } from "@/lib/studio-actions";
import { cn } from "@/lib/utils";

/**
 * The pipeline, as five columns.
 *
 * Extracted out of `StudioBoard` on 2026-08-28 so a project page could show its
 * own social media content the same way. Two copies of a kanban is how the two
 * come to disagree about what a stage is called and which way the arrow moves —
 * the same argument `groupByTrack` is shared for on the Tasks tab.
 *
 * **A card no longer wears its channels.** Every card used to carry a row of
 * platform lettermarks, so the board read as a wall of TT/IG/YT before it read
 * as a list of things worth saying — and where a piece goes is the *last*
 * decision about it, not the first. The destination is a field inside the item
 * now (see `ContentPanel`), and all a card keeps of the fan-out is the one fact
 * it can add here: how much of it has actually gone out.
 */
export function ContentColumns({
  items,
  onOpen,
  onNew,
}: {
  items: ContentView[];
  onOpen: (item: ContentView) => void;
  /** Omitted where the surface has no "new item" of its own to offer. */
  onNew?: () => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
      <div className="flex min-w-max gap-4">
        {STAGES.map((stage, stageIndex) => {
          const column = items.filter((item) => item.stage === stage.id);
          return (
            <div
              key={stage.id}
              /* Columns arrive left to right, so the board reads as a
                 pipeline rather than five things appearing at once. */
              style={{ animationDelay: `${stageIndex * 45}ms` }}
              className="flex w-[248px] animate-rise flex-col rounded-card bg-card p-3.5 shadow-card"
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <div>
                  <span className="text-[13px] font-semibold tracking-tight text-ink">
                    {stage.label}
                  </span>
                  <p className="text-[11px] text-faint">{stage.hint}</p>
                </div>
                <span className="rounded-full bg-inset px-2 py-0.5 text-[11px] font-medium text-muted">
                  {column.length}
                </span>
              </div>

              <div className="flex min-h-[180px] flex-1 flex-col gap-2">
                {column.map((item, cardIndex) => (
                  <ContentCard
                    key={item.id}
                    item={item}
                    /* Cards are keyed on id, so this replays whenever a card
                       genuinely mounts — filtering by brand, or arriving in a
                       new column after a stage move — and not on re-render. */
                    delayMs={stageIndex * 45 + cardIndex * 35}
                    onOpen={() => onOpen(item)}
                  />
                ))}

                {column.length === 0 &&
                  (onNew ? (
                    <button
                      type="button"
                      onClick={onNew}
                      className="flex flex-1 animate-rise items-center justify-center rounded-tile border border-dashed border-line text-faint transition-colors duration-(--duration-quick) hover:border-muted hover:text-muted"
                    >
                      <Plus className="size-4" strokeWidth={2} />
                    </button>
                  ) : (
                    <div className="flex-1 rounded-tile border border-dashed border-line" />
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContentCard({
  item,
  delayMs,
  onOpen,
}: {
  item: ContentView;
  delayMs: number;
  onOpen: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const stageIndex = STAGES.findIndex((stage) => stage.id === item.stage);
  const next = STAGES[stageIndex + 1];
  const untitled = item.title.trim() === "";
  const postedCount = item.channels.filter(
    (row) => row.state === "published",
  ).length;

  return (
    <div
      style={{ animationDelay: `${delayMs}ms` }}
      className={cn(
        "group animate-rise rounded-tile bg-inset p-3 text-left transition-[background-color,box-shadow,transform] duration-(--duration-base) ease-soft",
        // A 1px lift and the barely-there shadow — same trick the reference uses
        // for depth. Anything larger reads as a different design.
        "hover:-translate-y-px hover:bg-card hover:shadow-card",
        untitled && "border border-dashed border-line bg-transparent",
        // While the stage move is in flight the card recedes rather than
        // freezing, so the wait feels like progress.
        pending && "pointer-events-none -translate-y-px opacity-45",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left transition-transform duration-(--duration-quick) ease-soft active:scale-[0.985]"
      >
        <div className="mb-1.5 flex items-center gap-1.5">
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: item.brand.color }}
          />
          <span className="truncate text-[11px] font-medium text-muted">
            {item.brand.name}
          </span>
          {item.sourceItemId && (
            <span
              title="Repurposed from another piece"
              className="text-[11px] text-faint"
            >
              &#8629;
            </span>
          )}
        </div>

        <p
          className={cn(
            "text-[13px] font-medium leading-snug",
            untitled ? "text-faint" : "text-ink",
          )}
        >
          {untitled
            ? item.series
              ? `${item.series.name} — empty slot`
              : "Untitled"
            : item.title}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-faint">
          <span>{FORMATS[item.format].label}</span>
          {item.project && (
            <>
              <span>·</span>
              <span className="truncate">{item.project.name}</span>
            </>
          )}
          {item.publishLabel && (
            <>
              <span>·</span>
              <span className={cn(item.isToday && "font-medium text-accent")}>
                {item.isToday ? "Today" : item.publishLabel}
              </span>
            </>
          )}
          {/* The one thing the fan-out is still worth saying on a card: how
              much of it has gone out. *Which* accounts is a question you ask
              inside the item, on the day you post it. */}
          {postedCount > 0 && postedCount < item.channels.length && (
            <>
              <span>·</span>
              <span>
                {postedCount}/{item.channels.length} posted
              </span>
            </>
          )}
        </div>
      </button>

      {next && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => moveContentItem(item.id, next.id))}
          className="group/next mt-2 flex w-full items-center justify-center gap-1 rounded-chip py-1 text-[11px] text-faint opacity-0 transition-[opacity,background-color,color] duration-(--duration-base) ease-soft hover:bg-inset hover:text-ink group-hover:opacity-100 disabled:opacity-40 max-md:opacity-100"
        >
          {next.label}
          {/* The arrow nudges toward the column the card is about to land in. */}
          <ChevronRight
            className="size-3 transition-transform duration-(--duration-base) ease-soft group-hover/next:translate-x-0.5"
            strokeWidth={2.4}
          />
        </button>
      )}
    </div>
  );
}
