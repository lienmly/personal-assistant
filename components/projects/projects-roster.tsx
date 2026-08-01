"use client";

import { useState } from "react";
import { FolderKanban, Plus } from "lucide-react";

import { ProjectPanel } from "@/components/projects/project-panel";
import type { AreaOption, ProjectRowView } from "@/components/projects/types";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const STATUSES = [
  { id: "active", label: "Active", tone: "bg-good" },
  { id: "simmering", label: "Simmering", tone: "bg-warn" },
  { id: "paused", label: "Paused", tone: "bg-faint" },
  { id: "archived", label: "Archived", tone: "bg-line" },
] as const;

/**
 * The roster, and the only place a project can be created or re-tiered.
 *
 * Until this existed, adding a project meant editing `prisma/seed.ts` and
 * re-running the seed — which is not a thing that happens from a phone at 3am,
 * so projects got invented in the wrong place instead (every Coding Mom setup
 * task lived under Sleepy Cat for a week).
 */
export function ProjectsRoster({
  projects,
  areas,
}: {
  projects: ProjectRowView[];
  areas: AreaOption[];
}) {
  const [filter, setFilter] = useState<string | null>(null);
  // `undefined` = closed. `null` = open on a new project. A project = editing.
  const [editing, setEditing] = useState<ProjectRowView | null | undefined>(
    undefined,
  );

  const counts = Object.fromEntries(
    STATUSES.map((status) => [
      status.id,
      projects.filter((project) => project.status === status.id).length,
    ]),
  );

  const shown = filter
    ? projects.filter((project) => project.status === filter)
    : projects;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {STATUSES.map((status) => {
          const selected = filter === status.id;
          return (
            <button
              key={status.id}
              type="button"
              onClick={() => setFilter(selected ? null : status.id)}
              className={cn(
                "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-[0.97]",
                selected
                  ? "bg-obsidian text-white"
                  : "bg-card text-muted shadow-card hover:text-ink",
              )}
            >
              <span className={`size-2 rounded-full ${status.tone}`} />
              {status.label}
              <span className={selected ? "text-white/40" : "text-faint"}>
                {counts[status.id] ?? 0}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setEditing(null)}
          className="ml-auto flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
        >
          <Plus className="size-3.5" strokeWidth={2.4} />
          New project
        </button>
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title={filter ? `Nothing ${filter}` : "No projects yet"}
            body={
              filter
                ? "Clear the filter to see the rest of the roster."
                : "A project is the thing you're actually pushing forward. Every mark and every drop hangs off one, and each carries a last-touched date so the quiet ones can't hide."
            }
            className="py-16"
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((project, index) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setEditing(project)}
              style={{ animationDelay: `${index * 40}ms` }}
              className="animate-rise rounded-card bg-card p-4 text-left shadow-card transition-[transform,box-shadow] duration-(--duration-base) ease-soft hover:-translate-y-px active:scale-[0.985]"
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: project.areaColor }}
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
                  {project.areaName}
                </span>
              </div>

              {project.description && (
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted">
                  {project.description}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-faint">
                <span>
                  {project.openMarks} open{" "}
                  {project.openMarks === 1 ? "mark" : "marks"}
                </span>
                <span>·</span>
                <span>{project.drops} drops</span>
                <span>·</span>
                <span
                  className={
                    project.drifting ? "font-medium text-warn" : undefined
                  }
                >
                  {project.touchedLabel}
                </span>
                {project.cadenceDays !== null && (
                  <>
                    <span>·</span>
                    <span>every {project.cadenceDays}d</span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {editing !== undefined && (
        <ProjectPanel
          key={editing?.id ?? "new"}
          project={editing}
          areas={areas}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
