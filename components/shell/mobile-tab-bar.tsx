"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SURFACES } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** The same surfaces as the desktop rail — identical IA, different shape. */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Surfaces"
      className="fixed inset-x-0 bottom-0 z-20 flex items-stretch justify-around border-t border-line bg-shell/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {SURFACES.map((surface) => {
        const active =
          pathname === surface.href || pathname.startsWith(`${surface.href}/`);
        const Icon = surface.icon;

        return (
          <Link
            key={surface.href}
            href={surface.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              active ? "text-accent" : "text-faint",
            )}
          >
            <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
            <span className="truncate">{surface.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
