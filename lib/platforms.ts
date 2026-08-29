import type { ContentFormat, Platform } from "@prisma/client";

/**
 * Lucide dropped brand tasks, so channels are identified by a short lettermark
 * on the platform's own colour. Reads fine at 20px, which is the size the
 * channel row needs on a phone.
 */
export const PLATFORMS: Record<
  Platform,
  { label: string; short: string; color: string; profileUrl: (h: string) => string }
> = {
  tiktok: {
    label: "TikTok",
    short: "TT",
    color: "#010101",
    profileUrl: (h) => `https://tiktok.com/@${h}`,
  },
  instagram: {
    label: "Instagram",
    short: "IG",
    color: "#c13584",
    profileUrl: (h) => `https://instagram.com/${h}`,
  },
  youtube: {
    label: "YouTube",
    short: "YT",
    color: "#ff0000",
    profileUrl: (h) => `https://youtube.com/@${h}`,
  },
  facebook: {
    label: "Facebook",
    short: "FB",
    color: "#1877f2",
    profileUrl: (h) => `https://facebook.com/${h}`,
  },
  threads: {
    label: "Threads",
    short: "TH",
    color: "#000000",
    profileUrl: (h) => `https://threads.net/@${h}`,
  },
  x: {
    label: "X",
    short: "X",
    color: "#0f1419",
    profileUrl: (h) => `https://x.com/${h}`,
  },
  medium: {
    label: "Medium",
    short: "M",
    color: "#000000",
    profileUrl: (h) => `https://medium.com/@${h}`,
  },
  steam: {
    label: "Steam",
    short: "ST",
    color: "#1b2838",
    profileUrl: (h) => `https://store.steampowered.com/search/?term=${h}`,
  },
  reddit: {
    label: "Reddit",
    short: "RD",
    color: "#ff4500",
    // `/user/` rather than `/u/` — both resolve, but the long form is what
    // Reddit itself renders, and these URLs get pasted into a Steam store page.
    profileUrl: (h) => `https://reddit.com/user/${h}`,
  },
  other: {
    label: "Other",
    short: "··",
    color: "#8b847e",
    profileUrl: (h) => h,
  },
};

/**
 * What a destination is *called* on screen.
 *
 * A channel is a real account and its identity is a handle, but a handle is the
 * thing that made Studio unreadable — "@utaitai_jp" says nothing to anyone who
 * did not create it, and eleven of them across a board says less still. Worse,
 * a brand's handles are often *identical*: Coding Mom posts to six channels all
 * called @codingmom, so a list of handles distinguishes none of them.
 *
 * So a destination reads as its platform, disambiguated only where the platform
 * alone would be ambiguous: by the channel's own label where it has one
 * ("Japanese", "Essays"), and by the handle where it does not and the brand
 * posts to that platform twice. Every caller puts the handle on a `title`, so
 * the account is one hover away — it was demoted, not hidden.
 */
export function destinationLabel(
  channel: { platform: Platform; handle: string; label: string | null },
  all: { platform: Platform }[],
): string {
  const base = PLATFORMS[channel.platform].label;
  if (channel.label) return `${base} · ${channel.label}`;
  const twice =
    all.filter((row) => row.platform === channel.platform).length > 1;
  return twice ? `${base} · @${channel.handle}` : base;
}

export const FORMATS: Record<ContentFormat, { label: string; verb: string }> = {
  short_video: { label: "Short video", verb: "Film & edit" },
  article: { label: "Article", verb: "Write" },
  text_post: { label: "Text post", verb: "Draft" },
  image: { label: "Image", verb: "Design" },
};

/** The board, left to right. `produce` is format-neutral — see schema.prisma. */
export const STAGES = [
  { id: "idea", label: "Idea", hint: "Something worth saying" },
  { id: "script", label: "Script", hint: "Words down" },
  { id: "produce", label: "Produce", hint: "Film, write, design" },
  { id: "scheduled", label: "Scheduled", hint: "Queued to go out" },
  { id: "published", label: "Published", hint: "Live" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

/** Pipeline order, for "is this stage further along than that one". */
export const STAGE_ORDER: StageId[] = STAGES.map((stage) => stage.id);
