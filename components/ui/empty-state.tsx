import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Everything is empty in Phase 1, so empty states carry real weight: they say
 * what the space is for and when it starts filling up.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  phase,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  phase?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-tile bg-inset px-6 py-10 text-center",
        className,
      )}
    >
      <span className="mb-3 grid size-10 place-items-center rounded-full bg-card text-faint shadow-card">
        <Icon className="size-4.5" strokeWidth={1.8} />
      </span>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted">
        {body}
      </p>
      {phase && (
        <span className="mt-3 rounded-full bg-card px-2.5 py-1 text-[11px] font-medium text-faint">
          {phase}
        </span>
      )}
    </div>
  );
}
