"use client";

import { Moon, Sun, SunMoon } from "lucide-react";

import { useTheme } from "@/components/shell/theme-provider";
import { cn } from "@/lib/utils";
import type { ThemeMode } from "@/lib/theme";

const OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "auto", label: "Auto", Icon: SunMoon },
  { mode: "dark", label: "Dark", Icon: Moon },
];

/**
 * Light · Auto · Dark, as a segmented control.
 *
 * A filled dark segment for the selection is the one place §9's "one black
 * element per screen" budget is already spent by precedent — the scope pill on
 * the Hunt Board and the active project tab both do it, because a segmented
 * control with no filled state does not read as a control. It is small enough
 * not to compete with a screen's real hero tile.
 *
 * Icon-only, and it stays visible at every breakpoint. The topbar's other two
 * ornaments (the date, the notifications bell) drop below `lg` and `md`
 * respectively because they are decoration; this one is the only escape hatch
 * from a theme you do not want right now, and hiding it on the device most
 * likely to be used at dusk would be exactly backwards.
 */
export function ThemeToggle() {
  const { mode, setMode, theme, next, located } = useTheme();

  // Rendered only once `next` exists, which is after mount — so there is
  // nothing here for the server and the client to disagree about.
  const schedule = next
    ? `${next.kind === "sunset" ? "Dark" : "Light"} at ${next.at.toLocaleTimeString(
        undefined,
        { hour: "numeric", minute: "2-digit" },
      )}`
    : null;

  const hint = [
    mode === "auto" ? "Following the sun" : `Pinned ${mode}`,
    schedule,
    located ? null : next ? "using an approximate location" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      title={hint}
      className="flex shrink-0 items-center gap-0.5 rounded-full bg-card p-1 shadow-card"
    >
      {OPTIONS.map(({ mode: option, label, Icon }) => {
        const selected = mode === option;

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={
              option === "auto" && schedule
                ? `Auto — ${schedule.toLowerCase()}`
                : label
            }
            title={option === "auto" && schedule ? schedule : label}
            onClick={() => setMode(option)}
            className={cn(
              "grid size-8 place-items-center rounded-full transition-[background-color,color,transform] duration-(--duration-quick) ease-soft active:scale-[0.92]",
              selected
                ? "bg-obsidian text-white"
                : "text-faint hover:text-ink",
            )}
          >
            <Icon className="size-4" strokeWidth={selected ? 2.1 : 1.8} />
          </button>
        );
      })}

      {/* What `auto` has currently decided, for a screen reader — the icons
          say which mode is picked, not which theme that resolved to. */}
      <span className="sr-only" aria-live="polite">
        {`${theme === "dark" ? "Dark" : "Light"} theme`}
      </span>
    </div>
  );
}
