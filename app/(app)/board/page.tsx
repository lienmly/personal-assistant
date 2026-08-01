import { HuntBoard } from "@/components/board/hunt-board";
import type { MarkView } from "@/components/board/types";
import type { SprintView } from "@/components/sprint/types";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { db } from "@/lib/db";
import { getHuntBoard } from "@/lib/marks";
import { getActiveSprint } from "@/lib/sprints";
import { todayKey } from "@/lib/utils";

export const metadata = { title: "Hunt Board · Clan Centurio" };

export const dynamic = "force-dynamic";

// `dueDate` is a `@db.Date` — UTC midnight — so it must be formatted in UTC
// too, or west of Greenwich every due date renders a day early.
const dueFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export default async function BoardPage() {
  const [{ marks, projects, areas }, sprint, sprintCount] = await Promise.all([
    getHuntBoard(),
    getActiveSprint(),
    db.sprint.count(),
  ]);

  const today = todayKey();

  const markViews: MarkView[] = marks.map((mark) => {
    // `@db.Date` comes back as UTC midnight; slicing the ISO string is the only
    // read that doesn't shift the day in a negative-offset zone.
    const dueDate = mark.dueDate?.toISOString().slice(0, 10) ?? null;
    return {
      id: mark.id,
      title: mark.title,
      notes: mark.notes,
      link: mark.link,
      track: mark.track,
      status: mark.status,
      dueDate,
      dueLabel: mark.dueDate
        ? dueDate === today
          ? "Today"
          : dueFormat.format(mark.dueDate)
        : null,
      overdue: dueDate !== null && dueDate < today,
      sprintId: mark.sprintId,
      projectId: mark.projectId,
      areaId: mark.areaId,
    };
  });

  const open = markViews.filter((mark) => mark.status !== "done").length;
  const committed = markViews.filter(
    (mark) => mark.status !== "done" && mark.sprintId === (sprint?.id ?? null),
  ).length;

  // Experiments are captured against whichever project is running the content
  // cadence. Utaitai by name today; falls back to the first project so the
  // capture box never silently loses a paste.
  const experimentProject =
    projects.find((project) => project.slug === "utaitai") ?? projects[0] ?? null;

  const sprintView: SprintView | null = sprint;

  return (
    <>
      <SurfaceHeader
        title="Hunt Board"
        tagline="Everything you could be doing. Pick this week's few, and let the rest wait here."
        meta={
          sprint ? `${committed} in sprint · ${open} open` : `${open} open`
        }
      />

      <HuntBoard
        marks={markViews}
        projects={projects}
        areas={areas}
        sprint={sprintView}
        suggestedSprintName={`Week ${sprintCount + 1}`}
        experimentProjectId={experimentProject?.id ?? null}
      />
    </>
  );
}
