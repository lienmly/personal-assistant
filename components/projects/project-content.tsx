"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Radio } from "lucide-react";

import { ContentColumns } from "@/components/studio/content-columns";
import { ContentPanel } from "@/components/studio/content-panel";
import { FilterChip } from "@/components/studio/filter-chip";
import type {
  BrandView,
  ContentView,
  ProjectView,
} from "@/components/studio/types";
import { Card } from "@/components/ui/card";
import { destinationLabel } from "@/lib/platforms";

/**
 * A project's social media content, as the same pipeline Studio shows.
 *
 * **It was a list of unclickable lines until 2026-08-28**, which meant the one
 * screen that knows what a piece of content is *about* was the one screen you
 * could not open it from — you read the title here and went to Studio to find
 * the same row among ninety. It opens the same `ContentPanel` now, for the
 * reason a task opens where you read it (CLAUDE.md §6): a detour through a
 * surface you did not want is the complaint the Projects roster died of.
 *
 * **The two questions survive as chips rather than as two card stacks.** §6 is
 * emphatic that "posted as X" (what this project's own accounts publish) and
 * "covered elsewhere" (what other people's accounts say about it) are different
 * questions and must not be blurred — and they are not, because they still
 * partition the rows exactly. What changed is that they are now a filter over
 * one board instead of two boards, which is the only arrangement that works for
 * both Coding Mom (31 · 0) and Forge (0 · 5): stacked, whichever section is
 * empty for a given project is five empty columns to scroll past.
 */
export function ProjectContent({
  project,
  ownBrands,
  items,
  brands,
  projects,
}: {
  project: { id: string; name: string };
  /** The brands this project is the work of — its own accounts. */
  ownBrands: BrandView[];
  /** Every item on either axis: published by us, or about us. */
  items: ContentView[];
  /** All brands, because the panel can re-file an item onto any of them. */
  brands: BrandView[];
  projects: ProjectView[];
}) {
  const [scope, setScope] = useState<"all" | "elsewhere" | string>("all");
  const [panel, setPanel] = useState<
    { mode: "new" } | { mode: "edit"; item: ContentView } | null
  >(null);

  const ownIds = useMemo(
    () => new Set(ownBrands.map((brand) => brand.id)),
    [ownBrands],
  );

  const elsewhereCount = items.filter(
    (item) => !ownIds.has(item.brand.id),
  ).length;

  const visible = items.filter((item) => {
    if (scope === "all") return true;
    if (scope === "elsewhere") return !ownIds.has(item.brand.id);
    return item.brand.id === scope;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          active={scope === "all"}
          onClick={() => setScope("all")}
          dot="var(--color-ink)"
          label="Everything"
          count={items.length}
        />
        {ownBrands.map((brand) => (
          <FilterChip
            key={brand.id}
            active={scope === brand.id}
            onClick={() => setScope(scope === brand.id ? "all" : brand.id)}
            dot={brand.color}
            label={`Posted as ${brand.name}`}
            count={items.filter((item) => item.brand.id === brand.id).length}
          />
        ))}
        {elsewhereCount > 0 && (
          <FilterChip
            active={scope === "elsewhere"}
            onClick={() =>
              setScope(scope === "elsewhere" ? "all" : "elsewhere")
            }
            dot="var(--color-faint)"
            label="Covered elsewhere"
            count={elsewhereCount}
          />
        )}

        <button
          type="button"
          onClick={() => setPanel({ mode: "new" })}
          className="ml-auto flex items-center gap-1.5 rounded-chip bg-accent px-3.5 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
        >
          <Plus className="size-3.5" strokeWidth={2.4} />
          New item
        </button>
      </div>

      {/* The accounts, as a sentence rather than a row of lettermarks. The stat
          tile above already counts them; a grid of coloured badges repeating
          that count is exactly the noise this pass took off the Studio board.
          Named by `destinationLabel` and not by handle, for the reason that
          function exists: Coding Mom's six accounts are all called @codingmom,
          so a list of handles names none of them. */}
      {ownBrands.length > 0 ? (
        <p className="text-[12.5px] leading-relaxed text-muted">
          {ownBrands.map((brand, index) => (
            <span key={brand.id}>
              {index > 0 && " "}
              <span className="text-ink">{brand.name}</span>
              {brand.channels.length > 0 ? (
                <>
                  {" posts to "}
                  {brand.channels
                    .map((channel) => destinationLabel(channel, brand.channels))
                    .join(", ")}
                  .
                </>
              ) : (
                " has no accounts yet."
              )}
            </span>
          ))}
        </p>
      ) : (
        <p className="text-[12.5px] leading-relaxed text-muted">
          {project.name} runs no account of its own — its posts go out from
          another brand&rsquo;s audience.
        </p>
      )}

      {visible.length > 0 ? (
        <ContentColumns
          items={visible}
          onOpen={(item) => setPanel({ mode: "edit", item })}
          onNew={() => setPanel({ mode: "new" })}
        />
      ) : (
        <Card>
          <div className="flex flex-col items-center justify-center rounded-tile bg-inset px-6 py-8 text-center">
            <span className="mb-3 grid size-10 place-items-center rounded-full bg-card text-faint shadow-card">
              <Radio className="size-4.5" strokeWidth={1.8} />
            </span>
            <p className="text-sm font-medium text-ink">
              {scope === "all"
                ? `Nothing published or queued about ${project.name} yet`
                : "Nothing in this view"}
            </p>
            <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">
              A new item starts as an idea and moves right as it gets written,
              made and sent. Where it goes is a field inside it.
            </p>
          </div>
        </Card>
      )}

      <Link
        href="/studio"
        className="inline-block text-[12.5px] text-muted hover:text-accent"
      >
        Open Social Media &rarr;
      </Link>

      {panel && (
        <ContentPanel
          item={panel.mode === "edit" ? panel.item : null}
          brands={brands}
          projects={projects}
          defaultBrandId={ownBrands[0]?.id}
          defaultProjectId={project.id}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}
