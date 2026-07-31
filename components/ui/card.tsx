import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("rounded-card bg-card p-5 shadow-card", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  count,
  hint,
}: {
  title: string;
  count?: string;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {count !== undefined && (
        <span className="rounded-full bg-inset px-2.5 py-1 text-xs font-medium text-muted">
          {count}
        </span>
      )}
      {hint !== undefined && (
        <span className="text-xs text-faint">{hint}</span>
      )}
    </div>
  );
}

/** A big display figure with a de-emphasised tail, as in the reference. */
export function StatTile({
  label,
  value,
  tail,
  tone = "light",
  note,
}: {
  label: string;
  value: string;
  tail?: string;
  tone?: "light" | "dark";
  note?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-tile px-5 py-4",
        tone === "dark"
          ? "bg-obsidian text-white"
          : "bg-card text-ink shadow-card",
      )}
    >
      <p
        className={cn(
          "text-[13px]",
          tone === "dark" ? "text-white/60" : "text-muted",
        )}
      >
        {label}
      </p>
      <p className="mt-1.5 text-[28px] font-semibold leading-none tracking-tight">
        {value}
        {tail && (
          <span className={tone === "dark" ? "text-white/35" : "numeral-tail"}>
            {tail}
          </span>
        )}
      </p>
      {note && (
        <p
          className={cn(
            "mt-2 text-xs",
            tone === "dark" ? "text-white/50" : "text-faint",
          )}
        >
          {note}
        </p>
      )}
    </div>
  );
}
