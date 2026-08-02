"use client";

import { useTransition } from "react";
import Link from "next/link";

import { setProjectStatus } from "@/lib/project-actions";
import { cn } from "@/lib/utils";

export type MomentumView = {
  id: string;
  name: string;
  areaName: string;
  areaColor: string;
  status: string;
  priority: string;
  /** Preformatted server-side — see components/studio/types.ts. */
  touchedLabel: string;
  idle: number;
  openTasks: number;
  cadenceDays: number | null;
  drifting: boolean;
};

/**
 * Section 4 of Today. Not a list of projects — a list of *how each project is
 * doing*, which is why it leads with time-since-touched rather than the name.
 */
export function Momentum({ projects }: { projects: MomentumView[] }) {
  return (
    <div className="flex flex-col gap-2">
      {projects.map((project) => (
        <Row key={project.id} project={project} />
      ))}
    </div>
  );
}

function Row({ project }: { project: MomentumView }) {
  const [pending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "rounded-tile bg-inset p-3 transition-opacity duration-(--duration-base)",
        pending && "pointer-events-none opacity-45",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: project.areaColor }}
        />
        <Link
          href="/projects"
          className="truncate text-[13px] font-medium text-ink hover:text-accent"
        >
          {project.name}
        </Link>
        {/* One badge, not two. `main` is the tier that changes how you read
            the row; `side` is the default and saying so on every other row is
            noise. A simmering project says that instead — it's the louder fact. */}
        {project.status === "simmering" ? (
          <span className="shrink-0 rounded-full bg-inset px-2 py-0.5 text-[10px] font-medium text-muted">
            simmering
          </span>
        ) : project.priority === "main" ? (
          <span className="shrink-0 rounded-full bg-obsidian px-2 py-0.5 text-[10px] font-medium text-white">
            main
          </span>
        ) : null}
        <span
          className={cn(
            "ml-auto shrink-0 text-[11px] tabular-nums",
            project.drifting ? "font-medium text-warn" : "text-faint",
          )}
        >
          {project.touchedLabel}
        </span>
      </div>

      <p className="mt-1 text-[11px] text-faint">
        {project.openTasks} open {project.openTasks === 1 ? "task" : "tasks"}
        {project.cadenceDays !== null && ` · every ${project.cadenceDays}d`}
      </p>

      {/* `drifting` already implies active — see getMomentum. */}
      {project.drifting && (
        <div className="mt-2 flex items-center gap-2">
          <p className="min-w-0 flex-1 text-[11px] leading-snug text-warn">
            Past its cadence by{" "}
            {project.idle - (project.cadenceDays ?? 0)}d.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => setProjectStatus(project.id, "simmering"))
            }
            className="shrink-0 rounded-chip bg-card px-2.5 py-1 text-[11px] text-muted shadow-card transition-colors duration-(--duration-quick) hover:text-ink"
          >
            Let it simmer
          </button>
        </div>
      )}
    </div>
  );
}
