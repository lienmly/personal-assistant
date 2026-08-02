import { db } from "@/lib/db";
import { kindRank } from "@/lib/doc-kinds";

/**
 * Reads for the Docs surface.
 *
 * The library is grouped the way the sidebar is — Area, then the projects
 * inside it — because that is the tree already in your head. A flat
 * most-recently-edited list would be easier to build and would answer "where is
 * Forge's vision" with a scroll.
 */

export type DocSummary = {
  id: string;
  title: string;
  kind: string | null;
  updatedAt: Date;
  /** First line or so of the body, for the list. Empty for an empty doc. */
  excerpt: string;
};

export type DocGroup = {
  /** The project this group is for, or null for the area's own docs. */
  projectId: string | null;
  name: string;
  /** `archived` projects still appear, greyed — the docs outlive the work. */
  archived: boolean;
  docs: DocSummary[];
};

export type DocAreaGroup = {
  id: string;
  name: string;
  color: string;
  groups: DocGroup[];
};

/**
 * Strips markdown down to a plain first sentence for the list rows.
 *
 * Deliberately crude — headings, emphasis and link syntax off the front, take
 * what's left. Running the real parser to produce eighty characters of preview
 * would cost more than the preview is worth.
 */
function excerptOf(body: string): string {
  const line = body
    .split("\n")
    .map((raw) => raw.trim())
    .find(
      (raw) =>
        raw.length > 0 && !raw.startsWith("#") && !raw.startsWith("---"),
    );
  if (!line) return "";
  const flat = line
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links and images → their text
    .replace(/[*_`>]/g, "")
    .trim();
  return flat.length > 120 ? `${flat.slice(0, 119).trimEnd()}…` : flat;
}

function summarise(doc: {
  id: string;
  title: string;
  kind: string | null;
  body: string;
  updatedAt: Date;
}): DocSummary {
  return {
    id: doc.id,
    title: doc.title,
    kind: doc.kind,
    updatedAt: doc.updatedAt,
    excerpt: excerptOf(doc.body),
  };
}

/** Vision first, then the rest of the known kinds, then anything invented. */
function byKindThenTitle(a: DocSummary, b: DocSummary): number {
  const rank = kindRank(a.kind) - kindRank(b.kind);
  return rank !== 0 ? rank : a.title.localeCompare(b.title);
}

export async function getDocLibrary(): Promise<DocAreaGroup[]> {
  const areas = await db.area.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      projects: {
        orderBy: [{ priority: "asc" }, { sortOrder: "asc" }],
        select: { id: true, name: true, status: true },
      },
      docs: {
        select: {
          id: true,
          title: true,
          kind: true,
          body: true,
          updatedAt: true,
          projectId: true,
        },
      },
    },
  });

  return areas.map((area) => {
    // One pass over the area's docs rather than a query per project: the whole
    // library is a few dozen rows, and N+1 across five areas is not worth it.
    const byProject = new Map<string | null, DocSummary[]>();
    for (const doc of area.docs) {
      const key = doc.projectId;
      const list = byProject.get(key) ?? [];
      list.push(summarise(doc));
      byProject.set(key, list);
    }

    const groups: DocGroup[] = [];

    // The area's own docs lead, and the row is emitted **even when empty** —
    // "Baby" has no projects and never will, so a row that only appeared once
    // it had a doc would leave no way to write the first one.
    groups.push({
      projectId: null,
      name: "Area notes",
      archived: false,
      docs: (byProject.get(null) ?? []).sort(byKindThenTitle),
    });

    for (const project of area.projects) {
      const docs = byProject.get(project.id) ?? [];
      // A project with no docs still gets a row: it is the invitation to write
      // one, and an empty library that hides every project is a dead end.
      groups.push({
        projectId: project.id,
        name: project.name,
        archived: project.status === "archived",
        docs: docs.sort(byKindThenTitle),
      });
    }

    return { id: area.id, name: area.name, color: area.color, groups };
  });
}

export type DocDetail = {
  id: string;
  title: string;
  kind: string | null;
  body: string;
  updatedAt: Date;
  areaId: string;
  areaName: string;
  areaColor: string;
  projectId: string | null;
  projectName: string | null;
};

export async function getDoc(id: string): Promise<DocDetail | null> {
  const doc = await db.doc.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      kind: true,
      body: true,
      updatedAt: true,
      areaId: true,
      projectId: true,
      area: { select: { name: true, color: true } },
      project: { select: { name: true } },
    },
  });
  if (!doc) return null;

  return {
    id: doc.id,
    title: doc.title,
    kind: doc.kind,
    body: doc.body,
    updatedAt: doc.updatedAt,
    areaId: doc.areaId,
    areaName: doc.area.name,
    areaColor: doc.area.color,
    projectId: doc.projectId,
    projectName: doc.project?.name ?? null,
  };
}

/** Docs for one project, for the list on the project panel. */
export async function getProjectDocs(projectId: string): Promise<DocSummary[]> {
  const docs = await db.doc.findMany({
    where: { projectId },
    select: { id: true, title: true, kind: true, body: true, updatedAt: true },
  });
  return docs.map(summarise).sort(byKindThenTitle);
}

/** Everywhere a doc can be filed, for the editor's two selects. */
export type FilingOptions = {
  areas: { id: string; name: string }[];
  projects: { id: string; name: string; areaId: string }[];
};

export async function getFilingOptions(): Promise<FilingOptions> {
  const [areas, projects] = await Promise.all([
    db.area.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    db.project.findMany({
      orderBy: [{ areaId: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, areaId: true },
    }),
  ]);
  return { areas, projects };
}
