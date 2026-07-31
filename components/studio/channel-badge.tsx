import type { Platform } from "@prisma/client";

import { PLATFORMS } from "@/lib/platforms";
import { cn } from "@/lib/utils";

/**
 * A channel reads as a lettermark on the platform's colour. Faded when the
 * post hasn't gone out yet, solid once it has — so a card's channel row is
 * itself the progress bar for the fan-out.
 */
export function ChannelBadge({
  platform,
  handle,
  label,
  done = false,
  skipped = false,
  size = "sm",
  className,
}: {
  platform: Platform;
  handle: string;
  label?: string | null;
  done?: boolean;
  skipped?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = PLATFORMS[platform];

  return (
    <span
      title={`${meta.label} · @${handle}${label ? ` (${label})` : ""}`}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white tabular-nums",
        size === "sm" ? "size-5 text-[9px]" : "size-7 text-[11px]",
        skipped && "line-through",
        className,
      )}
      style={{
        background: meta.color,
        opacity: skipped ? 0.25 : done ? 1 : 0.32,
      }}
    >
      {meta.short}
    </span>
  );
}
