"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronRight, Plus } from "lucide-react";

import { ChannelBadge } from "@/components/studio/channel-badge";
import { DailyQueue } from "@/components/studio/daily-queue";
import { ContentPanel } from "@/components/studio/content-panel";
import type {
  BrandView,
  ContentView,
  ProjectView,
} from "@/components/studio/types";
import { FORMATS, STAGES } from "@/lib/platforms";
import { moveContentItem } from "@/lib/studio-actions";
import { cn } from "@/lib/utils";

export function StudioBoard({
  items,
  brands,
  projects,
  todayKey,
}: {
  items: ContentView[];
  brands: BrandView[];
  projects: ProjectView[];
  todayKey: string;
}) {
  const [brandFilter, setBrandFilter] = useState<string | null>(null);
  const [panel, setPanel] = useState<
    { mode: "new" } | { mode: "edit"; item: ContentView } | null
  >(null);

  const visible = useMemo(
    () =>
      brandFilter ? items.filter((d) => d.brand.id === brandFilter) : items,
    [items, brandFilter],
  );

  // Series slots are the daily cadence; they live in the queue strip above.
  // Leaving them in the columns would mean ~28 identical empty cards drowning
  // the handful of items that were actually thought up.
  const queued = visible.filter((item) => item.slotDate !== null);
  const board = visible.filter((item) => item.slotDate === null);

  const goingOutToday = visible.filter(
    (d) => d.isToday && d.stage !== "published",
  ).length;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <FilterChip
          active={brandFilter === null}
          onClick={() => setBrandFilter(null)}
          // "All brands" has no brand colour of its own, so it borrows the
          // text colour — as a token rather than a hex, or it stays near-black
          // on a near-black card in the dark theme.
          dot="var(--color-ink)"
          label="All brands"
        />
        {brands.map((brand) => (
          <FilterChip
            key={brand.id}
            active={brandFilter === brand.id}
            onClick={() =>
              setBrandFilter(brandFilter === brand.id ? null : brand.id)
            }
            dot={brand.color}
            label={brand.name}
          />
        ))}

        <button
          type="button"
          onClick={() => setPanel({ mode: "new" })}
          className="ml-auto flex items-center gap-1.5 rounded-chip bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
        >
          <Plus className="size-3.5" strokeWidth={2.4} />
          New item
        </button>
      </div>

      {goingOutToday > 0 && (
        <p className="mb-4 inline-flex animate-rise items-center gap-2 rounded-chip bg-accent-soft px-3 py-1.5 text-[13px] text-accent">
          <span className="size-1.5 rounded-full bg-accent" />
          {goingOutToday} going out today
        </p>
      )}

      <DailyQueue
        items={queued}
        todayKey={todayKey}
        onOpen={(item) => setPanel({ mode: "edit", item })}
      />

      <div className="-mx-4 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
        <div className="flex min-w-max gap-4">
          {STAGES.map((stage, stageIndex) => {
            const column = board.filter((item) => item.stage === stage.id);
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
                      onOpen={() => setPanel({ mode: "edit", item })}
                    />
                  ))}

                  {column.length === 0 && (
                    <button
                      type="button"
                      onClick={() => setPanel({ mode: "new" })}
                      className="flex flex-1 animate-rise items-center justify-center rounded-tile border border-dashed border-line text-faint transition-colors duration-(--duration-quick) hover:border-muted hover:text-muted"
                    >
                      <Plus className="size-4" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {panel && (
        <ContentPanel
          item={panel.mode === "edit" ? panel.item : null}
          brands={brands}
          projects={projects}
          defaultBrandId={brandFilter ?? undefined}
          onClose={() => setPanel(null)}
        />
      )}
    </>
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
      {/* The dot swells on the selected brand — one small confirmation that the
          board below is now filtered. */}
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
              ↳
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
        </div>

        {item.channels.length > 0 && (
          <div className="mt-2.5 flex items-center gap-1">
            {item.channels.map((row) => (
              <ChannelBadge
                key={row.id}
                platform={row.channel.platform}
                handle={row.channel.handle}
                label={row.channel.label}
                done={row.state === "published"}
                skipped={row.state === "skipped"}
              />
            ))}
            {postedCount > 0 && postedCount < item.channels.length && (
              <span className="ml-0.5 text-[10px] text-faint">
                {postedCount}/{item.channels.length}
              </span>
            )}
          </div>
        )}
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
