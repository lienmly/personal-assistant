"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  FileText,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import type { LineItemView, StatementView } from "@/lib/statements";
import { STATEMENT_KINDS, STATEMENT_KIND_LABEL } from "@/lib/statement-rules";
import {
  acceptStatement,
  assignStatement,
  deleteLineItem,
  reextractStatement,
  rejectStatement,
  saveLineItem,
} from "@/lib/statement-actions";
import { cn } from "@/lib/utils";

/**
 * One statement, and whether it can be believed.
 *
 * The screen is built around a single question: **do the rows add up to what the
 * document says about itself?** That check is the only reason a language model
 * is allowed to read a financial PDF, so it is the loudest thing here — the
 * stated totals sit next to the row totals, and the accept button is disabled
 * with a sentence rather than allowed to fail on press.
 *
 * The PDF is one tap away on every row, served through the auth-gated route, and
 * every row carries the verbatim source line it was read from. **Reconciliation
 * catches every error that changes a total and no error that does not** — a
 * repair mislabelled as insurance adds up perfectly — so the design has to make
 * checking a row cheap, not just make the arithmetic pass.
 */

const fieldBase =
  "rounded-chip bg-inset px-2.5 py-1.5 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";

export function StatementReview({
  statement,
  properties,
}: {
  statement: StatementView;
  properties: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(statement.status === "needs_review");

  const run = (action: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message ?? "That did not work.");
        return;
      }
      router.refresh();
    });
  };

  const reconciles = statement.problem === null;
  const accepted = statement.status === "accepted";

  return (
    <section
      className={cn(
        "rounded-card bg-card p-5 shadow-card transition-opacity duration-(--duration-base)",
        pending && "pointer-events-none opacity-45",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            <span>{statement.sourceLabel}</span>
            {statement.receivedLabel && (
              <>
                <span className="text-faint">·</span>
                <span>{statement.receivedLabel}</span>
              </>
            )}
            {accepted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-inset px-2 py-0.5 text-good">
                <Check className="size-3" strokeWidth={2.4} />
                Accepted
              </span>
            )}
            {statement.status === "rejected" && (
              <span className="rounded-full bg-inset px-2 py-0.5 text-faint">
                Set aside
              </span>
            )}
          </div>
          <h3 className="text-[17px] font-semibold tracking-tight text-ink">
            {statement.periodLabel}
            {statement.propertyLabel && (
              <span className="ml-2 text-[13px] font-normal text-muted">
                {statement.propertyLabel}
              </span>
            )}
          </h3>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {statement.documentId && (
            <a
              href={`/api/ledger/statements/${statement.documentId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-chip bg-inset px-3 py-1.5 text-[12.5px] text-muted transition-colors duration-(--duration-quick) hover:text-ink active:scale-[0.97]"
            >
              <FileText className="size-3.5" strokeWidth={1.8} />
              The PDF
            </a>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-chip px-3 py-1.5 text-[12.5px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
          >
            {open ? "Hide rows" : `${statement.lineItems.length} rows`}
          </button>
        </div>
      </div>

      {/* The reconciliation, stated first and in full. */}
      <div
        className={cn(
          "mt-4 rounded-tile px-4 py-3",
          reconciles ? "bg-inset" : "bg-bad-soft",
        )}
      >
        <div className="flex flex-wrap items-start gap-2">
          {reconciles ? (
            <Check className="mt-0.5 size-4 shrink-0 text-good" strokeWidth={2.4} />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-bad" strokeWidth={2} />
          )}
          <p
            className={cn(
              "text-[13px] leading-relaxed",
              reconciles ? "text-muted" : "text-bad",
            )}
          >
            {reconciles
              ? "The rows add up to the totals printed on the statement, to the cent."
              : statement.problem}
          </p>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-4">
          <Pair label="Rows say in" value={statement.rowIncomeLabel} />
          <Pair label="Statement says" value={statement.statedIncomeLabel ?? "—"} />
          <Pair label="Rows say out" value={statement.rowExpenseLabel} />
          <Pair label="Statement says" value={statement.statedExpenseLabel ?? "—"} />
        </dl>
      </div>

      {statement.lowConfidenceCount > 0 && !accepted && (
        <p className="mt-3 text-[12.5px] text-warn">
          {statement.lowConfidenceCount}{" "}
          {statement.lowConfidenceCount === 1 ? "row was" : "rows were"} hard to
          read. Adding up correctly does not mean each row is labelled right —
          check those first.
        </p>
      )}

      {open && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {statement.lineItems.map((item) => (
            <LineItemRow key={item.id} item={item} disabled={accepted} />
          ))}
        </ul>
      )}

      {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}

      {!accepted && statement.status !== "rejected" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!statement.propertyId && properties.length > 0 && (
            <select
              defaultValue=""
              onChange={(event) =>
                event.target.value &&
                run(() => assignStatement(statement.id, event.target.value))
              }
              className={fieldBase}
              aria-label="Which property"
            >
              <option value="">Which property?</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.label}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            disabled={!reconciles || !statement.propertyId}
            onClick={() => run(() => acceptStatement(statement.id))}
            title={
              !statement.propertyId
                ? "Say which property this belongs to first"
                : reconciles
                  ? undefined
                  : "The rows do not match the statement's own totals"
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-chip px-4 py-2 text-[13px] font-medium transition-[background-color,transform] duration-(--duration-base) ease-soft active:scale-[0.97]",
              reconciles && statement.propertyId
                ? "bg-accent text-white hover:bg-accent-hover"
                : "cursor-not-allowed bg-inset text-faint",
            )}
          >
            <Check className="size-3.5" strokeWidth={2.4} />
            Accept
          </button>

          <button
            type="button"
            onClick={() => run(() => reextractStatement(statement.id))}
            className="inline-flex items-center gap-1.5 rounded-chip px-3 py-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
          >
            <RefreshCw className="size-3.5" strokeWidth={1.8} />
            Read it again
          </button>

          <button
            type="button"
            onClick={() => run(() => rejectStatement(statement.id))}
            className="ml-auto rounded-chip px-3 py-2 text-[13px] text-faint transition-colors duration-(--duration-quick) hover:text-ink"
          >
            Set aside
          </button>
        </div>
      )}
    </section>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-faint">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  );
}

function LineItemRow({
  item,
  disabled,
}: {
  item: LineItemView;
  disabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      await saveLineItem(form);
      setEditing(false);
      router.refresh();
    });
  };

  const uncertain = item.confidence < 70 && !item.reviewed;

  if (editing) {
    return (
      <li
        className={cn(
          "rounded-tile bg-inset px-3 py-2.5",
          pending && "pointer-events-none opacity-45",
        )}
      >
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={item.id} />
          <input
            name="description"
            defaultValue={item.description}
            className={`${fieldBase} min-w-0 flex-1`}
            aria-label="Description"
          />
          <select
            name="kind"
            defaultValue={item.kind}
            className={fieldBase}
            aria-label="Kind"
          >
            {STATEMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {STATEMENT_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
          <input
            name="amount"
            defaultValue={(item.amountCents / 100).toFixed(2)}
            className={`${fieldBase} w-28 text-right`}
            inputMode="decimal"
            aria-label="Amount"
          />
          <button
            type="submit"
            className="rounded-chip bg-accent px-3 py-1.5 text-[12.5px] font-medium text-white active:scale-[0.97]"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label="Cancel"
            className="rounded-chip p-1.5 text-faint hover:text-ink"
          >
            <X className="size-3.5" strokeWidth={2} />
          </button>
        </form>
        {item.rawText && (
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-faint">
            {item.rawText}
          </p>
        )}
      </li>
    );
  }

  return (
    <li
      className={cn(
        "group rounded-tile px-3 py-2 transition-colors duration-(--duration-quick)",
        uncertain ? "bg-warn-soft" : "bg-inset",
        pending && "pointer-events-none opacity-45",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-ink">{item.description}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-faint">
            {item.dayLabel && <span>{item.dayLabel}</span>}
            <span>{item.kindLabel}</span>
            {item.taxCategoryLabel ? (
              <span className="text-muted">→ {item.taxCategoryLabel}</span>
            ) : (
              <span title="Not income and not an expense — a movement of money">
                → not on the Schedule E
              </span>
            )}
            {uncertain && (
              <span className="text-warn">{item.confidence}% sure</span>
            )}
          </p>
        </div>

        <span
          className={cn(
            "shrink-0 text-[13px] tabular-nums",
            item.amountCents > 0 ? "text-good" : "text-ink",
          )}
        >
          {item.amountLabel}
        </span>

        {!disabled && (
          <div className="flex shrink-0 gap-0.5 sm:opacity-0 sm:group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-chip px-2 py-1 text-[11.5px] text-muted hover:text-ink"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await deleteLineItem(item.id);
                  router.refresh();
                })
              }
              aria-label="Remove row"
              className="rounded-chip p-1 text-faint hover:text-bad"
            >
              <Trash2 className="size-3.5" strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>

      {/* The verbatim source line. This is what makes checking a row cheap, and
          checking rows is the half reconciliation cannot do for you. */}
      {item.rawText && (
        <p className="mt-1.5 truncate font-mono text-[11px] text-faint/80">
          {item.rawText}
        </p>
      )}
    </li>
  );
}
