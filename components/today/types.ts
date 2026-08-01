import type { ChannelPostState, DropStage, Platform } from "@prisma/client";

/** Plain view types — the Today lists are client components, so they must not
 *  pull `lib/db` into the bundle. Same rule as studio/ and board/. */

/** Why a mark is on the focus list — and, in that order, how it sorts. */
export type FocusReason = "doing" | "overdue" | "today" | "sprint";

export type FocusMarkView = {
  id: string;
  title: string;
  link: string | null;
  track: string | null;
  status: string;
  /** Preformatted server-side; formatting dates in the client hydrates wrong.
   *  Null when the mark has no due date at all. */
  dueLabel: string | null;
  reason: FocusReason;
  /** False for a due mark that never made the sprint — it still belongs on the
   *  screen, but it gets the one-tap "pull it in" affordance instead. */
  inSprint: boolean;
  projectName: string | null;
  areaColor: string;
};

/** A row in "Next up" — the backlog you reach for when the sprint runs dry. */
export type NextMarkView = {
  id: string;
  title: string;
  track: string | null;
  link: string | null;
};

export type NextGroupView = {
  projectName: string;
  color: string;
  marks: NextMarkView[];
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
  stage: DropStage;
  /** "18:00" — the time it's meant to go out. */
  timeLabel: string;
  brandName: string;
  brandColor: string;
  projectName: string | null;
  seriesName: string | null;
  channels: GoingOutChannelView[];
};
