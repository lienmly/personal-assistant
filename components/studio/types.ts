import type {
  ChannelPostState,
  ChannelState,
  DropFormat,
  DropStage,
  Platform,
} from "@prisma/client";

/**
 * Plain view types for the client components. Deliberately not re-exports of
 * the query's inferred return type — those pull `lib/db` into the module graph,
 * and the board is a client bundle.
 */

export type ChannelView = {
  id: string;
  platform: Platform;
  handle: string;
  label: string | null;
  state: ChannelState;
};

export type BrandView = {
  id: string;
  name: string;
  slug: string;
  color: string;
  channels: ChannelView[];
};

export type ProjectView = { id: string; name: string; slug: string };

export type DropChannelView = {
  id: string;
  state: ChannelPostState;
  publishedUrl: string | null;
  channel: {
    id: string;
    platform: Platform;
    handle: string;
    label: string | null;
  };
};

export type DropView = {
  id: string;
  title: string;
  notes: string | null;
  body: string | null;
  /** The post this one is based on — the viral TikTok being reproduced. */
  refUrl: string | null;
  format: DropFormat;
  stage: DropStage;
  publishAt: string | null;
  /** "YYYY-MM-DD" when this drop fills a series slot, else null. */
  slotDate: string | null;
  /** Preformatted on the server. Formatting dates in the client causes a
   *  hydration mismatch — Node's ICU and the browser's disagree on separators
   *  ("Fri 31 Jul" vs "Fri, 31 Jul"), and `new Date()` drifts between them. */
  publishLabel: string | null;
  isToday: boolean;
  brand: { id: string; name: string; slug: string; color: string };
  project: ProjectView | null;
  series: { id: string; name: string } | null;
  sourceDropId: string | null;
  channels: DropChannelView[];
};

/** One row of the batch composer: a dated series slot, waiting to be filled. */
export type BatchSlotView = {
  id: string;
  title: string;
  refUrl: string | null;
  /** "YYYY-MM-DD" — the grouping key, zone-free. */
  slotDate: string;
  dayLabel: string;
  isToday: boolean;
  isPast: boolean;
  stage: DropStage;
  brandId: string;
  seriesName: string;
  channels: { id: string; platform: Platform; handle: string; label: string | null }[];
};
