import { Plus } from "lucide-react";

import { SurfaceHeader } from "@/components/ui/surface-header";

export const metadata = { title: "Studio · Clan Centurio" };

/** The Drop pipeline from CLAUDE.md §6. Cross-project by design — this is the
 *  one place social distribution is viewed as a whole. */
const STAGES = ["Idea", "Script", "Edit", "Scheduled", "Published"] as const;

export default function StudioPage() {
  return (
    <>
      <SurfaceHeader
        title="Studio"
        tagline="Content moving toward publication, across every project at once."
        meta="0 drops"
      />

      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="flex min-w-max gap-4">
          {STAGES.map((stage) => (
            <div
              key={stage}
              className="flex w-[220px] flex-col rounded-card bg-card p-4 shadow-card"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold tracking-tight text-ink">
                  {stage}
                </span>
                <span className="rounded-full bg-inset px-2 py-0.5 text-[11px] font-medium text-faint">
                  0
                </span>
              </div>

              <div className="flex min-h-[220px] flex-1 items-center justify-center rounded-tile border border-dashed border-line">
                <span className="grid size-8 place-items-center rounded-full bg-inset text-faint">
                  <Plus className="size-4" strokeWidth={2} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-5 max-w-lg text-[13px] leading-relaxed text-muted">
        A drop belongs to one project and fans out to as many channels as you
        like — one source asset, many destinations. Publishing one bumps its
        project&rsquo;s momentum on Today.
        <span className="ml-1.5 rounded-full bg-card px-2.5 py-1 text-[11px] font-medium text-faint shadow-card">
          Arrives in Phase 3
        </span>
      </p>
    </>
  );
}
