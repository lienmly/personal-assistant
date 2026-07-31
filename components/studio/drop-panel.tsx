"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink, Trash2, X } from "lucide-react";

import { ChannelBadge } from "@/components/studio/channel-badge";
import type { BrandView, DropView, ProjectView } from "@/components/studio/types";
import { FORMATS, PLATFORMS, STAGES } from "@/lib/platforms";
import {
  deleteDrop,
  deriveDrop,
  saveDrop,
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

export function DropPanel({
  drop,
  brands,
  projects,
  defaultBrandId,
  onClose,
}: {
  drop: DropView | null;
  brands: BrandView[];
  projects: ProjectView[];
  defaultBrandId?: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [brandId, setBrandId] = useState(
    drop?.brand.id ?? defaultBrandId ?? brands[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const brand = brands.find((b) => b.id === brandId);
  const attached = new Set(drop?.channels.map((row) => row.channel.id) ?? []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await saveDrop(form);
        onClose();
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
        onClick={onClose}
        className="absolute inset-0 bg-obsidian/25"
      />

      <div className="relative flex h-full w-full max-w-[460px] flex-col bg-stage shadow-float">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">
              {drop ? "Edit drop" : "New drop"}
            </h2>
            {drop?.series && (
              <p className="mt-0.5 text-[12px] text-muted">
                Slot from &ldquo;{drop.series.name}&rdquo;
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-card"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          <form id="drop-form" onSubmit={submit} className="space-y-4">
            {drop && <input type="hidden" name="id" value={drop.id} />}

            <div>
              <label className={labelCls} htmlFor="drop-title">
                Title
              </label>
              <input
                id="drop-title"
                name="title"
                defaultValue={drop?.title ?? ""}
                placeholder="What is this one about?"
                autoFocus
                className={field}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="drop-brand">
                  Brand — who says it
                </label>
                <select
                  id="drop-brand"
                  name="brandId"
                  value={brandId}
                  onChange={(event) => setBrandId(event.target.value)}
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
                <label className={labelCls} htmlFor="drop-project">
                  Project — what it&rsquo;s about
                </label>
                <select
                  id="drop-project"
                  name="projectId"
                  defaultValue={drop?.project?.id ?? ""}
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
                <label className={labelCls} htmlFor="drop-format">
                  Format
                </label>
                <select
                  id="drop-format"
                  name="format"
                  defaultValue={drop?.format ?? "short_video"}
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
                <label className={labelCls} htmlFor="drop-stage">
                  Stage
                </label>
                <select
                  id="drop-stage"
                  name="stage"
                  defaultValue={drop?.stage ?? "idea"}
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
              <label className={labelCls} htmlFor="drop-publish">
                Publish at
              </label>
              <input
                id="drop-publish"
                type="datetime-local"
                name="publishAt"
                defaultValue={toLocalInput(drop?.publishAt ?? null)}
                className={field}
              />
            </div>

            <div>
              <span className={labelCls}>Goes out on</span>
              <div className="space-y-1.5 rounded-tile bg-card p-3 shadow-card">
                {brand?.channels.length ? (
                  brand.channels.map((channel) => (
                    <label
                      key={channel.id}
                      className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink"
                    >
                      <input
                        type="checkbox"
                        name="channelIds"
                        value={channel.id}
                        defaultChecked={attached.has(channel.id)}
                        className="size-3.5 accent-accent"
                      />
                      <ChannelBadge
                        platform={channel.platform}
                        handle={channel.handle}
                        label={channel.label}
                        done
                      />
                      <span className="truncate">
                        @{channel.handle}
                        {channel.label && (
                          <span className="ml-1.5 text-faint">{channel.label}</span>
                        )}
                      </span>
                      {channel.state === "planned" && (
                        <span className="ml-auto shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-medium text-warn">
                          planned
                        </span>
                      )}
                    </label>
                  ))
                ) : (
                  <p className="text-[13px] text-muted">
                    This brand has no channels yet.
                  </p>
                )}
              </div>
              <p className="mt-1.5 text-[12px] leading-relaxed text-faint">
                Same asset, more places — ticking extra boxes costs nothing.
              </p>
            </div>

            <div>
              <label className={labelCls} htmlFor="drop-body">
                Script / caption
              </label>
              <textarea
                id="drop-body"
                name="body"
                rows={5}
                defaultValue={drop?.body ?? ""}
                placeholder="The words."
                className={cn(field, "resize-y")}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="drop-notes">
                Notes
              </label>
              <textarea
                id="drop-notes"
                name="notes"
                rows={2}
                defaultValue={drop?.notes ?? ""}
                className={cn(field, "resize-y")}
              />
            </div>

            {error && (
              <p className="rounded-chip bg-accent-soft px-3 py-2 text-[13px] text-accent">
                {error}
              </p>
            )}
          </form>

          {drop && drop.channels.length > 0 && (
            <PublishChecklist drop={drop} />
          )}

          {drop && <RepurposeRow drop={drop} brands={brands} />}

          {drop && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteDrop(drop.id);
                  onClose();
                })
              }
              className="mt-6 flex items-center gap-2 text-[13px] text-muted hover:text-accent"
            >
              <Trash2 className="size-3.5" strokeWidth={1.8} />
              Delete this drop
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 bg-shell px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-chip px-3.5 py-2 text-[13px] text-muted hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="drop-form"
            disabled={pending}
            className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save drop"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The fan-out as a checklist. Ticking the last one publishes the whole drop —
 * see `setChannelState`. Paste the URL and it becomes the permanent record of
 * where this went.
 */
function PublishChecklist({ drop }: { drop: DropView }) {
  const [pending, startTransition] = useTransition();

  function update(dropChannelId: string, state: string, publishedUrl: string) {
    const form = new FormData();
    form.set("dropChannelId", dropChannelId);
    form.set("state", state);
    form.set("publishedUrl", publishedUrl);
    startTransition(() => setChannelState(form));
  }

  return (
    <div className="mt-7">
      <h3 className={labelCls}>Posted where</h3>
      <div className="space-y-2 rounded-tile bg-card p-3 shadow-card">
        {drop.channels.map((row) => {
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
                  "grid size-5 shrink-0 place-items-center rounded-full transition-colors",
                  done ? "bg-good text-white" : "bg-inset text-faint",
                )}
              >
                <Check className="size-3" strokeWidth={3} />
              </button>

              <ChannelBadge
                platform={row.channel.platform}
                handle={row.channel.handle}
                label={row.channel.label}
                done={done}
                skipped={row.state === "skipped"}
              />

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

/** Repurposing, kind 2 — spawn a derived drop in a different form. */
function RepurposeRow({
  drop,
  brands,
}: {
  drop: DropView;
  brands: BrandView[];
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [brandId, setBrandId] = useState(drop.brand.id);
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
          await deriveDrop(form);
          setOpen(false);
        });
      }}
      className="mt-7 space-y-3 rounded-tile bg-card p-3 shadow-card"
    >
      <input type="hidden" name="sourceDropId" value={drop.id} />
      <p className="text-[12px] leading-relaxed text-muted">
        Creates a linked drop with its own stages — for when the idea has to be
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
            className="flex items-center gap-1.5 rounded-chip bg-inset px-2 py-1 text-[12px] text-ink"
          >
            <input
              type="checkbox"
              name="channelIds"
              value={channel.id}
              className="size-3 accent-accent"
            />
            @{channel.handle}
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
