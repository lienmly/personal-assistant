"use client";

import Link from "next/link";
import { useState } from "react";
import { FolderKanban, Pencil, Plus } from "lucide-react";

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
                : "A project is the thing you're actually pushing forward. Every task and every piece of social media content hangs off one, and each carries a last-touched date so the quiet ones can't hide."
            }
            className="py-16"
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {shown.map((project, index) => (
            // The card opens the project; the pencil opens the editor. Before
            // project pages existed, tapping a card *was* the editor — which
            // made the roster the only way in and the settings form the first
            // thing you saw of a project.
            <div
              key={project.id}
              style={{ animationDelay: `${index * 40}ms` }}
              className="group relative animate-rise rounded-card bg-card p-4 shadow-card transition-[transform,box-shadow] duration-(--duration-base) ease-soft hover:-translate-y-px"
            >
              <button
                type="button"
                onClick={() => setEditing(project)}
                aria-label={`Edit ${project.name}`}
                // Visible outright on touch, revealed on hover on a pointer
                // device — CLAUDE.md §9. A hover-only control does not exist
                // on a phone.
                className="absolute right-3 top-3 z-10 grid size-7 place-items-center rounded-full bg-inset text-faint transition-[background-color,color,opacity] duration-(--duration-quick) hover:text-ink active:scale-90 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Pencil className="size-3.5" strokeWidth={2} />
              </button>

              <Link
                href={`/projects/${project.slug}`}
                className="absolute inset-0 rounded-card"
                aria-label={`Open ${project.name}`}
              />

              <div className="flex items-center gap-2 pr-8">
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
                <span className="ml-auto hidden shrink-0 text-[11px] text-faint sm:block">
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
                  {project.openTasks} open{" "}
                  {project.openTasks === 1 ? "task" : "tasks"}
                </span>
                <span>·</span>
                <span>{project.items} items</span>
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
            </div>
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
