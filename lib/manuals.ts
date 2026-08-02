import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The app's own manuals — how to use the Studio, how a sprint works, what the
 * three things on the calendar grid are.
 *
 * **These are files, not rows, and that is deliberate.** Project docs live in
 * Postgres because they get written from a phone at 3am and a doc you can only
 * edit by committing to git is a doc you never update. A manual is the exact
 * opposite: it describes how the code behaves, so it changes *in the same
 * commit as the code*, written by whoever changed the calendar. Put it in the
 * database and it can drift from the code with nothing to catch it, and
 * updating it needs a seed edit — which is the failure CLAUDE.md §6 spent a
 * whole section on.
 *
 * So: two sources, one reader. The Docs surface renders both through the same
 * markdown component; only these are read-only.
 *
 * Registered explicitly rather than globbed over `/docs`, so that the title and
 * the order are curated and a new file dropped in the folder doesn't quietly
 * appear in the app's help before anyone meant it to.
 */
export type Manual = {
  slug: string;
  /** The `/docs` filename. */
  file: string;
  title: string;
  blurb: string;
};

export const MANUALS: Manual[] = [
  {
    slug: "sprints",
    file: "sprints.md",
    title: "The weekly loop",
    blurb:
      "Plan on the Hunt Board, work from Today, and what happens to whatever you didn’t finish.",
  },
  {
    slug: "studio",
    file: "studio-guide.md",
    title: "Using the Studio",
    blurb:
      "Brands, channels, drops and series — batching a week, and the two kinds of repurposing.",
  },
  {
    slug: "calendar",
    file: "calendar.md",
    title: "The calendar",
    blurb:
      "Bars, squares and dots; repeating events and what editing one actually changes.",
  },
  {
    slug: "docs",
    file: "docs-surface.md",
    title: "Where the writing lives",
    blurb:
      "Project docs versus these manuals, filing one, and the two things saving a doc doesn’t do.",
  },
];

export function findManual(slug: string): Manual | undefined {
  return MANUALS.find((manual) => manual.slug === slug);
}

/**
 * Returns null rather than throwing when the file isn't there.
 *
 * Railway builds from the repo root with Nixpacks, so `/docs` ships with the
 * app — but this is the one thing here that depends on the *deployment shape*
 * rather than on the database, and a missing manual should degrade to a line of
 * explanatory text, not a 500 on a surface whose whole job is being readable.
 */
export async function readManual(manual: Manual): Promise<string | null> {
  try {
    return await readFile(
      path.join(process.cwd(), "docs", manual.file),
      "utf8",
    );
  } catch {
    return null;
  }
}
