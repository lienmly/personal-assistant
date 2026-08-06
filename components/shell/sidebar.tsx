"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, Plus, Settings2, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type SidebarArea = {
  id: string;
  slug: string;
  name: string;
  color: string;
  projects: { id: string; name: string; slug: string }[];
};

/**
 * The sidebar is the tree, not a second set of destinations. Areas cut across
 * every surface, so this panel stays put while the rail switches what you're
 * looking at.
 *
 * **An area name is a link as of 2026-08-05.** It used to be a filter toggle
 * that nothing read — selecting one was cosmetic, and had been since Phase 1.
 * Now that an area is something you can open (`/areas/[slug]` — journal, docs,
 * tasks), the name goes where the name of a project already goes, and the
 * pretend filter is gone rather than left sitting next to a real control doing
 * nothing.
 */
export function Sidebar({
  areas,
  open,
  onClose,
}: {
  areas: SidebarArea[];
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-scrim md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[264px] shrink-0 flex-col bg-shell px-4 py-5 transition-transform duration-200 md:static md:z-auto md:w-[236px] md:translate-x-0 md:px-2 md:pl-0",
          open ? "translate-x-0 shadow-float" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-3">
          <button
            type="button"
            className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight text-ink"
          >
            Clan Centurio
            <ChevronDown className="size-4 text-faint" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-card md:hidden"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between px-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
            Areas
          </span>
          <button
            type="button"
            disabled
            title="Adding areas arrives in Phase 2"
            aria-label="Add area"
            className="grid size-5 place-items-center rounded-full text-faint"
          >
            <Plus className="size-3.5" strokeWidth={2.4} />
          </button>
        </div>

        <nav aria-label="Areas" className="flex-1 overflow-y-auto">
          {areas.map((area) => {
            const projects = area.projects;
            const isCollapsed = collapsed[area.id];
            const here = pathname === `/areas/${area.slug}`;

            return (
              <div key={area.id} className="mb-0.5">
                <div className="group flex items-center">
                  <Link
                    href={`/areas/${area.slug}`}
                    onClick={onClose}
                    aria-current={here ? "page" : undefined}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2.5 rounded-chip px-3 py-2 text-left text-sm transition-colors duration-(--duration-quick)",
                      here
                        ? "bg-card font-medium text-ink shadow-card"
                        : "text-ink/80 hover:text-ink",
                    )}
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: area.color }}
                    />
                    <span className="truncate">{area.name}</span>
                  </Link>
                  {projects.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggle(area.id)}
                      aria-label={
                        isCollapsed
                          ? `Expand ${area.name}`
                          : `Collapse ${area.name}`
                      }
                      className="grid size-6 place-items-center rounded-full text-faint hover:text-muted"
                    >
                      <ChevronDown
                        className={cn(
                          "size-3.5 transition-transform",
                          isCollapsed && "-rotate-90",
                        )}
                        strokeWidth={2.4}
                      />
                    </button>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="tree-branch ml-[18px] pl-3">
                    {projects.length > 0 ? (
                      projects.map((project) => {
                        // Added 2026-08-05, with the Projects surface. A
                        // project page used to light the "Projects" icon in
                        // the rail; with that surface gone, nothing said where
                        // you were, and a project page is not any of the four
                        // remaining surfaces to claim.
                        const here =
                          pathname === `/projects/${project.slug}`;
                        return (
                          <Link
                            key={project.id}
                            href={`/projects/${project.slug}`}
                            onClick={onClose}
                            aria-current={here ? "page" : undefined}
                            className={cn(
                              "block truncate rounded-chip px-3 py-1.5 text-[13px] transition-colors duration-(--duration-quick)",
                              here
                                ? "bg-card font-medium text-ink shadow-card"
                                : "text-muted hover:text-ink",
                            )}
                          >
                            {project.name}
                          </Link>
                        );
                      })
                    ) : (
                      <div className="px-3 py-1.5 text-[13px] text-faint">
                        No projects yet
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <button
          type="button"
          disabled
          title="Area settings arrive in Phase 2"
          className="mt-4 flex items-center gap-2 px-3 py-2 text-[13px] text-faint"
        >
          <Settings2 className="size-4" strokeWidth={1.8} />
          Manage areas
        </button>
      </aside>
    </>
  );
}
