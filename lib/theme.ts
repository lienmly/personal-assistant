/**
 * Theme mode, and the storage keys the pre-paint script and the provider agree
 * on.
 *
 * Client-safe — no Prisma, no server-only API. The theme is deliberately *not*
 * a database column: it is a property of the screen you are looking at rather
 * than of you, and a phone at 9pm and a desktop at 9am want different answers
 * from the same account. localStorage is the honest home for that.
 *
 * See CLAUDE.md §11.
 */

import type { Coords } from "@/lib/sun";

/** What you asked for. `auto` is the sun-following default. */
export type ThemeMode = "auto" | "light" | "dark";

/** What is actually on screen once `auto` has been resolved. */
export type Theme = "light" | "dark";

export const MODE_KEY = "cc:theme-mode";
export const THEME_KEY = "cc:theme";
export const NEXT_KEY = "cc:theme-next";
export const COORDS_KEY = "cc:coords";
export const GEO_DENIED_KEY = "cc:geo-denied";

/**
 * Where the sun is assumed to be until the browser says otherwise — Los
 * Angeles, matching the `TZ` the deployed app is meant to run on (see
 * CLAUDE.md, Environment notes).
 *
 * This is a *fallback*, not an assertion: it is used before the location
 * permission is answered, and forever after if it is declined. Sunset moves by
 * about four minutes per degree of longitude, so being a timezone out shifts
 * the switch by under an hour — wrong, but wrong in a way you would struggle to
 * notice, which is the correct amount of wrong for a fallback.
 */
export const FALLBACK_COORDS: Coords = { lat: 34.0522, lon: -118.2437 };

/** How long a cached location is trusted before it is looked up again. */
export const COORDS_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type CachedCoords = Coords & { at: number };

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === "auto" || value === "light" || value === "dark";
}

/**
 * The script that runs before first paint.
 *
 * It exists for one reason: without it the page renders light, hydrates, and
 * *then* flips to dark — a white flash on every single navigation at night,
 * which is worse than having no dark mode at all.
 *
 * It deliberately does **not** contain the solar arithmetic. Re-running two
 * hundred lines of NOAA equations in a render-blocking script, on every page
 * load, to answer a question whose answer has not changed since the last page
 * load, is work for nothing. Instead the provider leaves behind the answer it
 * computed *and the instant it stops being true*, and this script only has to
 * read a clock:
 *
 *   - before that instant  → the stored answer still holds
 *   - just past it         → the crossings alternate, so flip it once
 *   - long past it         → too many crossings to count; guess by the hour
 *     and let the provider correct it a frame later
 *
 * Written as a string rather than a function so it can be inlined verbatim by
 * the root layout. Keep it small, keep it in a try/catch: a browser with
 * localStorage disabled must still render the app, just always in light.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var d=document.documentElement;
var m=localStorage.getItem(${JSON.stringify(MODE_KEY)})||"auto";
var t;
if(m==="light"||m==="dark"){t=m;}else{
var s=localStorage.getItem(${JSON.stringify(THEME_KEY)});
var n=parseInt(localStorage.getItem(${JSON.stringify(NEXT_KEY)})||"0",10);
var now=Date.now();
if(s&&n&&now<n){t=s;}
else if(s&&n&&now-n<43200000){t=s==="dark"?"light":"dark";}
else{var h=new Date().getHours();t=(h<6||h>=19)?"dark":"light";}}
d.dataset.theme=t;d.style.colorScheme=t;
}catch(e){}})();`;
