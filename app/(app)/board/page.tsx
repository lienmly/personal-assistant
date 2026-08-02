import { HuntBoard } from "@/components/board/hunt-board";
import type { TaskView } from "@/components/board/types";
import type { SprintView } from "@/components/sprint/types";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { db } from "@/lib/db";
import { getHuntBoard } from "@/lib/tasks";
import { getActiveSprint } from "@/lib/sprints";
import { toTaskView } from "@/lib/task-view";
import { todayKey } from "@/lib/utils";

export const metadata = { title: "Hunt Board · Clan Centurio" };

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [{ tasks, projects, areas }, sprint, sprintCount] = await Promise.all([
    getHuntBoard(),
    getActiveSprint(),
    db.sprint.count(),
  ]);

  const today = todayKey();
  const taskViews: TaskView[] = tasks.map((task) => toTaskView(task, today));

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
