"use client";

import { useEffect } from "react";

/**
 * Registers `public/sw.js`.
 *
 * Renders nothing. It exists because a service worker is what turns an
 * installed page into something the browser treats as an app — the install
 * prompt asks for one, and without it an offline launch is the browser's own
 * error page rather than ours.
 *
 * Registration is deliberately late (`load`) and unconditional. Late, because
 * nothing on the first paint depends on it and the fetch would otherwise
 * compete with the page's own; unconditional, because the worker is a no-op for
 * anything but a failed navigation, so there is nothing for it to break in dev
 * that it would not equally break in production — which is the version worth
 * finding out about.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unregistered worker costs the install prompt and the offline page.
        // It does not cost the app, so there is nothing to tell anyone about.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
