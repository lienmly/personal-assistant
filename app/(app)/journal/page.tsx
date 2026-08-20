import Link from "next/link";
import { notFound } from "next/navigation";

import { Journal } from "@/components/areas/journal";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { db } from "@/lib/db";
import {
  GLOBAL_JOURNAL_LIMIT,
  getGlobalJournal,
  getJournalOwners,
  getLastJournalOwner,
} from "@/lib/journal";
import { cn, todayKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Journal · Clan Centurio" };

/**
 * Every journal, on one thread.
 *
 * The journal was already there — on the Baby area, on each project — and it was
 * already the right noun (CLAUDE.md §6, "The Baby area is a journal, not a
 * backlog"). What was missing is the thing it is actually for: **the day.** A
 * Tuesday is not about the baby or about Sleepy Cat, it is a Tuesday, and
 * reading one back meant opening five pages and merging them in your head.
 *
 * So this is not a new feature, it is the same rows with the room dividers taken
 * out. The component is the one the area and project pages use — a day still
 * runs as one thread from morning to night, the composer is still the last node
 * of today, and you still cannot write into a day that has gone. The two things
 * a global view has to add are both about *which* journal a row belongs to: an
 * owner chip on each entry, and a picker on the composer.
 *
 * **Area is a filter here, never a tab** — §6 again, and for the reason given
 * there: a nav entry per area is a list that grows forever and makes you recall
 * which bucket a thing lives in. Filtering to an area includes its projects,
 * because that is what an area means everywhere else in this app.
 */
export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string }>;
}) {
  const query = await searchParams;

  const areas = await db.area.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, name: true, color: true },
  });

  // An unknown slug is a 404 rather than a silent fall-back to everything: a
  // filter that quietly ignores itself is one you trust once and then stop
  // trusting, and "these are all the Baby entries" is exactly the claim it would
  // be making wrongly.
  const selected = query.area
    ? areas.find((area) => area.slug === query.area)
    : undefined;
  if (query.area && !selected) notFound();

  const today = todayKey();

  const [days, owners, lastOwner] = await Promise.all([
    getGlobalJournal({ areaId: selected?.id }, today),
    getJournalOwners(),
    getLastJournalOwner(),
  ]);

  const total = days.reduce((count, day) => count + day.entries.length, 0);

  // **The picker starts on the filter when one is on.** You filtered to Baby to
  // read about her; the entry you are about to write is about her too, and
  // defaulting to wherever the last entry went would file it somewhere you are
  // not even looking. With no filter the last owner is the better guess — see
  // `getLastJournalOwner`.
  const preferred = selected
    ? `area:${selected.id}`
    : (lastOwner ?? owners[0]?.value ?? "");

  return (
    <>
      <SurfaceHeader
        title="Journal"
        tagline="What happened, everywhere, in the order it happened"
        meta={
          total > 0
            ? `${total} ${total === 1 ? "entry" : "entries"}${selected ? " here" : ""}`
            : undefined
        }
      />

      {/* Pills on the tinted ground, the same control the Ledger and the board
          use. "Everything" is first and is the default, so the surface opens on
          the thing it exists to show. */}
      <nav className="mb-5 flex flex-wrap gap-1.5 rounded-chip bg-inset p-1 sm:w-fit">
        <FilterPill href="/journal" active={!selected} label="Everything" />
        {areas.map((area) => (
          <FilterPill
            key={area.id}
            href={`/journal?area=${area.slug}`}
            active={selected?.id === area.id}
            label={area.name}
            color={area.color}
          />
        ))}
      </nav>

      {owners.length === 0 ? (
        // Unreachable with a seeded database, but a journal with nowhere to file
        // an entry would otherwise render a composer whose picker is empty and
        // whose save always fails.
        <p className="rounded-tile bg-inset px-6 py-10 text-center text-[13px] text-muted">
          There are no areas yet, so there is nowhere to file an entry.
        </p>
      ) : (
        <Journal
          filing={{ choose: owners, preferred }}
          ownerName={selected ? selected.name : "any part of your life"}
          days={days}
        />
      )}

      {/* Said out loud rather than left as a Tuesday that stops mid-day. The cap
          is in `lib/journal.ts` with the reasoning; this is the surface keeping
          its half of that bargain. */}
      {total >= GLOBAL_JOURNAL_LIMIT && (
        <p className="mt-4 text-center text-[12.5px] text-faint">
          {`Showing the most recent ${GLOBAL_JOURNAL_LIMIT} entries. Older ones are still on their area and project pages.`}
        </p>
      )}
    </>
  );
}

function FilterPill({
  href,
  active,
  label,
  color,
}: {
  href: string;
  active: boolean;
  label: string;
  color?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-chip px-4 py-2 text-[13px] transition-[background-color,color] duration-(--duration-base) ease-soft active:scale-[0.97]",
        // The selected-pill exception in §9: a segmented control needs a filled
        // state, and it is small enough not to spend the screen's black budget.
        active ? "bg-obsidian font-medium text-white" : "text-muted hover:text-ink",
      )}
    >
      {color && (
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ background: color }}
        />
      )}
      {label}
    </Link>
  );
}
