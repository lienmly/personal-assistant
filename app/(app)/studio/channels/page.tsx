import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import {
  ChannelManager,
  type BrandDetail,
} from "@/components/studio/channel-manager";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { db } from "@/lib/db";
import { getChannelRoster } from "@/lib/studio";

export const metadata = { title: "Channels · Clan Centurio" };
export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const [roster, projects] = await Promise.all([
    getChannelRoster(),
    db.project.findMany({
      where: { status: { in: ["active", "simmering"] } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const brands: BrandDetail[] = roster.map((brand) => ({
    id: brand.id,
    name: brand.name,
    tagline: brand.tagline,
    color: brand.color,
    projectId: brand.projectId,
    channels: brand.channels.map((channel) => ({
      id: channel.id,
      platform: channel.platform,
      handle: channel.handle,
      label: channel.label,
      state: channel.state,
      url: channel.url,
      postCount: channel._count.posts,
    })),
    series: brand.series.map((series) => ({
      id: series.id,
      name: series.name,
      format: series.format,
      cadence: series.cadence,
      daysOfWeek: series.daysOfWeek,
      timeOfDay: series.timeOfDay,
      isActive: series.isActive,
      projectId: series.projectId,
      projectName: series.project?.name ?? null,
      channelIds: series.channels.map((link) => link.channelId),
      itemCount: series._count.items,
    })),
  }));

  const live = brands.flatMap((brand) =>
    brand.channels.filter((channel) => channel.state === "live"),
  ).length;

  return (
    <>
      <Link
        href="/studio"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.8} />
        Studio
      </Link>

      <SurfaceHeader
        title="Brands & channels"
        tagline="Who publishes, where they publish, and what they've committed to."
        meta={`${live} live`}
      />

      <ChannelManager brands={brands} projects={projects} />

      <p className="mt-6 max-w-lg text-[12px] leading-relaxed text-faint">
        A <strong className="font-medium">series</strong> is a standing
        commitment — it materialises empty dated slots on the board ahead of
        time, so the daily post is a card waiting to be filled rather than a row
        to remember to create. Pause one and it stops generating; the slots
        already made stay put.
      </p>
    </>
  );
}
