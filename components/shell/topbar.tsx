"use client";

import Image from "next/image";
import { Bell, LogOut, Menu } from "lucide-react";

import { MoogleMark } from "@/components/brand/moogle-mark";
import { signOutAction } from "@/lib/actions";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { cn } from "@/lib/utils";
import type { ShellUser } from "@/components/shell/app-shell";

/**
 * On a phone this is an overlay pinned to the top of the viewport, not a row
 * above the stage — so `AppShell` can slide it away on scroll without the
 * document reflowing under your thumb. That costs it a fixed 64px height (the
 * stage's `pt` is the other half of the deal) and an opaque background, since
 * content now passes underneath it. From `md` up it is a flex row again and
 * never hides: there is no shortage of screen there.
 */
export function Topbar({
  user,
  todayLabel,
  hidden,
  onOpenMenu,
  onOpenMontblanc,
}: {
  user: ShellUser;
  todayLabel: string;
  hidden: boolean;
  onOpenMenu: () => void;
  onOpenMontblanc: () => void;
}) {
  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-20 flex h-16 items-center gap-3 bg-shell/95 px-4 backdrop-blur transition-transform duration-(--duration-base)",
        "md:static md:h-auto md:translate-y-0 md:bg-transparent md:px-6 md:py-4 md:backdrop-blur-none",
        hidden ? "-translate-y-full ease-exit" : "translate-y-0 ease-soft",
      )}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-muted shadow-card md:hidden"
      >
        <Menu className="size-5" strokeWidth={1.8} />
      </button>

      {/* Montblanc took the search pill's place, and that is the point rather
          than a convenience. This was the widest element on a phone and it was
          *disabled* — a control doing nothing, occupying the room every other
          control was competing for. Asking for something in a sentence is also
          strictly more than searching for it: "what's overdue" is a search, and
          "add a bug to Sleepy Cat" is not one anybody could have typed here. */}
      <button
        type="button"
        onClick={onOpenMontblanc}
        title="Ask Montblanc  ·  Ctrl+K"
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-full bg-card px-5 py-3 text-left shadow-card transition-[background-color] duration-(--duration-quick) ease-soft hover:bg-inset md:max-w-xl"
      >
        <MoogleMark className="size-4 shrink-0 text-muted" />
        <span className="truncate text-sm text-faint">Ask Montblanc…</span>
        <kbd className="ml-auto hidden shrink-0 rounded-chip bg-inset px-1.5 py-0.5 text-[10px] font-medium text-faint transition-colors duration-(--duration-quick) group-hover:bg-line md:block">
          Ctrl K
        </kbd>
      </button>

      <span className="ml-auto hidden text-sm text-muted lg:block">
        {todayLabel}
      </span>

      <ThemeToggle />

      <button
        type="button"
        disabled
        aria-label="Notifications — arrive in Phase 7"
        title="Notifications arrive in Phase 7"
        className="hidden size-10 place-items-center rounded-full bg-card text-faint shadow-card md:grid"
      >
        <Bell className="size-4.5" strokeWidth={1.8} />
      </button>

      <div className="flex shrink-0 items-center gap-1 rounded-full bg-card p-1 pl-1 shadow-card">
        {user.image ? (
          <Image
            src={user.image}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-obsidian text-[11px] font-semibold text-white">
            {initials}
          </span>
        )}
        <span className="hidden max-w-[9rem] truncate px-1.5 text-sm font-medium text-ink sm:block">
          {user.name ?? user.email}
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="grid size-8 place-items-center rounded-full text-faint transition-colors hover:bg-inset hover:text-accent"
          >
            <LogOut className="size-4" strokeWidth={1.9} />
          </button>
        </form>
      </div>
    </header>
  );
}
