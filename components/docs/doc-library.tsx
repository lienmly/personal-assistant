"use client";

import Link from "next/link";
import { BookOpen, FileText, LifeBuoy, Plus } from "lucide-react";

import type { DocAreaGroup } from "@/lib/docs";
import type { Manual } from "@/lib/manuals";
import { cn } from "@/lib/utils";

/**
 * The left column: everything readable, grouped the way the sidebar is.
 *
 * On a phone this is the whole screen until you pick something — the reader
 * takes over and a back link brings you here. Two panes side by side at 800px
 * of width would give the reader forty characters a line, which is not reading.
 */
export function DocLibrary({
  areas,
  manuals,
  selectedDocId,
  selectedManual,
  className,
}: {
  areas: DocAreaGroup[];
  manuals: Manual[];
  selectedDocId: string | null;
  selectedManual: string | null;
  className?: string;
}) {
  return (
    <nav aria-label="Documents" className={cn("space-y-6", className)}>
      {areas.map((area, areaIndex) => (
        <div
          key={area.id}
          className="animate-rise"
          style={{ animationDelay: `${areaIndex * 40}ms` }}
        >
          <div className="mb-2 flex items-center gap-2 px-1">
            <span
              className="size-2 rounded-full"
              style={{ background: area.color }}
            />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              {area.name}
            </h2>
          </div>

          <div className="space-y-3">
            {area.groups.map((group) => (
              <div key={group.projectId ?? "area"}>
                <div className="flex items-center justify-between gap-2 px-1">
                  <span
                    className={cn(
                      "truncate text-[13px] font-medium",
                      group.archived ? "text-faint" : "text-ink",
                    )}
                  >
                    {group.name}
                  </span>
                  <Link
                    href={{
                      pathname: "/docs",
                      query: {
                        new: "1",
                        ...(group.projectId
                          ? { project: group.projectId }
                          : { area: area.id }),
                      },
                    }}
                    aria-label={`New doc in ${group.projectId ? group.name : area.name}`}
                    title={`New doc in ${group.projectId ? group.name : area.name}`}
                    // Always visible, not `group-hover` — CLAUDE.md §9 says a
                    // hover-revealed control doesn't exist on a phone, and here
                    // it's worse than that: most rows start empty, so hiding
                    // the plus leaves a bare project name with no way in and
                    // nothing to explain it. Kept at `text-faint` so a column
                    // of them reads as texture rather than as ten buttons.
                    className="grid size-6 shrink-0 place-items-center rounded-full text-faint transition-[background-color,color,transform] duration-(--duration-quick) hover:bg-inset hover:text-ink active:scale-[0.9]"
                  >
                    <Plus className="size-3.5" strokeWidth={2} />
                  </Link>
                </div>

                {group.docs.length === 0 ? null : (
                  <ul className="mt-1 space-y-0.5">
                    {group.docs.map((doc) => {
                      const active = doc.id === selectedDocId;
                      return (
                        <li key={doc.id}>
                          <Link
                            href={{ pathname: "/docs", query: { doc: doc.id } }}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "block rounded-tile px-2.5 py-2 transition-[background-color,transform] duration-(--duration-base) ease-soft active:scale-[0.985]",
                              active
                                ? "bg-card shadow-card"
                                : "hover:bg-card/60",
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <FileText
                                className={cn(
                                  "size-3.5 shrink-0",
                                  active ? "text-accent" : "text-faint",
                                )}
                                strokeWidth={1.8}
                              />
                              <span className="truncate text-[13px] text-ink">
                                {doc.title}
                              </span>
                              {doc.kind && (
                                <span className="ml-auto shrink-0 rounded-full bg-inset px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-muted">
                                  {doc.kind}
                                </span>
                              )}
                            </span>
                            {doc.excerpt && (
                              <span className="mt-0.5 block truncate pl-[22px] text-xs text-faint">
                                {doc.excerpt}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* The manuals. Pinned last and visually set apart, because they are
          documentation *of the dashboard* rather than of anything in it — a
          different kind of thing that happens to be read the same way. */}
      <div
        className="animate-rise rounded-card bg-inset p-3"
        style={{ animationDelay: `${areas.length * 40}ms` }}
      >
        <div className="mb-2 flex items-center gap-2 px-1">
          <LifeBuoy className="size-3.5 text-faint" strokeWidth={1.8} />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            Using Clan Centurio
          </h2>
        </div>
        <ul className="space-y-0.5">
          {manuals.map((manual) => {
            const active = manual.slug === selectedManual;
            return (
              <li key={manual.slug}>
                <Link
                  href={{
                    pathname: "/docs",
                    query: { manual: manual.slug },
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "block rounded-tile px-2.5 py-2 transition-[background-color,transform] duration-(--duration-base) ease-soft active:scale-[0.985]",
                    active ? "bg-card shadow-card" : "hover:bg-card/60",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <BookOpen
                      className={cn(
                        "size-3.5 shrink-0",
                        active ? "text-accent" : "text-faint",
                      )}
                      strokeWidth={1.8}
                    />
                    <span className="truncate text-[13px] text-ink">
                      {manual.title}
                    </span>
                  </span>
                  <span className="mt-0.5 block pl-[22px] text-xs leading-snug text-faint">
                    {manual.blurb}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
