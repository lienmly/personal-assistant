import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CalendarDays,
  Clapperboard,
  FolderKanban,
  Sunrise,
  Swords,
} from "lucide-react";

/**
 * The surfaces from CLAUDE.md §6. This list is deliberately fixed —
 * navigation is by verb and time, never one entry per life area. Areas are a
 * filter that cuts across all of these. Ledger arrives in Phase 6 without
 * disturbing anything here.
 *
 * Docs joined the original five rather than hiding behind a help icon: it holds
 * the projects' vision and strategy, not just the app's manuals, so it is a
 * place you go to read on purpose. It sorts last because it is the one you open
 * weekly rather than hourly.
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
  {
    href: "/board",
    label: "Hunt Board",
    icon: Swords,
    tagline: "Every open mark, by project",
  },
  {
    href: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
    tagline: "Events, due dates and drops on one timeline",
  },
  {
    href: "/studio",
    label: "Studio",
    icon: Clapperboard,
    tagline: "Content moving toward publication",
  },
  {
    href: "/projects",
    label: "Projects",
    icon: FolderKanban,
    tagline: "The roster, and how much momentum each one has",
  },
  {
    href: "/docs",
    label: "Docs",
    icon: BookOpen,
    tagline: "Vision, strategy, and how this dashboard works",
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
