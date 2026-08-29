"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, ExternalLink, Trash2, X } from "lucide-react";

import type { BrandView, ContentView, ProjectView } from "@/components/studio/types";
import {
  destinationLabel,
  FORMATS,
  PLATFORMS,
  STAGES,
} from "@/lib/platforms";
import {
  deleteContentItem,
  deriveContentItem,
  saveContentItem,
  setChannelState,
} from "@/lib/studio-actions";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/25";
const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-faint";

/** <input type="datetime-local"> wants local wall-clock, not an ISO string. */
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ContentPanel({
  item,
  brands,
  projects,
  defaultBrandId,
  defaultProjectId,
  onClose,
}: {
  item: ContentView | null;
  brands: BrandView[];
  projects: ProjectView[];
  defaultBrandId?: string;
  /** Set where the surface itself is a project — opening the composer from a
   *  project page means "about this one", and that is a decision the page has
   *  already made rather than a default the brand gets to overrule. */
  defaultProjectId?: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const initialBrandId = item?.brand.id ?? defaultBrandId ?? brands[0]?.id ?? "";
  const [brandId, setBrandId] = useState(initialBrandId);

  // The project follows the brand until you say otherwise. Three of four
  // projects run an account, so under @sleepycatgame the answer is Sleepy Cat
  // essentially always — and leaving the field empty by default is what left 20
  // items filed under nothing and made a project page look emptier than it is.
  //
  // It is only ever a *default*: pick a project yourself and the field stops
  // following, and an existing item never moves on its own, because whatever it
  // says now is a decision somebody already made. That is what keeps "should
  // Sleepy Cat post from Coding Mom?" an item-by-item question.
  const [projectId, setProjectId] = useState(
    item
      ? (item.project?.id ?? "")
      : (defaultProjectId ??
        brands.find((b) => b.id === initialBrandId)?.projectId ??
        ""),
  );
  const [projectPinned, setProjectPinned] = useState(
    item != null || defaultProjectId != null,
  );

  function pickBrand(nextBrandId: string) {
    setBrandId(nextBrandId);
    if (!projectPinned) {
      setProjectId(brands.find((b) => b.id === nextBrandId)?.projectId ?? "");
    }
  }
  const [error, setError] = useState<string | null>(null);
  // The panel unmounts itself only once its exit animation has finished, so
  // closing slides out instead of vanishing. Every dismissal goes through
  // `dismiss()`; `onClose` is called from the animation end.
  const [closing, setClosing] = useState(false);
  const dismiss = () => setClosing(true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setClosing(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const brand = brands.find((b) => b.id === brandId);
  const attached = new Set(item?.channels.map((row) => row.channel.id) ?? []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await saveContentItem(form);
        dismiss();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className={cn(
          "absolute inset-0 bg-scrim",
          closing ? "animate-scrim-out" : "animate-scrim-in",
        )}
      />

      <div
        onAnimationEnd={(event) => {
          // Form fields inside the panel animate too; only the panel's own
          // exit should unmount it.
          if (closing && event.target === event.currentTarget) onClose();
        }}
        className={cn(
          "relative flex h-full w-full max-w-[460px] flex-col bg-stage shadow-float",
          closing ? "animate-panel-out" : "animate-panel-in",
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">
              {item ? "Edit content" : "New content"}
            </h2>
            {item?.series && (
              <p className="mt-0.5 text-[12px] text-muted">
                Slot from &ldquo;{item.series.name}&rdquo;
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full text-muted transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:rotate-90 hover:bg-card hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          <form id="item-form" onSubmit={submit} className="space-y-4">
            {item && <input type="hidden" name="id" value={item.id} />}

            <div>
              <label className={labelCls} htmlFor="item-title">
                Title
              </label>
              <input
                id="item-title"
                name="title"
                defaultValue={item?.title ?? ""}
                placeholder="What is this one about?"
                autoFocus
                className={field}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="item-brand">
                  Brand — who says it
                </label>
                <select
                  id="item-brand"
                  name="brandId"
                  value={brandId}
                  onChange={(event) => pickBrand(event.target.value)}
                  className={field}
                >
                  {brands.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="item-project">
                  Project — what it&rsquo;s about
                </label>
                <select
                  id="item-project"
                  name="projectId"
                  value={projectId}
                  onChange={(event) => {
                    setProjectPinned(true);
                    setProjectId(event.target.value);
                  }}
                  className={field}
                >
                  <option value="">None — brand building</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="item-format">
                  Format
                </label>
                <select
                  id="item-format"
                  name="format"
                  defaultValue={item?.format ?? "short_video"}
                  className={field}
                >
                  {Object.entries(FORMATS).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="item-stage">
                  Stage
                </label>
                <select
                  id="item-stage"
                  name="stage"
                  defaultValue={item?.stage ?? "idea"}
                  className={field}
                >
                  {STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls} htmlFor="item-publish">
                Publish at
              </label>
              <input
                id="item-publish"
                type="datetime-local"
                name="publishAt"
                defaultValue={toLocalInput(item?.publishAt ?? null)}
                className={field}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="item-body">
                Script / caption
              </label>
              <textarea
                id="item-body"
                name="body"
                rows={5}
                defaultValue={item?.body ?? ""}
                placeholder="The words."
                className={cn(field, "resize-y")}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="item-ref">
                Based on
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="item-ref"
                  name="refUrl"
                  type="url"
                  inputMode="url"
                  defaultValue={item?.refUrl ?? ""}
                  placeholder="https://tiktok.com/@…/video/…"
                  className={field}
                />
                {item?.refUrl && (
                  <a
                    href={item.refUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open the source post"
                    className="shrink-0 text-faint hover:text-ink"
                  >
                    <ExternalLink className="size-4" strokeWidth={1.8} />
                  </a>
                )}
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
                The viral post this one reproduces — not where it ends up.
              </p>
            </div>

            <div>
              <label className={labelCls} htmlFor="item-notes">
                Notes
              </label>
              <textarea
                id="item-notes"
                name="notes"
                rows={2}
                defaultValue={item?.notes ?? ""}
                className={cn(field, "resize-y")}
              />
            </div>

            {/* **Where it goes sits at the bottom of the panel, on purpose.**
                It used to sit above the writing, which put the least important
                decision about a piece of content in front of the only one that
                matters — and it is the decision most likely to change on the
                day. The idea first; the destination when there is something to
                send. */}
            <div>
              <span className={labelCls}>Where it goes</span>
              <div className="flex flex-wrap gap-1.5">
                {brand?.channels.length ? (
                  brand.channels.map((channel) => (
                    <label
                      key={channel.id}
                      title={`@${channel.handle}`}
                      className="flex cursor-pointer items-center gap-2 rounded-chip bg-inset px-3 py-1.5 text-[13px] text-ink transition-colors duration-(--duration-quick) hover:bg-line"
                    >
                      <input
                        type="checkbox"
                        name="channelIds"
                        value={channel.id}
                        defaultChecked={attached.has(channel.id)}
                        className="size-3.5 accent-accent"
                      />
                      {destinationLabel(channel, brand.channels)}
                      {channel.state === "planned" && (
                        <span className="shrink-0 text-[11px] text-warn">
                          planned
                        </span>
                      )}
                    </label>
                  ))
                ) : (
                  <p className="text-[13px] text-muted">
                    This brand has no accounts yet.
                  </p>
                )}
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
                Same asset, more places — ticking extra boxes costs nothing.
              </p>
            </div>

            {error && (
              <p className="rounded-chip bg-accent-soft px-3 py-2 text-[13px] text-accent">
                {error}
              </p>
            )}
          </form>

          {item && item.channels.length > 0 && (
            <PublishChecklist item={item} />
          )}

          {item && <RepurposeRow item={item} brands={brands} />}

          {item && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteContentItem(item.id);
                  dismiss();
                })
              }
              className="mt-6 flex items-center gap-2 text-[13px] text-muted hover:text-accent"
            >
              <Trash2 className="size-3.5" strokeWidth={1.8} />
              Delete this item
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 bg-shell px-5 py-3">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-chip px-3.5 py-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="item-form"
            disabled={pending}
            className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform,opacity] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The fan-out as a checklist. Ticking the last one publishes the whole item —
 * see `setChannelState`. Paste the URL and it becomes the permanent record of
 * where this went.
 */
function PublishChecklist({ item }: { item: ContentView }) {
  const [pending, startTransition] = useTransition();

  function update(itemChannelId: string, state: string, publishedUrl: string) {
    const form = new FormData();
    form.set("itemChannelId", itemChannelId);
    form.set("state", state);
    form.set("publishedUrl", publishedUrl);
    startTransition(() => setChannelState(form));
  }

  return (
    <div className="mt-7">
      <h3 className={labelCls}>Record where it went</h3>
      <div className="space-y-2 rounded-tile bg-card p-3 shadow-card">
        {item.channels.map((row) => {
          const done = row.state === "published";
          return (
            <div key={row.id} className="flex items-center gap-2.5">
              <button
                type="button"
                disabled={pending}
                aria-label={done ? "Mark as not posted" : "Mark as posted"}
                onClick={() =>
                  update(
                    row.id,
                    done ? "pending" : "published",
                    row.publishedUrl ?? "",
                  )
                }
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-90",
                  done
                    ? "bg-good text-white"
                    : "bg-inset text-faint hover:bg-line hover:text-muted",
                )}
              >
                {/* Remounting on the state flip replays the pop — this is the
                    moment a channel is actually posted, so it earns it. */}
                <Check
                  key={done ? "done" : "todo"}
                  className={cn("size-3", done && "animate-pop")}
                  strokeWidth={3}
                />
              </button>

              <span
                title={`@${row.channel.handle}`}
                className={cn(
                  "w-[104px] shrink-0 truncate text-[12.5px]",
                  done ? "text-ink" : "text-muted",
                  row.state === "skipped" && "text-faint line-through",
                )}
              >
                {destinationLabel(
                  row.channel,
                  item.channels.map((each) => each.channel),
                )}
              </span>

              <input
                defaultValue={row.publishedUrl ?? ""}
                placeholder={`${PLATFORMS[row.channel.platform].label} URL`}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value !== (row.publishedUrl ?? "")) {
                    update(row.id, row.state, value);
                  }
                }}
                className="min-w-0 flex-1 rounded-chip bg-inset px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/25"
              />

              {row.publishedUrl && (
                <a
                  href={row.publishedUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open post"
                  className="shrink-0 text-faint hover:text-ink"
                >
                  <ExternalLink className="size-3.5" strokeWidth={1.8} />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Repurposing, kind 2 — spawn a derived item in a different form. */
function RepurposeRow({
  item,
  brands,
}: {
  item: ContentView;
  brands: BrandView[];
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState(item.brand.id);
  const brand = brands.find((b) => b.id === brandId);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-7 w-full rounded-tile border border-dashed border-line py-2.5 text-[13px] text-muted hover:text-ink"
      >
        Repurpose into another form →
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          await deriveContentItem(form);
          setOpen(false);
        });
      }}
      className="mt-7 space-y-3 rounded-tile bg-card p-3 shadow-card"
    >
      <input type="hidden" name="sourceItemId" value={item.id} />
      <p className="text-[12px] leading-relaxed text-muted">
        Creates a linked piece with its own stages — for when the idea has to be
        rewritten, not just re-uploaded.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <select
          name="brandId"
          value={brandId}
          onChange={(event) => setBrandId(event.target.value)}
          aria-label="Brand"
          className={field}
        >
          {brands.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <select
          name="format"
          defaultValue="text_post"
          aria-label="Format"
          className={field}
        >
          {Object.entries(FORMATS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {brand?.channels.map((channel) => (
          <label
            key={channel.id}
            title={`@${channel.handle}`}
            className="flex items-center gap-1.5 rounded-chip bg-inset px-2 py-1 text-[12px] text-ink"
          >
            <input
              type="checkbox"
              name="channelIds"
              value={channel.id}
              className="size-3 accent-accent"
            />
            {destinationLabel(channel, brand.channels)}
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2 text-[13px] text-muted hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-chip bg-ink px-3 py-1.5 text-[13px] font-medium text-white disabled:opacity-50"
        >
          Create
        </button>
      </div>
    </form>
  );
}
