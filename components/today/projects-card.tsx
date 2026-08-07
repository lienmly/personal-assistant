"use client";

import { useState } from "react";
import { Archive, ChevronRight, FolderOpen, Plus } from "lucide-react";

import { TaskPanel } from "@/components/board/task-panel";
import type { AreaView, BoardProjectView, TaskView } from "@/components/board/types";
import { ProjectPanel } from "@/components/projects/project-panel";
import type {
  AreaOption,
  DormantProjectView,
  ProjectEditView,
} from "@/components/projects/types";
import { ProjectBoard } from "@/components/today/project-board";
import { QuickCapture } from "@/components/today/quick-capture";
import type { ProjectBoardView } from "@/components/today/types";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/**
 * The body of Today's "Your projects" card — and, since 2026-08-05, the whole
 * of what the Projects roster used to be.
 *
 * The roster was a page listing every project with its description, open count
 * and last-touched date. Once Today became project-first (2026-08-04) that was
 * the same list of the same projects, one nav item away, and the second copy
 * was the one nobody needed: the cards here already carry the focus line and
 * the actual rows. What the roster *did* uniquely own was creating a project,
 * editing one, and being the only view that showed the archived ones — so all
 * three moved here rather than going with it.
 *
 * The create button is deliberately not crimson. It was on the roster, where it
 * was that screen's primary action; on Today the primary action is ticking
 * something off, and §9 allows one accent per region.
 *
 * **It also owns the task panel.** Tapping a row's title on any card opens the
 * same editor the Hunt Board opens, which is what stops "give this a due date"
 * from being a trip to another surface and back. The state lives here rather
 * than on each `ProjectBoard` so only one panel can ever be open, and so the
 * project list it needs is fetched once for the whole screen.
 */
export function ProjectsCard({
  boards,
  areas,
  dormant,
  projects,
  taskAreas,
}: {
  boards: ProjectBoardView[];
  areas: AreaOption[];
  dormant: DormantProjectView[];
  /** The task panel's project picker. */
  projects: BoardProjectView[];
  /** The same areas, in the shape the task panel wants. Passed separately
   *  rather than cast at the use site so neither panel's contract bends. */
  taskAreas: AreaView[];
}) {
  // `undefined` = closed. `null` = open on a new project. A project = editing.
  // Same three-state convention the roster used, kept because "null means new"
  // is the panel's own contract.
  const [editing, setEditing] = useState<ProjectEditView | null | undefined>(
    undefined,
  );
  const [task, setTask] = useState<TaskView | null>(null);
  const [showDormant, setShowDormant] = useState(false);

  return (
    <>
      {boards.length > 0 ? (
        <div className="flex flex-col gap-3">
          {boards.map((board, index) => (
            <ProjectBoard
              key={board.id}
              board={board}
              delay={60 + Math.min(index, 8) * 40}
              onEdit={() => board.edit && setEditing(board.edit)}
              onOpenTask={setTask}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          body="A project is the thing being pushed forward. Start one below and it shows up here with whatever you put on it."
        />
      )}

      {/* Last things in the card on purpose: capturing an idea must never sit
          above the work, and starting a new project even less so. */}
      <div className="mt-4 border-t border-line/60 pt-4">
        <QuickCapture />

        <div className="mt-2 flex items-center justify-between gap-3 px-1">
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="group flex items-center gap-1.5 text-[12px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
          >
            <Plus
              className="size-3.5 transition-transform duration-(--duration-base) ease-soft group-hover:rotate-90"
              strokeWidth={2}
            />
            New project
          </button>

          {dormant.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDormant((open) => !open)}
              aria-expanded={showDormant}
              className="flex items-center gap-1 text-[12px] text-faint transition-colors duration-(--duration-quick) hover:text-muted"
            >
              <Archive className="size-3" strokeWidth={2} />
              {`${dormant.length} put away`}
              <ChevronRight
                className={cn(
                  "size-3 transition-transform duration-(--duration-base) ease-soft",
                  showDormant && "rotate-90",
                )}
                strokeWidth={2.4}
              />
            </button>
          )}
        </div>

        {/* Paused and archived projects. Kept off the card proper because a
            paused project is parked, not owed — listing it every morning is how
            a dashboard starts generating guilt. But it cannot be unreachable
            either: this is the only way back to one. */}
        {showDormant && (
          <div className="mt-2 flex flex-col">
            {dormant.map((project, index) => (
              <button
                key={project.id}
                type="button"
                onClick={() => setEditing(project)}
                style={{ animationDelay: `${index * 35}ms` }}
                className="flex animate-rise items-center gap-2.5 rounded-tile px-2 py-1.5 text-left transition-[background-color,transform] duration-(--duration-base) ease-soft hover:translate-x-0.5 hover:bg-inset"
              >
                <span
                  className="size-2 shrink-0 rounded-full opacity-50"
                  style={{ background: project.areaColor }}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] text-muted">
                  {project.name}
                </span>
                <span className="shrink-0 text-[11px] text-faint">
                  {project.status === "archived" ? "archived" : "paused"}
                </span>
                <span className="hidden shrink-0 text-[11px] text-faint sm:block">
                  {project.touchedLabel}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {editing !== undefined && (
        <ProjectPanel
          key={editing?.id ?? "new"}
          project={editing}
          areas={areas}
          onClose={() => setEditing(undefined)}
        />
      )}

      {task && (
        <TaskPanel
          key={task.id}
          task={task}
          projects={projects}
          areas={taskAreas}
          onClose={() => setTask(null)}
        />
      )}
    </>
  );
}
