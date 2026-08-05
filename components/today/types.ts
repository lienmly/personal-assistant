import type { ChannelPostState, ContentStage, Platform } from "@prisma/client";

import type { SubtaskView } from "@/components/board/types";
import type { ProjectEditView } from "@/components/projects/types";

/** Plain view types — the Today lists are client components, so they must not
 *  pull `lib/db` into the bundle. Same rule as studio/ and board/. */

/** Why a task sits near the top of its project's card. Drives the badge only —
 *  since 2026-08-04 there is no cross-project ranking to drive. */
export type TaskReason = "doing" | "overdue" | "today" | "soon" | "open";

export type TaskLineView = {
  id: string;
  title: string;
  link: string | null;
  track: string | null;
  status: string;
  /** Preformatted server-side; formatting dates in the client hydrates wrong.
   *  Null when the task has no due date at all. */
  dueLabel: string | null;
  reason: TaskReason;
  areaColor: string;
  /** "Wed & Sun", "Daily" — null for a one-off. A repeating row has to say so:
   *  ticking it moves it to its next day rather than finishing it. */
  repeatLabel: string | null;
  /** `"none"` unless this row repeats. Today needs it for one thing only:
   *  ticking the last checklist box finishes the job, and a recurring job
   *  re-arms and stays on the screen rather than folding away. */
  recurrence: string;
  /** The steps this job is done in. Expanded on Today — this is the surface
   *  you are on to tick things off, not to survey them. */
  subtasks: SubtaskView[];
};

/** One project, as Today shows it: the focus line and the few rows that are
 *  most worth seeing. The unit of this screen. */
export type ProjectBoardView = {
  id: string;
  name: string;
  slug: string;
  /** What it's aiming at right now. Falls back to `description` on the card
   *  when unwritten, so a project without one is still legible. */
  focus: string | null;
  description: string | null;
  priority: string;
  areaName: string;
  areaColor: string;
  /** "3d ago" — folded in from the retired Momentum card. */
  touchedLabel: string;
  drifting: boolean;
  /** What the pencil opens. Null on the "One-offs" pseudo-project, which has
   *  no row behind it to edit. */
  edit: ProjectEditView | null;
  tasks: TaskLineView[];
  openTotal: number;
  overdue: number;
};

/** One cell of the contribution map. `count: -1` marks a day in the future,
 *  which is drawn as a gap rather than as a zero. */
export type HeatDay = { key: string; count: number };

export type DoneTodayView = {
  id: string;
  title: string;
  projectName: string | null;
  track: string | null;
  color: string;
};

export type GoingOutChannelView = {
  id: string;
  state: ChannelPostState;
  platform: Platform;
  handle: string;
  label: string | null;
};

export type GoingOutView = {
  id: string;
  title: string;
  stage: ContentStage;
  /** "18:00" — the time it's meant to go out. */
  timeLabel: string;
  brandName: string;
  brandColor: string;
  projectName: string | null;
  seriesName: string | null;
  channels: GoingOutChannelView[];
};
