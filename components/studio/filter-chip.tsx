"use client";

import { cn } from "@/lib/utils";

/**
 * The pill row above a content board. Shared by Studio's brand filter and a
 * project page's scope filter since 2026-08-28 — one chip, so the two rows
 * cannot drift into two different-looking controls doing the same thing.
 */
export function FilterChip({
  active,
  onClick,
  dot,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  dot: string;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-chip px-3 py-2 text-[13px] transition-[background-color,color,box-shadow,transform] duration-(--duration-base) ease-soft active:scale-[0.97]",
        active
          ? "bg-card font-medium text-ink shadow-card"
          : "text-muted hover:bg-card/50 hover:text-ink",
      )}
    >
      {/* The dot swells on the selected chip — one small confirmation that the
          board below is now filtered. */}
      <span
        className={cn(
          "size-2 rounded-full transition-transform duration-(--duration-base) ease-soft",
          active && "scale-125",
        )}
        style={{ background: dot }}
      />
      {label}
      {count !== undefined && (
        <span className="text-[12px] text-faint">{count}</span>
      )}
    </button>
  );
}
