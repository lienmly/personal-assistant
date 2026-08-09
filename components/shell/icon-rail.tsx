"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MoogleMark } from "@/components/brand/moogle-mark";
import { SURFACES } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function IconRail({
  onOpenMontblanc,
}: {
  onOpenMontblanc: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Surfaces"
      className="hidden w-[76px] shrink-0 flex-col items-center gap-1.5 py-5 md:flex"
    >
      <Link
        href="/today"
        aria-label="Clan Centurio"
        className="mb-5 grid size-11 place-items-center rounded-full bg-obsidian text-white"
      >
        <MoogleMark className="size-6" />
      </Link>

      {SURFACES.map((surface) => {
        const active =
          pathname === surface.href || pathname.startsWith(`${surface.href}/`);
        const Icon = surface.icon;

        return (
          <Link
            key={surface.href}
            href={surface.href}
            title={surface.label}
            aria-label={surface.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "grid size-11 place-items-center rounded-full transition-colors",
              active
                ? "bg-accent text-white shadow-float"
                : "bg-card text-muted shadow-card hover:text-ink",
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
          </Link>
        );
      })}

      {/* Not a surface, which is why it sits apart at the foot rather than in
          the list above: the rail is the four fixed surfaces (§6), and Montblanc
          is a drawer over whichever one you are on. The mark rather than an icon,
          because it is the only control here that is a *who*. */}
      <button
        type="button"
        onClick={onOpenMontblanc}
        title="Ask Montblanc  ·  Ctrl+K"
        aria-label="Ask Montblanc"
        className="mt-auto grid size-11 place-items-center rounded-full bg-card text-muted shadow-card ring-1 ring-accent/20 transition-[background-color,color] duration-(--duration-quick) ease-soft hover:bg-inset hover:text-ink"
      >
        <MoogleMark className="size-5" />
      </button>
    </nav>
  );
}
