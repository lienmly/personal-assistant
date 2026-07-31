import { FolderKanban } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { AREAS } from "@/lib/nav";

export const metadata = { title: "Projects · Clan Centurio" };

const STATUSES = [
  { label: "Active", tone: "bg-good" },
  { label: "Simmering", tone: "bg-warn" },
  { label: "Paused", tone: "bg-faint" },
  { label: "Archived", tone: "bg-line" },
];

export default function ProjectsPage() {
  return (
    <>
      <SurfaceHeader
        title="Projects"
        tagline="The roster, and how much momentum each one still has."
        meta="0 projects"
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUSES.map((status) => (
          <span
            key={status.label}
            className="flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-[13px] text-muted shadow-card"
          >
            <span className={`size-2 rounded-full ${status.tone}`} />
            {status.label}
            <span className="text-faint">0</span>
          </span>
        ))}
      </div>

      <Card>
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          body="A project is the thing you're actually pushing forward. Every mark and every drop hangs off one, and each carries a last-touched date so the quiet ones can't hide."
          phase="Arrives in Phase 2"
          className="py-16"
        />
      </Card>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {AREAS.map((area) => (
          <div
            key={area.id}
            className="rounded-tile bg-card px-4 py-3.5 shadow-card"
          >
            <div className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ background: area.dot }}
              />
              <span className="text-[13px] font-medium text-ink">
                {area.name}
              </span>
            </div>
            <p className="mt-1 text-xs text-faint">0 projects</p>
          </div>
        ))}
      </div>
    </>
  );
}
