import Link from "next/link";
import { Settings2 } from "lucide-react";

import { StudioBoard } from "@/components/studio/studio-board";
import type { BrandView, DropView } from "@/components/studio/types";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { ensureSeriesSlots, getStudioBoard } from "@/lib/studio";

export const metadata = { title: "Studio · Clan Centurio" };

// Slot generation writes, and the board must reflect those writes immediately.
export const dynamic = "force-dynamic";

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

export default async function StudioPage() {
  // Idempotent, cheap, and keeps the daily cadence alive without a cron.
  await ensureSeriesSlots();

  const { drops, brands, projects } = await getStudioBoard();
  const todayKey = new Date().toDateString();

  const dropViews: DropView[] = drops.map((drop) => ({
    id: drop.id,
    title: drop.title,
    notes: drop.notes,
    body: drop.body,
    format: drop.format,
    stage: drop.stage,
    publishAt: drop.publishAt?.toISOString() ?? null,
    publishLabel: drop.publishAt ? dayFormat.format(drop.publishAt) : null,
    isToday: drop.publishAt?.toDateString() === todayKey,
    brand: drop.brand,
    project: drop.project,
    series: drop.series,
    sourceDropId: drop.sourceDropId,
    channels: drop.channels.map((row) => ({
      id: row.id,
      state: row.state,
      publishedUrl: row.publishedUrl,
      channel: row.channel,
    })),
  }));

  const brandViews: BrandView[] = brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    slug: brand.slug,
    color: brand.color,
    channels: brand.channels.map((channel) => ({
      id: channel.id,
      platform: channel.platform,
      handle: channel.handle,
      label: channel.label,
      state: channel.state,
    })),
  }));

  const open = dropViews.filter((drop) => drop.stage !== "published").length;

  return (
    <>
      <SurfaceHeader
        title="Studio"
        tagline="One asset, many destinations. Every brand's pipeline in one place."
        meta={`${open} in flight`}
      />

      <StudioBoard
        drops={dropViews}
        brands={brandViews}
        projects={projects}
      />

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href="/studio/channels"
          className="flex items-center gap-2 rounded-chip bg-card px-3.5 py-2 text-[13px] text-muted shadow-card hover:text-ink"
        >
          <Settings2 className="size-3.5" strokeWidth={1.8} />
          Brands, channels & series
        </Link>
        <p className="max-w-md text-[12px] leading-relaxed text-faint">
          A drop carries two axes: the <strong className="font-medium">brand</strong>{" "}
          publishing it and the <strong className="font-medium">project</strong>{" "}
          it&rsquo;s about. That&rsquo;s what lets a Sleepy Cat devlog go out as
          Coding Mom without inventing a second project for it.
        </p>
      </div>
    </>
  );
}
