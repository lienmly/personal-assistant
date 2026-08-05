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
