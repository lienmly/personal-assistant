import type { MetadataRoute } from "next";

/**
 * The web app manifest — what turns the Railway URL into something you install
 * once and then open from the home screen, with no address bar and no URL to
 * remember.
 *
 * Next serves this at `/manifest.webmanifest` and links it from every page.
 * `proxy.ts` has to let it through unauthenticated: the browser fetches it
 * *before* you sign in, and a manifest that redirects to /login is a manifest
 * that fails to parse, which silently costs you the install prompt.
 *
 * Three decisions worth keeping:
 *
 * 1. `start_url` is `/today`, not `/`. Opening the app should land on the
 *    screen it exists for. `/` only ever redirects there anyway, so this saves
 *    a round trip on the slowest moment there is — a cold launch.
 * 2. `display: "standalone"` rather than `fullscreen`. The OS status bar stays,
 *    which is what you want on a dashboard you check for ten seconds; going
 *    fullscreen would hide the clock and the battery on an app whose whole
 *    subject is what time it is.
 * 3. Both icon purposes are supplied. Android masks a home-screen icon to the
 *    launcher's shape, and an "any" icon fed into that mask gets its corners
 *    shaved off; the maskable copy is drawn smaller so the mark survives it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/today",
    name: "Clan Centurio",
    short_name: "Centurio",
    description:
      "A private personal assistant dashboard, with Montblanc at its heart.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // The warm greige canvas, so the splash screen is the app's own colour
    // rather than a white flash. `theme_color` is the light theme's shell; the
    // provider swaps the live <meta> at sunset (see ThemeProvider).
    background_color: "#e5e1de",
    theme_color: "#f1efec",
    categories: ["productivity", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Long-press the home-screen icon and jump straight to a surface. The four
    // in the tab bar minus Today, which is where the icon already goes.
    shortcuts: [
      {
        name: "Hunt Board",
        short_name: "Board",
        url: "/board",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Calendar",
        short_name: "Calendar",
        url: "/calendar",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Social Media",
        short_name: "Social",
        url: "/studio",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
