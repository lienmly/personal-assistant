/*
 * Clan Centurio's service worker.
 *
 * It does deliberately little. Two jobs:
 *
 *   1. Make the app installable. A manifest alone gets you an icon; a service
 *      worker with a fetch handler is what makes browsers offer to install.
 *   2. Replace the browser's offline error with a page that looks like the app.
 *
 * What it very deliberately does **not** do is cache the app itself. Every
 * surface here is a server-rendered view of a database that changes as you use
 * it — a cache-first shell would show you last Tuesday's tasks and let you tick
 * them, and "why is it showing me the wrong thing" is a far worse problem than
 * "it needs signal". So: navigations go to the network, and the cache is only
 * consulted when the network has actually failed.
 *
 * Auth is the other reason to keep the surface small. Nothing here touches a
 * non-GET request, an /api route or anything cross-origin, so no session, no
 * upload and no server action can ever be served from a cache.
 */

const CACHE = "centurio-shell-v1";
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // Take over immediately rather than waiting for every tab to close. Safe
      // here precisely because this worker owns no app content: there is no
      // older cached version for a new worker to disagree with.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only page loads, and only ours. Everything else — assets, server actions,
  // the auth callback, the journal's media route — goes straight to the network
  // as though this worker did not exist.
  if (request.method !== "GET") return;
  if (request.mode !== "navigate") return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL, { ignoreSearch: true }).then(
        (cached) =>
          cached ??
          new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          }),
      ),
    ),
  );
});
