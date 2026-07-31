"use client";

import { useState } from "react";

import { IconRail } from "@/components/shell/icon-rail";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export type ShellUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/**
 * The frame every authenticated surface renders inside: a rounded panel
 * floating on the warm canvas, holding the icon rail, the area sidebar and a
 * scrolling stage. On phones the rail becomes a bottom tab bar and the sidebar
 * becomes a drawer — same information architecture, different shape.
 */
export function AppShell({
  user,
  todayLabel,
  children,
}: {
  user: ShellUser;
  todayLabel: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="h-dvh bg-canvas md:p-4">
      <div className="flex h-full overflow-hidden bg-shell md:rounded-[2rem] md:shadow-float">
        <IconRail />
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            user={user}
            todayLabel={todayLabel}
            onOpenMenu={() => setMenuOpen(true)}
          />
          <main className="flex-1 overflow-y-auto bg-stage px-4 pb-28 pt-6 md:rounded-tl-[2rem] md:px-8 md:pb-10">
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}
