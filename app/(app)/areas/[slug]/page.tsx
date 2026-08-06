import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Journal } from "@/components/areas/journal";
import type { AreaView } from "@/components/board/types";
import { DocsTab, type DocView } from "@/components/docs/docs-tab";
import { TaskList } from "@/components/tasks/task-list";
import { Card } from "@/components/ui/card";
import { getAreaDetail } from "@/lib/area-detail";
import { db } from "@/lib/db";
import { getJournal } from "@/lib/journal";
import { cn, todayKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** `updatedAt` is a real instant, so it formats local. The journal's own dates
 *  are `@db.Date` and format in UTC — see `lib/journal.ts`. Both rules are
 *  CLAUDE.md §6, and getting them the same way round is what renders a date a
 *  day early. */
const stampFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const TABS = ["journal", "docs", "tasks"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  journal: "Journal",
  docs: "Docs",
  tasks: "Tasks",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const area = await db.area.findUnique({
    where: { slug },
    select: { name: true },
  });
  return { title: `${area?.name ?? "Area"} · Clan Centurio` };
}

/**
 * An area, opened.
 *
 * **Journal is the default tab, not an overview.** A project page opens on
 * Overview because the question there is "where does this stand"; an area is not
 * a thing that stands anywhere, and the reason to open one is almost always to
 * write something down or read what you wrote. An overview tab here would be a
 * summary of two other tabs.
 *
 * This is not a nav surface (CLAUDE.md §6 — never one nav item per area). It is
 * reached from the sidebar tree, exactly the way `/projects/[slug]` is.
 */
export default async function AreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  const detail = await getAreaDetail(slug);
  if (!detail) notFound();

  const { area, projects, docs, tasks, openCount, entryCount } = detail;
  const tab: Tab = TABS.includes(query.tab as Tab)
    ? (query.tab as Tab)
    : "journal";
  const today = todayKey();

  // Only the active tab's heavy read runs. The journal pulls every entry and
  // its photo metadata for this area, which is the one query here that grows
  // without bound — no reason to run it to render the Docs tab.
  const [days, areas, allProjects] = await Promise.all([
    tab === "journal" ? getJournal(area.id, today) : Promise.resolve([]),
    tab === "tasks"
      ? db.area.findMany({
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, color: true },
        })
      : Promise.resolve([]),
    tab === "tasks"
      ? db.project.findMany({
          where: { status: { in: ["active", "simmering"] } },
          orderBy: [{ priority: "asc" }, { sortOrder: "asc" }],
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            priority: true,
            areaId: true,
            area: { select: { id: true, name: true, color: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const docViews: DocView[] = docs.map((doc) => ({
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    body: doc.body,
    updatedLabel: `Edited ${stampFormat.format(doc.updatedAt)}`,
  }));

  return (
    <>
      <Link
        href="/today"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        Today
      </Link>

      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ background: area.color }}
          />
          <span className="text-[12.5px] text-muted">Area</span>
        </div>
        <h1 className="text-[30px] font-semibold leading-none tracking-tight text-ink md:text-[38px]">
          {area.name}
        </h1>

        <p className="mt-2.5 text-sm text-muted">
          {[
            `${entryCount} ${entryCount === 1 ? "journal entry" : "journal entries"}`,
            `${docViews.length} ${docViews.length === 1 ? "doc" : "docs"}`,
            `${openCount} open ${openCount === 1 ? "task" : "tasks"}`,
          ].join(" · ")}
        </p>

        {/* The projects in this area, when there are any. Not a tab: a project
            has its own page and this is just the way in, the same job the
            sidebar tree does one level up. The Baby area has none by design. */}
        {projects.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.slug}`}
                className="rounded-chip bg-card px-3 py-1.5 text-[12.5px] text-muted shadow-card transition-colors duration-(--duration-quick) hover:text-ink active:scale-[0.97]"
              >
                {project.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <nav className="mb-5 flex flex-wrap gap-1.5 rounded-chip bg-inset p-1 sm:w-fit">
        {TABS.map((name) => (
          <Link
            key={name}
            href={`/areas/${area.slug}${name === "journal" ? "" : `?tab=${name}`}`}
            className={cn(
              "rounded-chip px-4 py-2 text-[13px] transition-[background-color,color] duration-(--duration-base) ease-soft",
              name === tab
                ? "bg-obsidian font-medium text-white"
                : "text-muted hover:text-ink",
            )}
          >
            {TAB_LABELS[name]}
          </Link>
        ))}
      </nav>

      {tab === "journal" && (
        <Journal
          areaId={area.id}
          areaName={area.name}
          days={days}
          today={today}
        />
      )}

      {tab === "docs" && (
        <Card>
          <DocsTab
            owner={{ areaId: area.id }}
            docs={docViews}
            emptyHint={`What you want for this part of your life, written down once so it stops being re-decided. ${area.name} keeps it here.`}
          />
        </Card>
      )}

      {tab === "tasks" && (
        <Card>
          <TaskList
            tasks={tasks}
            defaults={{ areaId: area.id }}
            projects={allProjects}
            areas={areas as AreaView[]}
            emptyHint={`Nothing open in ${area.name}. Tasks filed straight to the area — rather than to one of its projects — show up here.`}
          />
        </Card>
      )}
    </>
  );
}
