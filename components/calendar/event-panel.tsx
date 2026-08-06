"use client";

import { useEffect, useState, useTransition } from "react";
import { Repeat, Trash2, X } from "lucide-react";

import type {
  CalendarAreaView,
  CalendarProjectView,
  EventView,
} from "@/components/calendar/types";
import { deleteEvent, saveEvent } from "@/lib/event-actions";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";
const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-faint";

const RECURRENCES = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

const ISO_DAYS = [
  { value: 1, label: "M" },
  { value: 2, label: "T" },
  { value: 3, label: "W" },
  { value: 4, label: "T" },
  { value: 5, label: "F" },
  { value: 6, label: "S" },
  { value: 7, label: "S" },
];

/**
 * Create / edit / delete an Event. Same shape as the task and project panels —
 * slide-in from the right, exit animated, `Escape` closes.
 *
 * The one thing it does that they don't is warn about recurrence. Only the rule
 * is stored, so editing any occurrence edits all of them; saying that out loud
 * next to the save button is cheaper than an exceptions table, and far cheaper
 * than finding out by moving one nap and losing the routine.
 */
export function EventPanel({
  event,
  areas,
  projects,
  defaultDay,
  onClose,
}: {
  event: EventView | null;
  areas: CalendarAreaView[];
  projects: CalendarProjectView[];
  /** The day whose "+" was clicked, for a new event. */
  defaultDay: string;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [recurrence, setRecurrence] = useState<string>(
    event?.recurrence ?? "none",
  );
  const [days, setDays] = useState<number[]>(event?.daysOfWeek ?? []);
  const [projectId, setProjectId] = useState(event?.projectId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const dismiss = () => setClosing(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setClosing(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await saveEvent(form);
        dismiss();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save");
      }
    });
  }

  const toggleDay = (value: number) =>
    setDays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : [...current, value],
    );

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
        onAnimationEnd={(e) => {
          if (closing && e.target === e.currentTarget) onClose();
        }}
        className={cn(
          "relative flex h-full w-full max-w-[440px] flex-col bg-stage shadow-float",
          closing ? "animate-panel-out" : "animate-panel-in",
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            {event ? "Edit event" : "New event"}
          </h2>
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
          <form id="event-form" onSubmit={submit} className="space-y-4">
            {event && <input type="hidden" name="id" value={event.id} />}

            <div>
              <label className={labelCls} htmlFor="event-title">
                What’s happening
              </label>
              <input
                id="event-title"
                name="title"
                defaultValue={event?.title ?? ""}
                placeholder="Morning nap"
                autoFocus
                className={field}
              />
            </div>

            <button
              type="button"
              onClick={() => setAllDay((value) => !value)}
              className={cn(
                "flex w-full items-center gap-3 rounded-tile px-3 py-2.5 text-left text-[13px] transition-[background-color,transform] duration-(--duration-base) ease-soft active:scale-[0.985]",
                allDay ? "bg-inset text-ink" : "bg-inset/60 text-muted",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors duration-(--duration-base)",
                  allDay ? "bg-accent" : "bg-line",
                )}
              >
                <span
                  className={cn(
                    "size-4 rounded-full bg-card shadow-card transition-transform duration-(--duration-base) ease-soft",
                    allDay ? "translate-x-4" : "translate-x-0",
                  )}
                />
              </span>
              All day
            </button>
            <input type="hidden" name="allDay" value={allDay ? "true" : ""} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="event-start-day">
                  Starts
                </label>
                <input
                  id="event-start-day"
                  type="date"
                  name="startDay"
                  defaultValue={event?.startDay ?? defaultDay}
                  className={field}
                />
              </div>
              <div>
                <label className={labelCls} htmlFor="event-end-day">
                  Ends
                </label>
                <input
                  id="event-end-day"
                  type="date"
                  name="endDay"
                  defaultValue={event?.endDay ?? defaultDay}
                  className={field}
                />
              </div>
            </div>

            {!allDay && (
              <div className="grid animate-rise grid-cols-2 gap-3">
                <div>
                  <label className={labelCls} htmlFor="event-start-time">
                    From
                  </label>
                  <input
                    id="event-start-time"
                    type="time"
                    name="startTime"
                    defaultValue={event?.startTime ?? "09:00"}
                    className={field}
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="event-end-time">
                    To
                  </label>
                  <input
                    id="event-end-time"
                    type="time"
                    name="endTime"
                    defaultValue={event?.endTime ?? "10:00"}
                    className={field}
                  />
                </div>
              </div>
            )}

            <div>
              <label className={labelCls} htmlFor="event-recurrence">
                Repeats
              </label>
              <select
                id="event-recurrence"
                name="recurrence"
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className={field}
              >
                {RECURRENCES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {recurrence === "weekly" && (
              <div className="animate-rise">
                <span className={labelCls}>On these days</span>
                <div className="flex gap-1.5">
                  {ISO_DAYS.map((day) => {
                    const on = days.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        aria-pressed={on}
                        className={cn(
                          "size-9 rounded-full text-[12px] font-medium transition-[background-color,color,transform] duration-(--duration-base) ease-soft active:scale-90",
                          on
                            ? "bg-ink text-white"
                            : "bg-inset text-muted hover:bg-line/60",
                        )}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
                {days.map((day) => (
                  <input key={day} type="hidden" name="daysOfWeek" value={day} />
                ))}
                <p className="mt-1.5 text-[12px] text-faint">
                  Leave them all off to repeat on the start day’s weekday.
                </p>
              </div>
            )}

            {recurrence !== "none" && (
              <div className="animate-rise">
                <label className={labelCls} htmlFor="event-until">
                  Repeat until
                </label>
                <input
                  id="event-until"
                  type="date"
                  name="repeatUntil"
                  defaultValue={event?.repeatUntil ?? ""}
                  className={field}
                />
                <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-relaxed text-faint">
                  <Repeat className="mt-0.5 size-3 shrink-0" strokeWidth={2.2} />
                  Empty means forever. Only the rule is stored, so editing this
                  changes every occurrence — past and future.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="event-project">
                  Project
                </label>
                <select
                  id="event-project"
                  name="projectId"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className={field}
                >
                  <option value="">None</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Same rule as the task panel: a project supplies the area, so
                  offering both would be offering a choice the server overrules. */}
              {!projectId && (
                <div>
                  <label className={labelCls} htmlFor="event-area">
                    Area
                  </label>
                  <select
                    id="event-area"
                    name="areaId"
                    defaultValue={event?.areaId ?? areas[0]?.id ?? ""}
                    className={field}
                  >
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className={labelCls} htmlFor="event-location">
                Where
              </label>
              <input
                id="event-location"
                name="location"
                defaultValue={event?.location ?? ""}
                placeholder="Paediatrician, Zoom, the studio"
                className={field}
              />
            </div>

            <div>
              <label className={labelCls} htmlFor="event-notes">
                Notes
              </label>
              <textarea
                id="event-notes"
                name="notes"
                rows={3}
                defaultValue={event?.notes ?? ""}
                placeholder="What to bring, who's coming, what it's for."
                className={cn(field, "resize-y")}
              />
            </div>

            {error && (
              <p className="animate-rise rounded-chip bg-accent-soft px-3 py-2 text-[13px] text-accent">
                {error}
              </p>
            )}
          </form>

          {event && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteEvent(event.id);
                  dismiss();
                })
              }
              className="group mt-6 flex items-center gap-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-accent"
            >
              <Trash2
                className="size-3.5 transition-transform duration-(--duration-base) ease-soft group-hover:-rotate-12"
                strokeWidth={1.8}
              />
              {event.recurrence === "none"
                ? "Delete this event"
                : "Delete the whole repeat"}
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
            form="event-form"
            disabled={pending}
            className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform,opacity] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save event"}
          </button>
        </div>
      </div>
    </div>
  );
}
