import { DocLibrary } from "@/components/docs/doc-library";
import { DocMarkdown } from "@/components/docs/markdown";
import { DocReader } from "@/components/docs/doc-reader";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { getDoc, getDocLibrary, getFilingOptions } from "@/lib/docs";
import { MANUALS, findManual, readManual } from "@/lib/manuals";

export const metadata = { title: "Docs · Clan Centurio" };
export const dynamic = "force-dynamic";

/**
 * The reading surface. Two panes on a wide screen, master-then-detail on a
 * phone.
 *
 * What is open lives in the URL — `?doc=`, `?manual=`, `?new=1` — the same
 * choice the calendar made for its view and cursor. It costs nothing and it
 * means a link to Sleepy Cat's northstar is a link, which is most of the point
 * of docs being in the app at all.
 *
 * Two sources feed one reader: Doc rows out of Postgres (writable) and the
 * app's own manuals off disk (read-only). See `lib/manuals.ts` for why they are
 * stored differently.
 */
export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const docId = one("doc") ?? null;
  const manualSlug = one("manual") ?? null;
  const creating = one("new") === "1";

  const [areas, filing] = await Promise.all([
    getDocLibrary(),
    getFilingOptions(),
  ]);

  // A stale `?doc=` — a deleted doc, a pasted old link — falls back to the
  // empty state rather than 404ing the whole surface.
  const doc = docId ? await getDoc(docId) : null;
  const manual = manualSlug ? findManual(manualSlug) : undefined;
  const manualBody = manual ? await readManual(manual) : null;

  const showingSomething = Boolean(doc) || Boolean(manual) || creating;
  const docCount = areas.reduce(
    (total, area) =>
      total + area.groups.reduce((sum, group) => sum + group.docs.length, 0),
    0,
  );

  return (
    <>
      <SurfaceHeader
        title="Docs"
        tagline="Vision, northstar and strategy — the thinking a task list can’t hold."
        meta={`${docCount} doc${docCount === 1 ? "" : "s"}`}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        {/* `minmax(0, …)` on both tracks, not `1fr` — a long doc title has a
            large min-content width and would otherwise push the reading pane
            off its share. CLAUDE.md §9. */}
        <DocLibrary
          areas={areas}
          manuals={MANUALS}
          selectedDocId={doc?.id ?? null}
          selectedManual={manual?.slug ?? null}
          className={showingSomething ? "hidden lg:block" : ""}
        />

        <div
          className={
            showingSomething
              ? "rounded-card bg-card p-5 shadow-card md:p-7"
              : "hidden rounded-card bg-card p-5 shadow-card lg:block md:p-7"
          }
        >
          {manual ? (
            <article key={manual.slug} className="animate-rise">
              <span className="text-[12px] text-muted">
                Using Clan Centurio
              </span>
              <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight text-ink md:text-[30px]">
                {manual.title}
              </h1>
              <p className="mt-1.5 text-xs text-faint">
                Part of the app, not of a project — so it’s read-only here and
                edited alongside the code.
              </p>
              <div className="mt-7">
                {manualBody ? (
                  <DocMarkdown>{manualBody}</DocMarkdown>
                ) : (
                  <p className="text-sm text-faint">
                    This manual didn’t ship with the running build — it lives at{" "}
                    <code>docs/{manual.file}</code> in the repo.
                  </p>
                )}
              </div>
            </article>
          ) : (
            <DocReader
              // Keyed so switching between docs remounts the editor rather than
              // carrying the previous body into it.
              key={doc?.id ?? (creating ? "new" : "empty")}
              doc={doc}
              filing={filing}
              startEditing={creating}
              initialProjectId={one("project") ?? null}
              initialAreaId={one("area") ?? null}
            />
          )}
        </div>
      </div>
    </>
  );
}
