"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

import {
  ensureLocation,
  getServerSnapshot,
  getSnapshot,
  setMode,
  subscribe,
  type ThemeSnapshot,
} from "@/lib/theme-store";
import type { ThemeMode } from "@/lib/theme";

type ThemeContextValue = ThemeSnapshot & {
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}

/**
 * Holds the theme, and in `auto` mode flips it at sunrise and sunset.
 *
 * Wraps the whole app rather than the authenticated shell, so the login page is
 * themed too — arriving at a white sign-in page at midnight and then landing on
 * a dark dashboard is exactly the flash the boot script exists to prevent, one
 * navigation earlier.
 *
 * The component itself is thin on purpose. All the deciding lives in
 * `lib/theme-store.ts`, and what is left here is the two things React is
 * actually for: reading an external store, and pushing the result back out to
 * the one external system that cannot read it itself — the `data-theme`
 * attribute on `<html>`.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Push the resolved theme onto the document. On the first commit this either
  // confirms what the boot script already painted or quietly corrects it — the
  // correction is why `<html>` carries `suppressHydrationWarning` in the root
  // layout, since the pre-paint attributes are by design not in the server's
  // markup.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = snapshot.theme;
    // Native scrollbars, form controls and date pickers follow along. Without
    // it a dark page gets white scrollbars and a blinding picker.
    root.style.colorScheme = snapshot.theme;

    // Installed on a home screen there is no browser chrome, so the OS paints
    // the status bar (and Android's nav bar) with this tag. Left static it
    // would be a light strip above a dark app all night — the one piece of the
    // window the theme does not otherwise reach.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        "content",
        snapshot.theme === "dark" ? "#1a1716" : "#f1efec",
      );
  }, [snapshot.theme]);

  // Only `auto` has any use for a location, so only `auto` asks for one.
  useEffect(() => {
    if (snapshot.mode === "auto") ensureLocation();
  }, [snapshot.mode]);

  return (
    <ThemeContext.Provider value={{ ...snapshot, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
