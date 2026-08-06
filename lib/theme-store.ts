/**
 * The theme, as an external store.
 *
 * Browser-only — every function here touches `window`, and nothing calls them
 * during a server render (`ThemeProvider` reaches them through
 * `useSyncExternalStore`, which uses a separate server snapshot).
 *
 * It is a store rather than a pile of `useState` + `useEffect` because the
 * three things that decide the theme are all genuinely *outside* React:
 * localStorage holds what you picked, the system clock decides whether the sun
 * is down, and geolocation says where the sun is being watched from. React's
 * job is to render the answer, not to own it — so the store computes, and
 * components subscribe.
 *
 * See CLAUDE.md §11.
 */

import { solarState, type Coords } from "@/lib/sun";
import {
  COORDS_KEY,
  COORDS_TTL_MS,
  FALLBACK_COORDS,
  GEO_DENIED_KEY,
  MODE_KEY,
  NEXT_KEY,
  THEME_KEY,
  isThemeMode,
  type CachedCoords,
  type Theme,
  type ThemeMode,
} from "@/lib/theme";

export type ThemeSnapshot = {
  /** What you picked. */
  mode: ThemeMode;
  /** What that resolves to right now. */
  theme: Theme;
  /** When `auto` next flips, and to what. Null unless `auto`. */
  next: { at: Date; kind: "sunrise" | "sunset" } | null;
  /** Whether sun times come from the browser's location or the fallback. */
  located: boolean;
};

/**
 * What the server renders with, and therefore what the client's *first* render
 * must also produce. `auto`/`light` are the boot script's own defaults, so the
 * markup agrees and hydration has nothing to reconcile; the real answer arrives
 * on the first commit.
 */
const SERVER_SNAPSHOT: ThemeSnapshot = {
  mode: "auto",
  theme: "light",
  next: null,
  located: false,
};

const listeners = new Set<() => void>();

let snapshot: ThemeSnapshot | null = null;
let coords: Coords = FALLBACK_COORDS;
let located = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

// ---------------------------------------------------------------------------
// storage
// ---------------------------------------------------------------------------

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Private mode, quota, storage disabled. The app still works — it just
       forgets between visits. Never worth breaking a render over. */
  }
}

function readMode(): ThemeMode {
  const stored = read(MODE_KEY);
  return isThemeMode(stored) ? stored : "auto";
}

