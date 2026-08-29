"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { ContentColumns } from "@/components/studio/content-columns";
import { DailyQueue } from "@/components/studio/daily-queue";
import { ContentPanel } from "@/components/studio/content-panel";
import { FilterChip } from "@/components/studio/filter-chip";
import type {
  BrandView,
  ContentView,
  ProjectView,
} from "@/components/studio/types";

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

      <ContentColumns
        items={board}
        onOpen={(item) => setPanel({ mode: "edit", item })}
        onNew={() => setPanel({ mode: "new" })}
      />

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
