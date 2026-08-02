"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Link2 } from "lucide-react";

import { ChannelBadge } from "@/components/studio/channel-badge";
import type { BatchSlotView } from "@/components/studio/types";
import { saveBatch } from "@/lib/studio-actions";
import { cn } from "@/lib/utils";

/**
 * A week of dailies, as one form.
 *
 * The whole point is that the batch is produced in one sitting: find seven
 * viral songs, screen-record seven clips, and the slots are already waiting.
 * Opening fourteen side panels to type fourteen song names is the thing that
 * kills a daily cadence, so this is deliberately a grid you can tab through.
 */
export function BatchComposer({
  slots,
  brands,
}: {
  slots: BatchSlotView[];
  brands: { id: string; name: string; color: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [brandFilter, setBrandFilter] = useState<string | null>(
    brands.length === 1 ? brands[0].id : null,
  );
  // Mirrors the title inputs so the counter and the row ticks respond as you
  // type. The inputs stay uncontrolled — a controlled grid of 28 fields
  // re-renders the whole form on every keystroke.
  const [titles, setTitles] = useState<Record<string, string>>(() =>
    Object.fromEntries(slots.map((slot) => [slot.id, slot.title])),
  );
  const [saved, setSaved] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      brandFilter ? slots.filter((slot) => slot.brandId === brandFilter) : slots,
    [slots, brandFilter],
  );

  const days = useMemo(() => {
    const byDay = new Map<string, BatchSlotView[]>();
    for (const slot of visible) {
      const bucket = byDay.get(slot.slotDate);
      if (bucket) bucket.push(slot);
      else byDay.set(slot.slotDate, [slot]);
    }
    return [...byDay.entries()].map(([slotDate, rows]) => ({ slotDate, rows }));
  }, [visible]);

  const filled = visible.filter(
    (slot) => (titles[slot.id] ?? "").trim() !== "",
  ).length;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    // `requestSubmit(button)` puts the button's own name/value in the FormData,
    // which is how "Save" and "Save + mark produced" share one handler.
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    if (submitter instanceof HTMLButtonElement && submitter.value) {
      form.set("advanceTo", submitter.value);
    }
    startTransition(async () => {
      const written = await saveBatch(form);
      setSaved(
        written === 0
          ? "Nothing changed"
          : `Saved ${written} ${written === 1 ? "slot" : "slots"}`,
      );
    });
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-card bg-card p-8 text-center shadow-card">
        <p className="text-[13px] text-muted">
          No upcoming slots. Turn a series on under{" "}
          <span className="text-ink">Brands, channels &amp; series</span> and
          they&rsquo;ll materialise here.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setBrandFilter(null)}
          className={cn(
            "flex items-center gap-2 rounded-chip px-3 py-2 text-[13px] transition-[background-color,color,box-shadow] duration-(--duration-base) ease-soft",
            brandFilter === null
              ? "bg-card font-medium text-ink shadow-card"
              : "text-muted hover:text-ink",
          )}
        >
          <span className="size-2 rounded-full bg-ink" />
          All brands
        </button>
        {brands.map((brand) => (
          <button
            key={brand.id}
            type="button"
            onClick={() =>
              setBrandFilter(brandFilter === brand.id ? null : brand.id)
            }
            className={cn(
              "flex items-center gap-2 rounded-chip px-3 py-2 text-[13px] transition-[background-color,color,box-shadow] duration-(--duration-base) ease-soft",
              brandFilter === brand.id
                ? "bg-card font-medium text-ink shadow-card"
                : "text-muted hover:text-ink",
            )}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: brand.color }}
            />
            {brand.name}
          </button>
        ))}

        <span className="ml-auto text-[13px] text-muted">
          <span className="font-medium text-ink">{filled}</span>
          <span className="numeral-tail"> / {visible.length}</span> filled
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {days.map((day, dayIndex) => (
          <section
            key={day.slotDate}
            style={{ animationDelay: `${Math.min(dayIndex, 8) * 35}ms` }}
            className={cn(
              "animate-rise rounded-card bg-card p-4 shadow-card",
              day.rows[0].isPast && "bg-warn-soft/40",
            )}
          >
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <h2 className="text-[13px] font-semibold tracking-tight text-ink">
                {day.rows[0].dayLabel}
              </h2>
              {day.rows[0].isToday && (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent">
                  today
                </span>
              )}
              {day.rows[0].isPast && (
                <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-medium text-warn">
                  slot already passed
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {day.rows.map((slot) => (
                <SlotRow
                  key={slot.id}
                  slot={slot}
                  value={titles[slot.id] ?? ""}
                  onChange={(value) =>
                    setTitles((current) => ({ ...current, [slot.id]: value }))
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Sticky because the grid is long and the batch is finished from the
          bottom of it — a save button above the fold would be scrolled past. */}
      <div className="sticky bottom-0 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-card bg-shell/95 px-4 py-3 shadow-float backdrop-blur">
        {saved && <span className="text-[13px] text-muted">{saved}</span>}
        <button
          type="submit"
          name="advanceTo"
          value=""
          disabled={pending}
          className="ml-auto rounded-chip bg-card px-4 py-2 text-[13px] font-medium text-ink shadow-card transition-transform duration-(--duration-base) ease-soft active:scale-[0.97] disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="submit"
          name="advanceTo"
          value="produce"
          disabled={pending}
          className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
        >
          Save + mark produced
        </button>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-faint">
        &ldquo;Task produced&rdquo; only moves rows that have a title, and never
        drags a slot backwards — anything already scheduled stays scheduled.
      </p>
    </form>
  );
}

function SlotRow({
  slot,
  value,
  onChange,
}: {
  slot: BatchSlotView;
  value: string;
  onChange: (value: string) => void;
}) {
  const filled = value.trim() !== "";

  return (
    <div className="flex flex-col gap-2 rounded-tile bg-inset p-2.5 sm:flex-row sm:items-center">
      <div className="flex shrink-0 items-center gap-2 sm:w-[190px]">
        <span
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-full transition-colors duration-(--duration-base)",
            filled ? "bg-good text-white" : "bg-line text-transparent",
          )}
        >
          <Check className="size-3" strokeWidth={3} />
        </span>
        {slot.channels.map((channel) => (
          <ChannelBadge
            key={channel.id}
            platform={channel.platform}
            handle={channel.handle}
            label={channel.label}
            done
          />
        ))}
        <span className="truncate text-[12px] text-muted">
          {slot.channels[0] ? `@${slot.channels[0].handle}` : slot.seriesName}
        </span>
      </div>

      <input
        name={`title:${slot.id}`}
        defaultValue={slot.title}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Song / hook for this one"
        aria-label={`Title for ${slot.dayLabel}, ${slot.seriesName}`}
        className="min-w-0 flex-1 rounded-chip bg-card px-3 py-2 text-[13px] text-ink outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/25"
      />

      <div className="relative sm:w-[230px]">
        <Link2 className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
        <input
          name={`ref:${slot.id}`}
          type="url"
          inputMode="url"
          defaultValue={slot.refUrl ?? ""}
          placeholder="Viral post it's based on"
          aria-label={`Reference link for ${slot.dayLabel}, ${slot.seriesName}`}
          className="w-full rounded-chip bg-card py-2 pl-8 pr-3 text-[12px] text-ink outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/25"
        />
      </div>
    </div>
  );
}
