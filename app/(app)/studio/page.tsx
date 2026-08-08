import Link from "next/link";
import { LayoutList, Settings2 } from "lucide-react";

import { StudioBoard } from "@/components/studio/studio-board";
import type { BrandView, ContentView } from "@/components/studio/types";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { ensureSeriesSlots, getStudioBoard } from "@/lib/studio";
import { todayKey } from "@/lib/utils";

export const metadata = { title: "Social Media · Clan Centurio" };

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

  const { items, brands, projects } = await getStudioBoard();
  const now = new Date();
  const todayLabel = now.toDateString();
  // ISO form, for the queue strip — comparing "YYYY-MM-DD" strings is the only
  // past/future test that survives being shipped to the client.
  const todayIso = todayKey(now);

  const contentViews: ContentView[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    notes: item.notes,
    body: item.body,
    refUrl: item.refUrl,
    format: item.format,
    stage: item.stage,
    publishAt: item.publishAt?.toISOString() ?? null,
    slotDate: item.slotDate?.toISOString().slice(0, 10) ?? null,
    publishLabel: item.publishAt ? dayFormat.format(item.publishAt) : null,
    isToday: item.publishAt?.toDateString() === todayLabel,
    brand: item.brand,
    project: item.project,
    series: item.series,
    sourceItemId: item.sourceItemId,
    channels: item.channels.map((row) => ({
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
    projectId: brand.projectId,
    channels: brand.channels.map((channel) => ({
      id: channel.id,
      platform: channel.platform,
      handle: channel.handle,
      label: channel.label,
      state: channel.state,
    })),
  }));

  const open = contentViews.filter((item) => item.stage !== "published").length;

  return (
    <>
      <SurfaceHeader
        title="Social Media Content"
        tagline="One asset, many destinations. Every brand's pipeline in one place."
        meta={`${open} in flight`}
      />

      <StudioBoard
        items={contentViews}
        brands={brandViews}
        projects={projects}
        todayKey={todayIso}
      />

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href="/studio/batch"
          className="flex items-center gap-2 rounded-chip bg-card px-3.5 py-2 text-[13px] text-muted shadow-card hover:text-ink"
        >
          <LayoutList className="size-3.5" strokeWidth={1.8} />
          Fill the week
        </Link>
        <Link
          href="/studio/channels"
          className="flex items-center gap-2 rounded-chip bg-card px-3.5 py-2 text-[13px] text-muted shadow-card hover:text-ink"
        >
          <Settings2 className="size-3.5" strokeWidth={1.8} />
          Brands, channels & series
        </Link>
        <p className="max-w-md text-[12px] leading-relaxed text-faint">
          A piece of social media content carries two axes: the <strong className="font-medium">brand</strong>{" "}
          publishing it and the <strong className="font-medium">project</strong>{" "}
          it&rsquo;s about. That&rsquo;s what lets a Sleepy Cat devlog go out as
          Coding Mom without inventing a second project for it.
        </p>
      </div>
    </>
  );
}
