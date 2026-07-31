import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Clapperboard,
  FolderKanban,
  Sunrise,
  Swords,
} from "lucide-react";

/**
 * The five surfaces from CLAUDE.md §6. This list is deliberately fixed —
 * navigation is by verb and time, never one entry per life area. Areas are a
 * filter that cuts across all of these. A sixth surface (Ledger) arrives in
 * Phase 6 without disturbing anything here.
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
];

/**
 * Areas are coarse and near-static — roughly five, ever — so hardcoding them
 * for Phase 1 is fine. Phase 2 moves them into Postgres alongside Projects.
 */
export type Area = {
  id: string;
  name: string;
  dot: string;
};

export const AREAS: Area[] = [
  { id: "work", name: "Work", dot: "#3b6fd4" },
  { id: "hobbies", name: "Hobbies", dot: "#2f8f5b" },
  { id: "baby", name: "Baby", dot: "#d9852b" },
  { id: "home", name: "Home & Money", dot: "#6b5bd4" },
];

/**
 * PLACEHOLDER. Real projects arrive with the database in Phase 2 — these exist
 * only so the sidebar tree can be judged as a design. Delete this constant
 * (and the import in the sidebar) when Project CRUD lands.
 */
export const PLACEHOLDER_PROJECTS: Record<string, string[]> = {
  work: ["Game X", "Side app Y"],
  hobbies: ["Japanese", "Guitar"],
  baby: [],
  home: [],
};

export function surfaceForPath(pathname: string): Surface | undefined {
  return SURFACES.find(
    (surface) =>
      pathname === surface.href || pathname.startsWith(`${surface.href}/`),
  );
}
