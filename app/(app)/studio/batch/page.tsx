import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BatchComposer } from "@/components/studio/batch-composer";
import type { BatchSlotView } from "@/components/studio/types";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { ensureSeriesSlots, getBatchSlots } from "@/lib/studio";
import { todayKey } from "@/lib/utils";

export const metadata = { title: "Fill the week · Clan Centurio" };

export const dynamic = "force-dynamic";

// `slotDate` is a `@db.Date`, which Prisma hands back as UTC midnight — so it
// has to be *formatted* in UTC too, or west of Greenwich every slot renders as
// the day before.
const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export default async function BatchPage() {
  // Same call the board makes — arriving here first must still materialise the
  // slots, or the composer would show an empty week.
  await ensureSeriesSlots();

  const slots = await getBatchSlots();
  const today = todayKey();

  const views: BatchSlotView[] = slots.map((slot) => {
    const slotDate = slot.slotDate!.toISOString().slice(0, 10);
    return {
      id: slot.id,
      title: slot.title,
      refUrl: slot.refUrl,
      slotDate,
      dayLabel: dayFormat.format(slot.slotDate!),
      isToday: slotDate === today,
      isPast: slotDate < today,
      stage: slot.stage,
      brandId: slot.brand.id,
      seriesName: slot.series?.name ?? "Series",
      channels: slot.channels.map((row) => row.channel),
    };
  });

  const brands = [
    ...new Map(
      slots.map((slot) => [
        slot.brand.id,
        { id: slot.brand.id, name: slot.brand.name, color: slot.brand.color },
      ]),
    ).values(),
  ];

  return (
    <>
      <SurfaceHeader
        title="Fill the week"
        tagline="Every upcoming slot in one grid. Type the batch, save once."
        meta={`${views.length} slots`}
      />

      <Link
        href="/studio"
        className="mb-5 inline-flex items-center gap-2 rounded-chip bg-card px-3.5 py-2 text-[13px] text-muted shadow-card transition-colors duration-(--duration-quick) hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={1.8} />
        Back to the board
      </Link>

      <BatchComposer slots={views} brands={brands} />
    </>
  );
}
