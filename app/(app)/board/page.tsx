import { HuntBoard } from "@/components/board/hunt-board";
import type { TaskView } from "@/components/board/types";
import type { SprintView } from "@/components/sprint/types";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { db } from "@/lib/db";
import { getHuntBoard } from "@/lib/tasks";
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
  const [{ tasks, projects, areas }, sprint, sprintCount] = await Promise.all([
    getHuntBoard(),
    getActiveSprint(),
    db.sprint.count(),
  ]);

  const today = todayKey();

  const taskViews: TaskView[] = tasks.map((task) => {
    // `@db.Date` comes back as UTC midnight; slicing the ISO string is the only
    // read that doesn't shift the day in a negative-offset zone.
    const dueDate = task.dueDate?.toISOString().slice(0, 10) ?? null;
    return {
      id: task.id,
      title: task.title,
      notes: task.notes,
      link: task.link,
      track: task.track,
      status: task.status,
      dueDate,
      dueLabel: task.dueDate
        ? dueDate === today
          ? "Today"
          : dueFormat.format(task.dueDate)
        : null,
      overdue: dueDate !== null && dueDate < today,
      sprintId: task.sprintId,
      projectId: task.projectId,
      areaId: task.areaId,
    };
  });

  const open = taskViews.filter((task) => task.status !== "done").length;
  const committed = taskViews.filter(
    (task) => task.status !== "done" && task.sprintId === (sprint?.id ?? null),
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
        tasks={taskViews}
        projects={projects}
        areas={areas}
        sprint={sprintView}
        suggestedSprintName={`Week ${sprintCount + 1}`}
        experimentProjectId={experimentProject?.id ?? null}
      />
    </>
  );
}
