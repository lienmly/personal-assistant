export function SurfaceHeader({
  title,
  tagline,
  meta,
}: {
  title: string;
  tagline: string;
  meta?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[30px] font-semibold leading-none tracking-tight text-ink md:text-[38px]">
          {title}
        </h1>
        <p className="mt-2.5 text-sm text-muted">{tagline}</p>
      </div>
      {meta && (
        <span className="rounded-full bg-card px-3.5 py-1.5 text-[13px] text-muted shadow-card">
          {meta}
        </span>
      )}
    </div>
  );
}
