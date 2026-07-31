"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { ChannelBadge } from "@/components/studio/channel-badge";
import type { ChannelView, ProjectView } from "@/components/studio/types";
import { FORMATS, PLATFORMS } from "@/lib/platforms";
import {
  deleteChannel,
  saveChannel,
  saveSeries,
  toggleSeries,
} from "@/lib/studio-actions";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-chip bg-inset px-2.5 py-1.5 text-[13px] text-ink outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/25";

export type SeriesView = {
  id: string;
  name: string;
  format: keyof typeof FORMATS;
  cadence: string;
  daysOfWeek: number[];
  timeOfDay: string | null;
  isActive: boolean;
  projectId: string | null;
  projectName: string | null;
  channelIds: string[];
  dropCount: number;
};

export type BrandDetail = {
  id: string;
  name: string;
  tagline: string | null;
  color: string;
  channels: (ChannelView & { url: string | null; postCount: number })[];
  series: SeriesView[];
};

const WEEKDAYS = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 7, label: "S" },
];

const CADENCES = [
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Chosen days" },
  { value: "custom", label: "Custom days" },
];

export function ChannelManager({
  brands,
  projects,
}: {
  brands: BrandDetail[];
  projects: ProjectView[];
}) {
  return (
    <div className="space-y-5">
      {brands.map((brand) => (
        <section key={brand.id} className="rounded-card bg-card p-5 shadow-card">
          <div className="mb-4 flex items-start gap-3">
            <span
              className="mt-1.5 size-2.5 shrink-0 rounded-full"
              style={{ background: brand.color }}
            />
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                {brand.name}
              </h2>
              {brand.tagline && (
                <p className="mt-0.5 max-w-md text-[13px] leading-relaxed text-muted">
                  {brand.tagline}
                </p>
              )}
            </div>
          </div>

          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            Accounts
          </h3>
          <div className="mb-5 space-y-1.5">
            {brand.channels.map((channel) => (
              <ChannelRow key={channel.id} channel={channel} brandId={brand.id} />
            ))}
            <AddChannel brandId={brand.id} />
          </div>

          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            Standing series
          </h3>
          <div className="space-y-1.5">
            {brand.series.length === 0 && (
              <p className="text-[13px] text-faint">
                No recurring commitment yet — one here fills the board for you.
              </p>
            )}
            {brand.series.map((series) => (
              <SeriesRow
                key={series.id}
                series={series}
                brand={brand}
                projects={projects}
              />
            ))}
            <AddSeries brand={brand} projects={projects} />
          </div>
        </section>
      ))}
    </div>
  );
}

function ChannelRow({
  channel,
  brandId,
}: {
  channel: ChannelView & { url: string | null; postCount: number };
  brandId: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <div className="flex items-center gap-2.5 rounded-tile bg-inset px-3 py-2">
        <ChannelBadge
          platform={channel.platform}
          handle={channel.handle}
          label={channel.label}
          done={channel.state === "live"}
        />
        <span className="truncate text-[13px] text-ink">@{channel.handle}</span>
        {channel.label && (
          <span className="truncate text-[12px] text-faint">{channel.label}</span>
        )}
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
            channel.state === "live"
              ? "bg-card text-good"
              : channel.state === "planned"
                ? "bg-warn-soft text-warn"
                : "bg-card text-faint",
          )}
        >
          {channel.state}
        </span>
        <span className="shrink-0 text-[11px] text-faint tabular-nums">
          {channel.postCount}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`Edit @${channel.handle}`}
          className="shrink-0 text-faint hover:text-ink"
        >
          <Pencil className="size-3.5" strokeWidth={1.8} />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          await saveChannel(form);
          setEditing(false);
        });
      }}
      className="space-y-2 rounded-tile bg-inset p-3"
    >
      <input type="hidden" name="id" value={channel.id} />
      <input type="hidden" name="brandId" value={brandId} />
      <div className="grid grid-cols-2 gap-2">
        <select
          name="platform"
          defaultValue={channel.platform}
          aria-label="Platform"
          className={field}
        >
          {Object.entries(PLATFORMS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <select
          name="state"
          defaultValue={channel.state}
          aria-label="State"
          className={field}
        >
          <option value="planned">Planned</option>
          <option value="live">Live</option>
          <option value="paused">Paused</option>
        </select>
        <input
          name="handle"
          defaultValue={channel.handle}
          placeholder="handle"
          aria-label="Handle"
          className={field}
        />
        <input
          name="label"
          defaultValue={channel.label ?? ""}
          placeholder="label (optional)"
          aria-label="Label"
          className={field}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-chip bg-ink px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-1 text-[12px] text-muted hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={pending || channel.postCount > 0}
          title={
            channel.postCount > 0
              ? "This channel has posts — delete those first"
              : "Delete channel"
          }
          onClick={() => startTransition(() => deleteChannel(channel.id))}
          className="ml-auto text-faint hover:text-accent disabled:opacity-30"
        >
          <Trash2 className="size-3.5" strokeWidth={1.8} />
        </button>
      </div>
    </form>
  );
}

