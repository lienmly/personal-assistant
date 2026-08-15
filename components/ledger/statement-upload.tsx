"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Upload } from "lucide-react";

import {
  disconnectGmail,
  scanMailNow,
  uploadStatement,
} from "@/lib/statement-actions";
import type { StatementQueueView } from "@/lib/statements";
import { cn } from "@/lib/utils";

/**
 * How statements get in — the mailbox, and the manual path beside it.
 *
 * **Uploading is a first-class path, not a fallback.** It needs neither the
 * Gmail grant nor the poll, which is what made the whole extraction pipeline
 * testable before any OAuth existed — and it is the answer on the day the
 * manager changes sender or emails a portal link instead of a PDF.
 *
 * The Gmail half states its own absence. "Last looked: 13 Aug" is the point: an
 * automation that has quietly stopped looks exactly like one with nothing to
 * find, and this is the only place that difference can be shown.
 */
export function StatementSources({
  queue,
  properties,
  notice,
}: {
  queue: StatementQueueView;
  properties: { id: string; label: string }[];
  notice: { kind: "ok" | "error"; message: string } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const upload = (file: File) => {
    setError(null);
    const form = new FormData();
    form.set("file", file);
    // Attached straight away when there is only one candidate; otherwise the
    // review screen asks, because guessing which property a statement belongs to
    // is the same error as attaching a mortgage by address similarity.
    if (properties.length === 1) form.set("propertyId", properties[0].id);

    startTransition(async () => {
      const result = await uploadStatement(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        pending && "pointer-events-none opacity-45",
      )}
    >
      {notice && (
        <p
          className={cn(
            "rounded-tile px-3.5 py-2.5 text-[13px]",
            notice.kind === "ok"
              ? "bg-inset text-muted"
              : "bg-bad-soft text-bad",
          )}
        >
          {notice.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {queue.gmailConnected ? (
          <>
            <span className="inline-flex items-center gap-2 rounded-chip bg-inset px-3.5 py-2 text-[13px] text-muted">
              <Mail className="size-3.5 text-good" strokeWidth={1.8} />
              {queue.gmailEmail}
            </span>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await scanMailNow();
                  router.refresh();
                })
              }
              className="rounded-chip px-3 py-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
            >
              Look now
            </button>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await disconnectGmail();
                  router.refresh();
                })
              }
              className="rounded-chip px-3 py-2 text-[13px] text-faint transition-colors duration-(--duration-quick) hover:text-ink"
            >
              Disconnect
            </button>
          </>
        ) : (
          <a
            href="/api/ledger/gmail/connect"
            className="inline-flex items-center gap-2 rounded-chip bg-inset px-4 py-2 text-[13px] font-medium text-ink transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-line/60 active:scale-[0.97]"
          >
            <Mail className="size-3.5" strokeWidth={2} />
            Read statements from email
          </a>
        )}

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="inline-flex items-center gap-2 rounded-chip px-3 py-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink active:scale-[0.97]"
        >
          <Upload className="size-3.5" strokeWidth={1.8} />
          Upload a PDF
        </button>

        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
            event.target.value = "";
          }}
        />
      </div>

      <p className="text-xs leading-relaxed text-faint">
        {queue.gmailConnected ? (
          <>
            Read-only, and only mail from your management company with a PDF
            attached in the last 60 days. No message is ever stored — just the
            statement and the rows read out of it.
            {queue.lastScanLabel && ` Last looked: ${queue.lastScanLabel}.`}
            {queue.lastAcceptedLabel &&
              ` Most recent statement: ${queue.lastAcceptedLabel}.`}
          </>
        ) : (
          <>
            Connecting Gmail is separate from signing in, and read-only. The
            search is narrowed to your management company, with an attachment, in
            the last 60 days.
          </>
        )}
      </p>

      {queue.gmailError && (
        <p className="text-xs text-bad">
          {queue.gmailError} It needs reconnecting.
        </p>
      )}

      {error && <p className="text-[13px] text-bad">{error}</p>}
    </div>
  );
}
