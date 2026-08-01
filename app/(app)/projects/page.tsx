import { FolderKanban } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { db } from "@/lib/db";
import { daysSince } from "@/lib/projects";

export const metadata = { title: "Projects · Clan Centurio" };
export const dynamic = "force-dynamic";

const STATUSES = [
  { id: "active", label: "Active", tone: "bg-good" },
  { id: "simmering", label: "Simmering", tone: "bg-warn" },
  { id: "paused", label: "Paused", tone: "bg-faint" },
  { id: "archived", label: "Archived", tone: "bg-line" },
] as const;

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

export default async function ProjectsPage() {
  const [areas, projects] = await Promise.all([
    db.area.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { projects: true } } },
    }),
    db.project.findMany({
      // Tier first. "Which of these actually matters" is the question the
      // roster is opened with, and status-then-recency answered a different
      // one — an active side project sorted above a main one that had been
      // quiet for a week.
      orderBy: [
        { priority: "asc" },
        { status: "asc" },
        { lastTouchedAt: "desc" },
      ],
      include: {
        area: { select: { name: true, color: true } },
        _count: { select: { drops: true } },
      },
    }),
  ]);

  const counts = Object.fromEntries(
    STATUSES.map((status) => [
      status.id,
      projects.filter((project) => project.status === status.id).length,
    ]),
  );

  return (
    <>
      <SurfaceHeader
        title="Projects"
        tagline="The roster, and how much momentum each one still has."
        meta={`${projects.length} project${projects.length === 1 ? "" : "s"}`}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {STATUSES.map((status) => (
          <span
            key={status.id}
            className="flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-[13px] text-muted shadow-card"
          >
            <span className={`size-2 rounded-full ${status.tone}`} />
            {status.label}
            <span className="text-faint">{counts[status.id] ?? 0}</span>
          </span>
        ))}
      </div>

      {projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            body="A project is the thing you're actually pushing forward. Every mark and every drop hangs off one, and each carries a last-touched date so the quiet ones can't hide."
            className="py-16"
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => {
            const idle = daysSince(project.lastTouchedAt);
            const drifting =
              project.cadenceDays !== null && idle > project.cadenceDays;

            return (
              <Card key={project.id} className="p-4">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: project.area.color }}
                  />
                  <h2 className="truncate text-[14px] font-semibold tracking-tight text-ink">
                    {project.name}
                  </h2>
                  {project.priority === "main" && (
                    <span className="shrink-0 rounded-full bg-obsidian px-2 py-0.5 text-[10px] font-medium text-white">
                      main
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[11px] text-faint">
                    {project.area.name}
                  </span>
                </div>

                {project.description && (
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                    {project.description}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
                  <span>{project._count.drops} drops</span>
                  <span>·</span>
                  <span className={drifting ? "font-medium text-warn" : undefined}>
                    {idle === 0
                      ? "Touched today"
                      : `${idle}d since ${dayFormat.format(project.lastTouchedAt)}`}
                  </span>
                  {project.cadenceDays && (
                    <>
                      <span>·</span>
                      <span>every {project.cadenceDays}d</span>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {areas.map((area) => (
          <div
            key={area.id}
            className="rounded-tile bg-card px-4 py-3.5 shadow-card"
          >
            <div className="flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ background: area.color }}
              />
              <span className="text-[13px] font-medium text-ink">
                {area.name}
              </span>
            </div>
            <p className="mt-1 text-xs text-faint">
              {area._count.projects} project
              {area._count.projects === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
