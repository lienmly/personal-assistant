import type { LucideIcon } from "lucide-react";
import {
  BookHeart,
  CalendarDays,
  Clapperboard,
  Landmark,
  Sunrise,
} from "lucide-react";

/**
 * The surfaces from CLAUDE.md §6. This list is deliberately fixed —
 * navigation is by verb and time, never one entry per life area. Areas are a
 * filter that cuts across all of these.
 *
 * **Ledger arrived in Phase 6, and it cost exactly this**: one entry. The line
 * that used to sit here predicted it would ("a further surface arrives in Phase
 * 6 without disturbing anything"), and §6 called that the test the whole
 * information architecture was built to pass. It passed — the icon rail, the
 * mobile tab bar and `surfaceForPath` all read this array, so none of them
 * changed.
 *
 * **Projects came off on 2026-08-05.** It was the roster — a list of every
 * project with its counts and last-touched date — and once Today was rebuilt
 * project-first the day before, it was that same list a nav item away. Project
 * *pages* are untouched and still live at `/projects/[slug]`; they are reached
 * from the cards on Today and from the sidebar tree, which is where you were
 * already going for them. The roster's own jobs — create, edit, archive — moved
 * onto Today's cards, so nothing lost a home.
 *
 * **Journal arrived on 2026-08-19, and it is a verb surface rather than an area
 * one.** The journal already existed on every area and every project; what did
 * not exist was the day. "What happened on Tuesday" is not a question about the
 * baby or about Sleepy Cat, and answering it meant opening five pages and
 * merging them by eye. This entry is the merge — the same rows, one thread — so
 * it obeys §6 rather than bending it: navigation by verb and time, with area as
 * a filter across the top.
 */
export type Surface = {
  href: string;
  label: string;
  icon: LucideIcon;
  tagline: string;
};

export const SURFACES: Surface[] = [
  {
    href: "/today",
    label: "Today",
    icon: Sunrise,
    tagline: "What needs you right now",
  },
  // **Hunt Board is hidden as of 2026-08-28**, and this is a *hiding*, not a
  // retirement — the surface is untouched and `/board` still resolves, so
  // anything already linking there (the calendar's task chips, Montblanc's
  // receipts, `revalidatePath`) keeps working. It came off the rail because it
  // was not being opened: Today's project cards and a project page's Tasks tab
  // answer "what is left" from inside the project, which is the context you
  // wanted anyway, and the board's own job — every open task at once — is the
  // one nobody was asking for. Put the entry back and it returns to the rail,
  // the tab bar and the manifest's shortcuts with nothing else to change.
  // {
  //   href: "/board",
  //   label: "Hunt Board",
  //   icon: Swords,
  //   tagline: "Every open task, by project",
  // },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
    tagline: "What actually happens at a time. Everything else is a layer.",
  },
  {
    href: "/journal",
    label: "Journal",
    icon: BookHeart,
    tagline: "What happened, everywhere, in the order it happened",
  },
  {
    href: "/studio",
    label: "Social Media",
    icon: Clapperboard,
    tagline: "Content moving toward publication",
  },
  {
    href: "/ledger",
    label: "Ledger",
    icon: Landmark,
    tagline: "What you have, what you owe, and what April will cost",
  },
];

// Areas and Projects now live in Postgres — see prisma/schema.prisma. The
// sidebar receives them from the layout; nothing about them is hardcoded here
// any more.

export function surfaceForPath(pathname: string): Surface | undefined {
  return SURFACES.find(
    (surface) =>
      pathname === surface.href || pathname.startsWith(`${surface.href}/`),
  );
}
