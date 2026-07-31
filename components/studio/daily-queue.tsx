"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ChannelBadge } from "@/components/studio/channel-badge";
import type { DropView } from "@/components/studio/types";
import { cn } from "@/lib/utils";

/**
 * The daily cadence, collapsed.
 *
 * Two accounts posting daily generate ~28 slots inside the board's horizon. As
 * cards they bury every one-off drop in the Idea column and make the pipeline
 * unreadable — so the whole series cadence lives here instead, one dot per day,
 * and the columns are left to the drops that were actually thought up.
 *
 * A dot is still a drop: clicking one opens the same panel a card would.
 */
export function DailyQueue({
  drops,
  todayKey,
  onOpen,
}: {
  drops: DropView[];
  /** "YYYY-MM-DD", computed on the server so past/future can't hydrate wrong. */
  todayKey: string;
  onOpen: (drop: DropView) => void;
}) {
  const lanes = useMemo(() => {
    const bySeries = new Map<string, DropView[]>();
    for (const drop of drops) {
      if (!drop.series || !drop.slotDate) continue;
      const bucket = bySeries.get(drop.series.id);
      if (bucket) bucket.push(drop);
      else bySeries.set(drop.series.id, [drop]);
    }

    return [...bySeries.values()]
      .map((rows) => {
        const sorted = [...rows].sort((a, b) =>
          (a.slotDate ?? "").localeCompare(b.slotDate ?? ""),
        );
        const upcoming = sorted.filter((drop) => (drop.slotDate ?? "") >= todayKey);
        const filled = upcoming.filter((drop) => drop.title.trim() !== "").length;
        const missed = sorted.filter(
          (drop) =>
            (drop.slotDate ?? "") < todayKey &&
            drop.title.trim() === "" &&
            drop.stage !== "published",
        ).length;
        const nextGap = upcoming.find((drop) => drop.title.trim() === "");

        return {
          id: sorted[0].series!.id,
          name: sorted[0].series!.name,
          brandColor: sorted[0].brand.color,
          channels: sorted[0].channels.map((row) => row.channel),
          slots: sorted,
          filled,
          total: upcoming.length,
          missed,
          nextGap,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [drops, todayKey]);

  if (lanes.length === 0) return null;

  const totalFilled = lanes.reduce((sum, lane) => sum + lane.filled, 0);
  const total = lanes.reduce((sum, lane) => sum + lane.total, 0);
  const totalMissed = lanes.reduce((sum, lane) => sum + lane.missed, 0);

  return (
    <section className="mb-5 animate-rise rounded-card bg-card p-4 shadow-card">
      <div className="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink">
          Daily queue
        </h2>
        <span className="text-[12px] text-muted">
          <span className="font-medium text-ink">{totalFilled}</span>
          <span className="numeral-tail"> / {total}</span> slots filled
        </span>
        {totalMissed > 0 && (
          <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">
            {totalMissed} slipped past
          </span>
        )}

        <Link
          href="/studio/batch"
          className="ml-auto flex items-center gap-1.5 rounded-chip bg-inset px-3 py-1.5 text-[12px] font-medium text-ink transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-line active:scale-[0.97]"
        >
          Fill the week
          <ArrowRight className="size-3" strokeWidth={2.4} />
        </Link>
      </div>

      <div className="flex flex-col gap-2.5">
        {lanes.map((lane) => (
          <div
            key={lane.id}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <div className="flex shrink-0 items-center gap-2 sm:w-[210px]">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: lane.brandColor }}
              />
              {lane.channels.map((channel) => (
                <ChannelBadge
                  key={channel.id}
                  platform={channel.platform}
                  handle={channel.handle}
                  label={channel.label}
                  done
                />
              ))}
              <span className="truncate text-[12px] text-muted">
                {lane.channels[0] ? `@${lane.channels[0].handle}` : lane.name}
              </span>
            </div>

            <div className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1 pb-1">
              {lane.slots.map((slot) => (
                <QueueDot
                  key={slot.id}
                  drop={slot}
                  todayKey={todayKey}
                  onOpen={() => onOpen(slot)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function QueueDot({
  drop,
  todayKey,
  onOpen,
}: {
  drop: DropView;
  todayKey: string;
  onOpen: () => void;
}) {
  const slotDate = drop.slotDate ?? "";
  const day = slotDate.slice(8, 10);
  const isToday = slotDate === todayKey;
  const isPast = slotDate < todayKey;
  const filled = drop.title.trim() !== "";

  const tone = drop.stage === "published"
    ? "bg-good text-white"
    : drop.stage === "scheduled"
      ? "bg-ink text-white"
      : filled
        ? "bg-inset text-ink"
        : isPast
          ? "border border-dashed border-accent/50 bg-transparent text-accent"
          : "border border-dashed border-line bg-transparent text-faint";

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${drop.publishLabel ?? slotDate} — ${
        filled ? drop.title : "empty slot"
      }`}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-chip text-[11px] font-medium tabular-nums transition-[transform,box-shadow] duration-(--duration-base) ease-soft hover:-translate-y-px hover:shadow-card active:scale-90",
        tone,
        isToday && "ring-2 ring-accent/35",
      )}
    >
      {day}
    </button>
  );
}
