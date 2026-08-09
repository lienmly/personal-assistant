"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { MontblancDrawer } from "@/components/montblanc/montblanc-drawer";
import { IconRail } from "@/components/shell/icon-rail";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { Sidebar, type SidebarArea } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export type ShellUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/**
 * How far past the top the stage has to be scrolled before the chrome is
 * allowed to hide at all. Below this the header is still overlapping the first
 * card, so hiding it would look like a flinch rather than a decision.
 */
const HIDE_BELOW = 72;

/**
 * How much a scroll has to travel in one direction before the chrome reacts.
 * Small deltas accumulate rather than being thrown away, so a slow drag still
 * gets there — it just doesn't flicker on the way.
 */
const TRAVEL = 12;

/**
 * The frame every authenticated surface renders inside: a rounded panel
 * floating on the warm canvas, holding the icon rail, the area sidebar and a
 * scrolling stage. On phones the rail becomes a bottom tab bar and the sidebar
 * becomes a drawer — same information architecture, different shape.
 *
 * On phones the topbar and the tab bar also **get out of the way**: together
 * they are ~120px of a ~670px viewport, so nearly a fifth of the screen is
 * permanently spent on chrome that is mostly ornament (the search is disabled,
 * the date is hidden below `lg`). Scrolling down slides both away; any scroll
 * up brings them straight back, which is the rule that makes it safe — the tab
 * bar is the *only* navigation on a phone, so it can never be more than one
 * flick from reach.
 *
 * Both are overlays rather than rows in the flow, so hiding them reclaims
 * viewport rather than reflowing the document under your thumb.
 */
export function AppShell({
  user,
  todayLabel,
  areas,
  children,
}: {
  user: ShellUser;
  todayLabel: string;
  areas: SidebarArea[];
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [montblancOpen, setMontblancOpen] = useState(false);
  const [chromeHidden, setChromeHidden] = useState(false);
  const stageRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  // Ctrl/⌘+K from anywhere, which is what makes Montblanc quicker than walking
  // to the screen you wanted. Registered here rather than in the drawer for the
  // obvious reason: the drawer does not exist until this fires.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      setMontblancOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Arriving on a new surface always shows the chrome again. Without this a
  // link followed from halfway down Today lands you on a page that may not
  // scroll at all, with the tab bar stuck off-screen and no way to summon it.
  // Adjusting state during render is React's own answer here; the alternative —
  // a `setChromeHidden(false)` inside an effect — is what the compiler's lint
  // (rightly) refuses. See §9.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setChromeHidden(false);
  }

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let last = stage.scrollTop;

    // No rAF coalescing: Chrome already dispatches at most one scroll event per
    // frame, and the setter is handed a boolean that is usually unchanged,
    // which React bails out of before rendering. A frame queue here would be
    // machinery guarding against nothing.
    const onScroll = () => {
      const y = stage.scrollTop;
      const travelled = y - last;

      // Under the threshold the last reading is *kept* rather than banked, so a
      // slow drag accumulates toward it instead of being repeatedly discarded.
      if (Math.abs(travelled) < TRAVEL) return;

      last = y;
      setChromeHidden(travelled > 0 && y > HIDE_BELOW);
    };

    stage.addEventListener("scroll", onScroll, { passive: true });
    return () => stage.removeEventListener("scroll", onScroll);
  }, []);

  // The drawer covers the stage, so a hidden topbar underneath it is both
  // invisible and pointless to keep hidden — and closing the drawer should not
  // leave you looking for the menu button you just used.
  const hidden = chromeHidden && !menuOpen;

  return (
    <div className="h-dvh bg-canvas md:p-4">
      <div className="flex h-full overflow-hidden bg-shell md:rounded-[2rem] md:shadow-float">
        <IconRail onOpenMontblanc={() => setMontblancOpen(true)} />
        <Sidebar
          areas={areas}
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            user={user}
            todayLabel={todayLabel}
            hidden={hidden}
            onOpenMenu={() => setMenuOpen(true)}
            onOpenMontblanc={() => setMontblancOpen(true)}
          />
          <main
            ref={stageRef}
            className="flex-1 overflow-y-auto bg-stage px-4 pb-28 pt-[4.75rem] md:rounded-tl-[2rem] md:px-8 md:pb-10 md:pt-6"
          >
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar hidden={hidden} />

      {/* Outside the frame, like every other panel: it is `fixed`, and the frame
          is `overflow-hidden`. Unmounted when closed, so each open is a fresh
          sheet rather than yesterday's conversation. */}
      {montblancOpen && (
        <MontblancDrawer onClose={() => setMontblancOpen(false)} />
      )}
    </div>
  );
}
