import { ProjectsRoster } from "@/components/projects/projects-roster";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { db } from "@/lib/db";
import { getRoster } from "@/lib/projects";

export const metadata = { title: "Projects · Clan Centurio" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [areas, projects] = await Promise.all([
    db.area.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { projects: true } } },
    }),
    getRoster(),
  ]);

  return (
    <>
      <SurfaceHeader
        title="Projects"
        tagline="The roster, and how much momentum each one still has."
        meta={`${projects.length} project${projects.length === 1 ? "" : "s"}`}
      />

      <ProjectsRoster
        projects={projects}
        areas={areas.map((area) => ({
          id: area.id,
          name: area.name,
          color: area.color,
        }))}
      />

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
