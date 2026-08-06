/**
 * The filter presets offered by the journal's camera.
 *
 * Deliberately **colour grades, not face filters.** Dog ears and sparkles need a
 * face-landmark model shipped into the page and tracked per frame, which is a
 * build of its own; these are a CSS filter string, which the browser applies to
 * the live preview and the canvas applies when baking the frame — the same
 * string in both places, so what you saw is what gets stored.
 *
 * Client-safe: no Prisma import, the same rule `lib/tracks.ts` follows.
 */

export type JournalFilter = {
  id: string;
  label: string;
  /**
   * A CSS `filter` function list. Used verbatim as the preview element's
   * `filter` and as the canvas context's `ctx.filter`, which is what keeps the
   * preview honest — one value, two consumers, no second implementation to
   * drift.
   */
  css: string;
  /**
   * How hard to darken the corners, 0–1. Not expressible as a `filter`
   * function, so it is drawn as a radial gradient over the baked frame and laid
   * over the preview as a gradient overlay.
   */
  vignette: number;
};

export const JOURNAL_FILTERS: JournalFilter[] = [
  { id: "none", label: "None", css: "none", vignette: 0 },
  {
    id: "warm",
    label: "Warm",
    css: "saturate(1.2) sepia(0.16) contrast(1.04)",
    vignette: 0,
  },
  {
    id: "faded",
    label: "Faded",
    css: "contrast(0.86) saturate(0.8) brightness(1.1)",
    vignette: 0,
  },
  {
    id: "mono",
    label: "Mono",
    css: "grayscale(1) contrast(1.1)",
    vignette: 0,
  },
  {
    id: "dreamy",
    label: "Dreamy",
    css: "saturate(1.12) brightness(1.06) contrast(0.94)",
    vignette: 0.5,
  },
];

export const DEFAULT_FILTER = JOURNAL_FILTERS[0];

export function filterById(id: string): JournalFilter {
  return JOURNAL_FILTERS.find((entry) => entry.id === id) ?? DEFAULT_FILTER;
}

/** The overlay that stands in for `vignette` in the live preview. */
export function vignetteCss(strength: number): string | undefined {
  if (strength <= 0) return undefined;
  return `radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,${strength}) 100%)`;
}

/** The same darkening, drawn onto a canvas after the frame. */
export function drawVignette(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  strength: number,
) {
  if (strength <= 0) return;

  const gradient = context.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.22,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(1, `rgba(0,0,0,${strength})`);

  // `ctx.filter` is still set from drawing the frame; a filter applied to a flat
  // gradient is at best wasted work and at worst tints the darkening.
  const previous = context.filter;
  context.filter = "none";
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.filter = previous;
}

/**
 * Whether this browser can bake a filter into a canvas at all.
 *
 * `CanvasRenderingContext2D.filter` arrived late in Safari. Where it is missing
 * the assignment is silently ignored, so the preview would show a warm, faded
 * photo and the stored one would come out untouched — a worse outcome than not
 * offering the filters, because you only find out after the moment has passed.
 * The picker is hidden when this returns false.
 */
export function canBakeFilters(): boolean {
  if (typeof document === "undefined") return false;
  if (bakeCache === null) {
    const context = document.createElement("canvas").getContext("2d");
    bakeCache = !!context && "filter" in context;
  }
  return bakeCache;
}

/** Answered once per browser. This is read as a `useSyncExternalStore` snapshot,
 *  which is called on every render — allocating a canvas each time to ask a
 *  question with a fixed answer would be silly. Nothing caches the server's
 *  `false`, which is a fact about there being no `document` rather than about
 *  the browser. */
let bakeCache: boolean | null = null;
