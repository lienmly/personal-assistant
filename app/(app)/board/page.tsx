import { HuntBoard } from "@/components/board/hunt-board";
import type { TaskView } from "@/components/board/types";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { getHuntBoard } from "@/lib/tasks";
import { toTaskView } from "@/lib/task-view";
import { todayKey } from "@/lib/utils";

export const metadata = { title: "Hunt Board · Clan Centurio" };

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const { tasks, projects, areas } = await getHuntBoard();

  const today = todayKey();
  const taskViews: TaskView[] = tasks.map((task) => toTaskView(task, today));

  const open = taskViews.filter((task) => task.status !== "done").length;

  // Experiments are captured against whichever project is running the content
  // cadence. Utaitai by name today; falls back to the first project so the
  // capture box never silently loses a paste.
  const experimentProject =
    projects.find((project) => project.slug === "utaitai") ?? projects[0] ?? null;

  return (
    <>
      <SurfaceHeader
        title="Hunt Board"
        tagline="Everything, in full. Today shows you the few that matter; this is the whole list."
        meta={`${open} open`}
      />

      <HuntBoard
        tasks={taskViews}
        projects={projects}
        areas={areas}
        experimentProjectId={experimentProject?.id ?? null}
      />
    </>
  );
}
