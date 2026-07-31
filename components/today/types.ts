import type { ChannelPostState, DropStage, Platform } from "@prisma/client";

/** Plain view types — the Today lists are client components, so they must not
 *  pull `lib/db` into the bundle. Same rule as studio/ and board/. */

export type DueMarkView = {
  id: string;
  title: string;
  link: string | null;
  track: string | null;
  /** Preformatted server-side; formatting dates in the client hydrates wrong. */
  dueLabel: string;
  overdue: boolean;
  projectName: string | null;
  areaColor: string;
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
