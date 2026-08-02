"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { ArrowLeft, Eye, Pencil, Trash2 } from "lucide-react";

import { DocMarkdown } from "@/components/docs/markdown";
import { DOC_KINDS } from "@/lib/doc-kinds";
import { deleteDoc, saveDoc } from "@/lib/doc-actions";
import type { DocDetail, FilingOptions } from "@/lib/docs";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";
const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-faint";

const updated = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * Reading and writing are the same pane, toggled — not a reader page and a
 * separate edit route.
 *
 * A vision doc is edited *while* being re-read, and a round trip through a
 * second URL loses your place in a two-thousand-word document every time you
 * fix a sentence.
 *
 * `doc` is null when the URL asked for a new one; `initialProjectId` /
 * `initialAreaId` then carry where it should be filed, so "new doc" from a
 * project row lands in that project rather than making you pick again.
 */
export function DocReader({
  doc,
  filing,
  startEditing = false,
  initialProjectId = null,
  initialAreaId = null,
}: {
  doc: DocDetail | null;
  filing: FilingOptions;
  startEditing?: boolean;
  initialProjectId?: string | null;
  initialAreaId?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(startEditing);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Live preview needs the body as state; everything else can stay uncontrolled
  // (`defaultValue`), which is the pattern the other panels in the app use.
  const [body, setBody] = useState(doc?.body ?? "");
  const [preview, setPreview] = useState(false);
  const [projectId, setProjectId] = useState(
    doc?.projectId ?? initialProjectId ?? "",
  );

  const formRef = useRef<HTMLFormElement>(null);

  // No effect resets this state when a different doc arrives through the URL:
  // `app/(app)/docs/page.tsx` keys this component on the doc's id, so React
  // remounts it and every `useState` initialiser above runs again. An effect
  // doing the same job by hand would be a second, slower source of truth.

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const id = await saveDoc(form);
        setEditing(false);
        // Replace rather than push: a new doc's URL is `?new=1`, and leaving
        // that in the history means Back re-opens an empty editor.
        router.replace(`/docs?doc=${id}`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save");
      }
    });
  }

  if (!doc && !startEditing) {
    return (
      <div className="grid h-full min-h-[50vh] place-items-center px-6 text-center">
        <div className="max-w-sm">
          <p className="text-[15px] font-medium text-ink">
            Nothing open yet
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Pick a doc on the left, or start one on a project. This is where the
            vision, the northstar and the strategy live — the thinking a task
            list can’t hold.
          </p>
        </div>
      </div>
    );
  }

  // The area a new doc lands in follows its project; only a doc with no project
  // needs the area select, which is the same rule `saveDoc` enforces server-side.
  const areaSelectShown = projectId === "";

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => router.push("/docs")}
          className="flex items-center gap-1.5 rounded-chip px-2 py-1.5 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.8} />
          All docs
        </button>
      </div>

      {editing ? (
        <form
          ref={formRef}
          onSubmit={submit}
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            pending && "pointer-events-none opacity-45",
          )}
        >
          {doc && <input type="hidden" name="id" value={doc.id} />}

          <input
            name="title"
            defaultValue={doc?.title ?? ""}
            placeholder="Vision"
            autoFocus
            aria-label="Title"
            className="w-full bg-transparent text-[26px] font-semibold leading-tight tracking-tight text-ink outline-none placeholder:text-faint"
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls} htmlFor="doc-kind">
                Kind
              </label>
              <input
                id="doc-kind"
                name="kind"
                list="doc-kind-options"
                defaultValue={doc?.kind ?? ""}
                placeholder="Vision"
                className={field}
              />
              <datalist id="doc-kind-options">
                {DOC_KINDS.map((kind) => (
                  <option key={kind} value={kind} />
                ))}
              </datalist>
            </div>

            <div>
              <label className={labelCls} htmlFor="doc-project">
                Project
              </label>
              <select
                id="doc-project"
                name="projectId"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className={field}
              >
                <option value="">— none, file under an area —</option>
                {filing.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className={areaSelectShown ? "" : "hidden"}>
              <label className={labelCls} htmlFor="doc-area">
                Area
              </label>
              <select
                id="doc-area"
                name="areaId"
                defaultValue={doc?.areaId ?? initialAreaId ?? filing.areas[0]?.id ?? ""}
                className={field}
              >
                {filing.areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!areaSelectShown && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
              Filed under the project, so it takes the project’s area — and
              follows it if the project ever moves.
            </p>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className={cn(labelCls, "mb-0")}>Body — markdown</span>
            <button
              type="button"
              onClick={() => setPreview((on) => !on)}
              className="flex items-center gap-1.5 rounded-chip bg-inset px-2.5 py-1 text-[12px] text-muted transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:text-ink active:scale-[0.97]"
            >
              {preview ? (
                <>
                  <Pencil className="size-3" strokeWidth={1.8} />
                  Write
                </>
              ) : (
                <>
                  <Eye className="size-3" strokeWidth={1.8} />
                  Preview
                </>
              )}
            </button>
          </div>

          {/* The textarea stays mounted under the preview rather than being
              swapped out — unmounting it loses the caret and the scroll
              position, and the preview is a glance, not a mode. */}
          <div className="mt-1.5 min-h-0 flex-1">
            <textarea
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={"# What this is\n\nWrite it the way you'd write it in a file."}
              className={cn(
                field,
                "h-full min-h-[45vh] resize-y font-mono text-[13px] leading-relaxed",
                preview && "hidden",
              )}
            />
            {preview && (
              <div className="h-full min-h-[45vh] overflow-y-auto rounded-chip bg-inset px-4 py-3">
                {body.trim() ? (
                  <DocMarkdown>{body}</DocMarkdown>
                ) : (
                  <p className="text-[13px] text-faint">Nothing to preview.</p>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="mt-3 animate-rise rounded-chip bg-accent-soft px-3 py-2 text-[13px] leading-relaxed text-accent">
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform,opacity] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save doc"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (doc) {
                  setBody(doc.body);
                  setProjectId(doc.projectId ?? "");
                  setEditing(false);
                } else {
                  router.push("/docs");
                }
              }}
              className="rounded-chip px-3.5 py-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
            >
              Cancel
            </button>

            {doc && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!confirmingDelete) {
                    setConfirmingDelete(true);
                    return;
                  }
                  setError(null);
                  startTransition(async () => {
                    try {
                      await deleteDoc(doc.id);
                      router.push("/docs");
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not delete",
                      );
                    }
                  });
                }}
                // Two taps, because the body is the only copy of this. Projects
                // can refuse deletion by counting what they hold; a doc holds
                // nothing, so the confirmation is the whole guard.
                className={cn(
                  "group ml-auto flex items-center gap-2 text-[13px] transition-colors duration-(--duration-quick)",
                  confirmingDelete
                    ? "font-medium text-accent"
                    : "text-muted hover:text-accent",
                )}
              >
                <Trash2
                  className="size-3.5 transition-transform duration-(--duration-base) ease-soft group-hover:-rotate-12"
                  strokeWidth={1.8}
                />
                {confirmingDelete ? "Really delete — tap again" : "Delete"}
              </button>
            )}
          </div>
        </form>
      ) : (
        doc && (
          <article key={doc.id} className="animate-rise">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: doc.areaColor }}
                  />
                  <span className="text-[12px] text-muted">
                    {doc.projectName ?? doc.areaName}
                  </span>
                  {doc.kind && (
                    <span className="rounded-full bg-inset px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-muted">
                      {doc.kind}
                    </span>
                  )}
                </div>
                <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight text-ink md:text-[30px]">
                  {doc.title}
                </h1>
                <p className="mt-1.5 text-xs text-faint">
                  Updated {updated.format(doc.updatedAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex shrink-0 items-center gap-1.5 rounded-chip bg-inset px-3 py-2 text-[13px] text-muted transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:bg-line/60 hover:text-ink active:scale-[0.97]"
              >
                <Pencil className="size-3.5" strokeWidth={1.8} />
                Edit
              </button>
            </div>

            <div className="mt-7">
              {doc.body.trim() ? (
                <DocMarkdown>{doc.body}</DocMarkdown>
              ) : (
                <p className="text-sm text-faint">
                  This one is still empty. Hit Edit and start it.
                </p>
              )}
            </div>
          </article>
        )
      )}
    </div>
  );
}
