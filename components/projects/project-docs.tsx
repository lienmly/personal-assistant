"use client";

import { useState, useTransition } from "react";
import { FileText, Pencil, Plus, Trash2, X } from "lucide-react";

import { Markdown } from "@/components/ui/markdown";
import { deleteDoc, saveDoc } from "@/lib/doc-actions";
import { docExcerpt } from "@/lib/markdown";
import { cn } from "@/lib/utils";

export type DocView = {
  id: string;
  slug: string;
  title: string;
  body: string;
  updatedLabel: string;
};

/**
 * The Docs tab. A list on the left, one doc on the right, an editor in place.
 *
 * Editing happens *here* rather than in a slide-over panel — unlike a task or a
 * content item, a doc is the thing you came to the page to read, and a panel
 * that covers the page you are writing about is the wrong shape. The panel
 * pattern stays where it belongs: short forms over a list you need to keep
 * seeing.
 */
export function ProjectDocs({
  projectId,
  docs,
}: {
  projectId: string;
  docs: DocView[];
}) {
  const [selected, setSelected] = useState<string | null>(docs[0]?.id ?? null);
  const [editing, setEditing] = useState<"new" | string | null>(
    docs.length === 0 ? null : null,
  );

  const doc = docs.find((row) => row.id === selected) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <div className="flex flex-col gap-1.5">
        {docs.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => {
              setSelected(row.id);
              setEditing(null);
            }}
            className={cn(
              "rounded-tile px-3.5 py-3 text-left transition-[background-color,box-shadow] duration-(--duration-base) ease-soft active:scale-[0.985]",
              row.id === selected
                ? "bg-card shadow-card"
                : "bg-inset hover:bg-card/70",
            )}
          >
            <p className="truncate text-[13px] font-medium text-ink">
              {row.title}
            </p>
            <p className="mt-0.5 truncate text-[11.5px] text-faint">
              {docExcerpt(row.body, 40)}
            </p>
            <p className="mt-1 text-[11px] text-faint">{row.updatedLabel}</p>
          </button>
        ))}

        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex items-center gap-2 rounded-tile px-3.5 py-2.5 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:bg-inset hover:text-ink active:scale-[0.985]"
        >
          <Plus className="size-4" strokeWidth={2.2} />
          New doc
        </button>
      </div>

      <div className="min-w-0">
        {editing !== null ? (
          <DocEditor
            projectId={projectId}
            doc={editing === "new" ? null : (doc ?? null)}
            onDone={() => setEditing(null)}
          />
        ) : doc ? (
          <DocReader doc={doc} onEdit={() => setEditing(doc.id)} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-tile bg-inset px-6 py-12 text-center">
            <span className="mb-3 grid size-10 place-items-center rounded-full bg-card text-faint shadow-card">
              <FileText className="size-4.5" strokeWidth={1.8} />
            </span>
            <p className="text-sm font-medium text-ink">No docs yet</p>
            <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-muted">
              The brief, the pillars, the running list of ideas — whatever you
              would otherwise write in a file you never open again.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DocReader({ doc, onEdit }: { doc: DocView; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      key={doc.id}
      className={cn(
        "animate-rise rounded-tile bg-card p-5 shadow-card",
        pending && "pointer-events-none opacity-45",
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold tracking-tight text-ink">
            {doc.title}
          </h3>
          <p className="mt-1 text-[11.5px] text-faint">{doc.updatedLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-chip bg-inset px-3 py-1.5 text-[12.5px] text-muted transition-colors duration-(--duration-quick) hover:text-ink active:scale-[0.97]"
          >
            <Pencil className="size-3.5" strokeWidth={2} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (!confirming) {
                setConfirming(true);
                return;
              }
              startTransition(() => deleteDoc(doc.id));
            }}
            className={cn(
              "grid size-8 place-items-center rounded-full transition-colors duration-(--duration-quick) active:scale-90",
              confirming
                ? "bg-accent-soft text-accent"
                : "text-faint hover:text-accent",
            )}
            aria-label={confirming ? "Confirm delete" : "Delete doc"}
            title={confirming ? "Tap again to delete" : "Delete doc"}
          >
            <Trash2 className="size-4" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <Markdown source={doc.body} skipLeadingHeading />
    </div>
  );
}

const field =
  "w-full rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";

function DocEditor({
  projectId,
  doc,
  onDone,
}: {
  projectId: string;
  doc: DocView | null;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await saveDoc(form);
        onDone();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save");
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "animate-rise rounded-tile bg-card p-5 shadow-card",
        pending && "pointer-events-none opacity-45",
      )}
    >
      <input type="hidden" name="projectId" value={projectId} />
      {doc && <input type="hidden" name="id" value={doc.id} />}

      <div className="mb-3 flex items-center gap-2">
        <input
          name="title"
          defaultValue={doc?.title ?? ""}
          placeholder="Doc title"
          autoFocus={doc === null}
          className={`${field} text-[15px] font-medium`}
        />
        <button
          type="button"
          onClick={onDone}
          aria-label="Cancel"
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-[background-color,color,transform] duration-(--duration-base) ease-soft hover:rotate-90 hover:bg-inset hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      <textarea
        name="body"
        defaultValue={doc?.body ?? ""}
        rows={20}
        placeholder={"## A heading\n\nMarkdown: **bold**, lists, [links](https://…), `code`."}
        className={`${field} resize-y font-mono text-[12.5px] leading-relaxed`}
      />

      {error && <p className="mt-2 text-[12.5px] text-accent">{error}</p>}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-chip px-3.5 py-2 text-[13px] text-muted hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