function readCachedCoords(): Coords | null {
  const raw = read(COORDS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedCoords;
    if (
      typeof parsed?.lat !== "number" ||
      typeof parsed?.lon !== "number" ||
      typeof parsed?.at !== "number" ||
      Date.now() - parsed.at > COORDS_TTL_MS
    ) {
      return null;
    }
    return { lat: parsed.lat, lon: parsed.lon };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// computing and publishing
// ---------------------------------------------------------------------------

/**
 * Re-read every external input before computing.
 *
 * Storage is the single source of truth, not the module-level cache: a location
 * granted in one tab is written to localStorage and announced by a `storage`
 * event, and the tab receiving that event has to actually go and look. Holding
 * `coords` in memory and only ever filling it once meant every recompute — the
 * hourly heartbeat, the focus listener, the cross-tab event — silently reused
 * whatever the first render happened to find.
 */
function readInputs() {
  const cached = readCachedCoords();
  coords = cached ?? FALLBACK_COORDS;
  located = cached !== null;
}

function compute(mode: ThemeMode): ThemeSnapshot {
  if (mode !== "auto") {
    return { mode, theme: mode, next: null, located };
  }
  const sun = solarState(new Date(), coords);
  return {
    mode,
    theme: sun.night ? "dark" : "light",
    next: { at: sun.next, kind: sun.nextKind },
    located,
  };
}

function same(a: ThemeSnapshot, b: ThemeSnapshot): boolean {
  return (
    a.mode === b.mode &&
    a.theme === b.theme &&
    a.located === b.located &&
    (a.next?.at.getTime() ?? 0) === (b.next?.at.getTime() ?? 0)
  );
}

/**
 * Recompute and, only if something actually moved, publish.
 *
 * The identity check is load-bearing rather than an optimisation:
 * `useSyncExternalStore` compares snapshots by reference and will loop forever
 * if handed a fresh object every read. The hourly heartbeat calls this on a
 * quiet afternoon and it must be a no-op.
 */
function refresh() {
  readInputs();
  const nextSnapshot = compute(readMode());

  if (!snapshot || !same(snapshot, nextSnapshot)) {
    snapshot = nextSnapshot;

    // The boot script reads both of these on the next load to paint the right
    // theme before React exists. `next` is zeroed outside `auto` so it can
    // never be trusted while nothing is maintaining it.
    write(THEME_KEY, nextSnapshot.theme);
    write(NEXT_KEY, String(nextSnapshot.next?.at.getTime() ?? 0));

    listeners.forEach((listener) => listener());
  }

  schedule();
}

/**
 * Wake at the next crossing — but never sleep more than an hour at a stretch.
 *
 * A twelve-hour timer set at breakfast is not a promise anyone keeps: laptops
 * suspend, phones freeze background tabs, and browsers throttle `setTimeout`
 * hard once a tab is hidden. An hourly heartbeat re-derives the answer from the
 * clock rather than trusting a timer to have fired, and the visibility and
 * focus listeners cover the rest.
 */
function schedule() {
  if (timer) clearTimeout(timer);
  if (!started || !snapshot) return;

  const until = snapshot.next
    ? snapshot.next.at.getTime() - Date.now()
    : Number.POSITIVE_INFINITY;

  timer = setTimeout(refresh, Math.max(1_000, Math.min(until, 60 * 60 * 1000)));
}

function onExternalChange() {
  refresh();
}

function onVisible() {
  if (document.visibilityState === "visible") refresh();
}

function start() {
  started = true;
  // `storage` fires in *other* tabs, so switching to Dark on the desktop
  // settles both windows rather than leaving one behind.
  window.addEventListener("storage", onExternalChange);
  window.addEventListener("focus", onExternalChange);
  document.addEventListener("visibilitychange", onVisible);
  schedule();
}

function stop() {
  started = false;
  window.removeEventListener("storage", onExternalChange);
  window.removeEventListener("focus", onExternalChange);
  document.removeEventListener("visibilitychange", onVisible);
  if (timer) clearTimeout(timer);
  timer = null;
}

// ---------------------------------------------------------------------------
// the store interface
// ---------------------------------------------------------------------------

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) start();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

export function getSnapshot(): ThemeSnapshot {
  if (!snapshot) {
    readInputs();
    snapshot = compute(readMode());
  }
  return snapshot;
}

export function getServerSnapshot(): ThemeSnapshot {
  return SERVER_SNAPSHOT;
}

export function setMode(mode: ThemeMode) {
  write(MODE_KEY, mode);
  refresh();
}

/**
 * Ask the browser where it is, once, and cache the answer.
 *
 * Only called in `auto`: a pinned light or dark theme has no use for sun times,
 * so there would be no honest reason to ask for a location to compute them
 * from. A refusal is remembered, because a dashboard opened twenty times a day
 * must not ask twenty times a day — the fallback is close enough that nagging
 * would cost more than the accuracy is worth.
 */
export function ensureLocation() {
  if (located) return;
  if (read(GEO_DENIED_KEY) === "1") return;
  if (typeof navigator === "undefined" || !navigator.geolocation) return;

  const request = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Written to storage and then re-read by `refresh`, rather than
        // assigned here — one path in, so a location found in this tab and one
        // arriving from another are handled by the same code.
        write(
          COORDS_KEY,
          JSON.stringify({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            at: Date.now(),
          }),
        );
        refresh();
      },
      () => {
        write(GEO_DENIED_KEY, "1");
      },
      // A low-accuracy fix is plenty. Sunset moves by four minutes per degree
      // of longitude, so a block-accurate position and a city-accurate one give
      // the same answer — and asking for less does not wake a phone's GPS.
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: COORDS_TTL_MS },
    );
  };

  // Where the browser will tell us the permission is already settled, honour
  // that rather than triggering a prompt to find out.
  if (navigator.permissions?.query) {
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (status.state === "denied") {
          write(GEO_DENIED_KEY, "1");
          return;
        }
        request();
      })
      .catch(request);
  } else {
    request();
  }
}