function AddChannel({ brandId }: { brandId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-tile border border-dashed border-line py-2 text-[12px] text-faint hover:text-ink"
      >
        <Plus className="size-3.5" strokeWidth={2.2} />
        Add account
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          await saveChannel(form);
          setOpen(false);
        });
      }}
      className="flex flex-wrap items-center gap-2 rounded-tile bg-inset p-3"
    >
      <input type="hidden" name="brandId" value={brandId} />
      <select
        name="platform"
        aria-label="Platform"
        className={cn(field, "w-auto flex-1")}
      >
        {Object.entries(PLATFORMS).map(([value, meta]) => (
          <option key={value} value={value}>
            {meta.label}
          </option>
        ))}
      </select>
      <input
        name="handle"
        placeholder="handle"
        aria-label="Handle"
        required
        className={cn(field, "w-auto flex-1")}
      />
      <select
        name="state"
        defaultValue="planned"
        aria-label="State"
        className={cn(field, "w-auto")}
      >
        <option value="planned">Planned</option>
        <option value="live">Live</option>
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-chip bg-ink px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Cancel"
        className="text-faint hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </form>
  );
}

function cadenceSummary(series: SeriesView): string {
  const days =
    series.daysOfWeek.length > 0
      ? series.daysOfWeek
          .map((day) => ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][day])
          .join(", ")
      : null;

  switch (series.cadence) {
    case "daily":
      return `Every day${series.timeOfDay ? ` at ${series.timeOfDay}` : ""}`;
    case "weekdays":
      return `Weekdays${series.timeOfDay ? ` at ${series.timeOfDay}` : ""}`;
    default:
      return `${days ?? "No days chosen"}${
        series.timeOfDay ? ` at ${series.timeOfDay}` : ""
      }`;
  }
}

function SeriesRow({
  series,
  brand,
  projects,
}: {
  series: SeriesView;
  brand: BrandDetail;
  projects: ProjectView[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <SeriesForm
        series={series}
        brand={brand}
        projects={projects}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-tile bg-inset px-3 py-2">
      <button
        type="button"
        disabled={pending}
        aria-label={series.isActive ? "Pause series" : "Activate series"}
        onClick={() =>
          startTransition(() => toggleSeries(series.id, !series.isActive))
        }
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-full",
          series.isActive ? "bg-good text-white" : "bg-card text-faint",
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-ink">
          {series.name}
          <span className="ml-2 font-normal text-faint">
            {FORMATS[series.format].label}
          </span>
        </p>
        <p className="truncate text-[12px] text-muted">
          {cadenceSummary(series)}
          {series.projectName ? ` · ${series.projectName}` : " · brand building"}
          {` · ${series.channelIds.length} channel${
            series.channelIds.length === 1 ? "" : "s"
          }`}
        </p>
      </div>

      <span className="shrink-0 text-[11px] text-faint tabular-nums">
        {series.dropCount}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${series.name}`}
        className="shrink-0 text-faint hover:text-ink"
      >
        <Pencil className="size-3.5" strokeWidth={1.8} />
      </button>
    </div>
  );
}

function AddSeries({
  brand,
  projects,
}: {
  brand: BrandDetail;
  projects: ProjectView[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-tile border border-dashed border-line py-2 text-[12px] text-faint hover:text-ink"
      >
        <Plus className="size-3.5" strokeWidth={2.2} />
        Add series
      </button>
    );
  }

  return (
    <SeriesForm
      series={null}
      brand={brand}
      projects={projects}
      onDone={() => setOpen(false)}
    />
  );
}

function SeriesForm({
  series,
  brand,
  projects,
  onDone,
}: {
  series: SeriesView | null;
  brand: BrandDetail;
  projects: ProjectView[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [cadence, setCadence] = useState(series?.cadence ?? "daily");
  const attached = new Set(series?.channelIds ?? []);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          await saveSeries(form);
          onDone();
        });
      }}
      className="space-y-2.5 rounded-tile bg-inset p-3"
    >
      {series && <input type="hidden" name="id" value={series.id} />}
      <input type="hidden" name="brandId" value={brand.id} />

      <div className="grid grid-cols-2 gap-2">
        <input
          name="name"
          defaultValue={series?.name ?? ""}
          placeholder="Series name, e.g. Daily short"
          aria-label="Series name"
          required
          className={field}
        />
        <select
          name="projectId"
          defaultValue={series?.projectId ?? ""}
          aria-label="Project"
          className={field}
        >
          <option value="">No project — brand building</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select
          name="format"
          defaultValue={series?.format ?? "short_video"}
          aria-label="Format"
          className={field}
        >
          {Object.entries(FORMATS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <select
          name="cadence"
          value={cadence}
          onChange={(event) => setCadence(event.target.value)}
          aria-label="Cadence"
          className={field}
        >
          {CADENCES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {(cadence === "weekly" || cadence === "custom") && (
        <div className="flex gap-1.5">
          {WEEKDAYS.map((day) => (
            <label
              key={day.value}
              className="grid size-7 cursor-pointer place-items-center rounded-full bg-card text-[11px] text-muted has-checked:bg-ink has-checked:text-white"
            >
              <input
                type="checkbox"
                name="daysOfWeek"
                value={day.value}
                defaultChecked={series?.daysOfWeek.includes(day.value)}
                className="sr-only"
              />
              {day.label}
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="time"
          name="timeOfDay"
          defaultValue={series?.timeOfDay ?? "18:00"}
          aria-label="Time of day"
          className={cn(field, "w-auto")}
        />
        <label className="flex items-center gap-1.5 text-[12px] text-ink">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={series?.isActive ?? true}
            className="size-3.5 accent-accent"
          />
          Generating slots
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {brand.channels.map((channel) => (
          <label
            key={channel.id}
            className="flex cursor-pointer items-center gap-1.5 rounded-chip bg-card px-2 py-1 text-[12px] text-ink"
          >
            <input
              type="checkbox"
              name="channelIds"
              value={channel.id}
              defaultChecked={attached.has(channel.id)}
              className="size-3 accent-accent"
            />
            @{channel.handle}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-chip bg-ink px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save series"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-1 text-[12px] text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
