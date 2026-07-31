"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

import { ChannelBadge } from "@/components/studio/channel-badge";
import type { GoingOutChannelView, GoingOutView } from "@/components/today/types";
import { setChannelState } from "@/lib/studio-actions";
import { cn } from "@/lib/utils";

/**
 * Section 2 of Today. Deliberately looks nothing like the marks above it — a
 * drop isn't a task, and a list where "post the thing" sits interleaved with
 * "ship the iOS build" is the exact mistake the two-entity split avoids.
 *
 * Each channel is its own tick, because one asset going to three places is
 * three separate acts of posting. Ticking the last one publishes the whole
 * drop and bumps its project — the same `setChannelState` the Studio panel
 * calls, so the two screens can't drift apart.
 */
export function GoingOut({ drops }: { drops: GoingOutView[] }) {
  return (
    <div className="flex flex-col gap-2">
      {drops.map((drop) => (
        <DropRow key={drop.id} drop={drop} />
      ))}
    </div>
  );
}

function DropRow({ drop }: { drop: GoingOutView }) {
  const posted = drop.channels.filter(
    (channel) => channel.state === "published",
  ).length;
  const allDone = posted === drop.channels.length && posted > 0;
  const untitled = drop.title.trim() === "";

  return (
    <div
      className={cn(
        "rounded-tile bg-inset p-3 transition-colors duration-(--duration-base)",
        allDone && "bg-good/8",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: drop.brandColor }}
        />
        <span className="text-[11px] font-medium text-muted">
          {drop.brandName}
        </span>
        <span className="text-[11px] text-faint">{drop.timeLabel}</span>
        {drop.channels.length > 0 && (
          <span
            className={cn(
              "ml-auto text-[11px] font-medium tabular-nums",
              allDone ? "text-good" : "text-faint",
            )}
          >
            {posted}/{drop.channels.length}
          </span>
        )}
      </div>

      <p
        className={cn(
          "mt-1 text-[13px] font-medium leading-snug",
          untitled ? "text-faint" : "text-ink",
        )}
      >
        {untitled
          ? drop.seriesName
            ? `${drop.seriesName} — nothing written yet`
            : "Untitled"
          : drop.title}
      </p>

      {drop.projectName && (
        <p className="mt-0.5 text-[11px] text-faint">{drop.projectName}</p>
      )}

      {drop.channels.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {drop.channels.map((channel) => (
            <ChannelTick key={channel.id} channel={channel} />
          ))}
        </div>
      ) : (
        <Link
          href="/studio"
          className="mt-2 inline-block text-[11px] text-muted hover:text-ink"
        >
          No channels attached — set them in Studio →
        </Link>
      )}
    </div>
  );
}

/** Tap the badge to mark that one channel posted. Tapping again undoes it. */
function ChannelTick({ channel }: { channel: GoingOutChannelView }) {
  const [pending, startTransition] = useTransition();
  const done = channel.state === "published";

  function toggle() {
    const form = new FormData();
    form.set("dropChannelId", channel.id);
    form.set("state", done ? "pending" : "published");
    startTransition(() => setChannelState(form));
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={toggle}
      aria-label={`${done ? "Un-mark" : "Mark"} @${channel.handle} as posted`}
      className={cn(
        "flex items-center gap-1.5 rounded-chip py-1 pl-1 pr-2.5 text-[11px] transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-[0.97] disabled:opacity-45",
        done
          ? "bg-good/15 text-good"
          : "bg-card text-muted shadow-card hover:text-ink",
      )}
    >
      <ChannelBadge
        platform={channel.platform}
        handle={channel.handle}
        label={channel.label}
        done={done}
        skipped={channel.state === "skipped"}
      />
      <span className="max-w-[110px] truncate">@{channel.handle}</span>
      {done && (
        <Check key="done" className="size-3 animate-pop" strokeWidth={3} />
      )}
    </button>
  );
}
