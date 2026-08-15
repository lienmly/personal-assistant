"use server";

import { auth } from "@/lib/auth";
import { deleteEvent } from "@/lib/event-actions";
import { deleteJournalEntry } from "@/lib/journal-actions";
import { deleteProject } from "@/lib/project-actions";
import { deleteContentItem } from "@/lib/studio-actions";
import { deleteTask } from "@/lib/task-actions";
import { releaseTransaction } from "@/lib/ledger-actions";

import type { ReceiptKind } from "@/lib/montblanc/types";

/**
 * Take back what Montblanc just made.
 *
 * This is the price of letting an assistant write straight through without
 * asking first, and it is a price worth paying rather than an omission
 * apologised for. The obvious safe design — show a draft, make them confirm —
 * costs the entire point of the feature: the ask was "quick: add this bug to
 * this app", one-handed, and a confirmation step turns one tap into two on
 * every single row including the ninety-five in a hundred that are right.
 *
 * §6 already settled what a wrong row costs: "a row you wrote and no longer
 * want costs one tap to delete. A row *you did not write* costs you a stop, a
 * re-read, and a decision about whether it was yours." Montblanc's rows are the
 * second kind — you asked for something, but the filing was its idea — so the
 * receipt in the drawer is what turns them back into the first kind. You see
 * exactly what was made and where, without going to look, and undoing it is one
 * tap in the same place.
 *
 * It goes through the same delete actions the UI uses, for the reason
 * `tools.ts` gives about the writes: `deleteProject` refuses a project that
 * holds anything, `deleteTask` cascades its checklist, and both keep the
 * revalidations right.
 */
export async function undoMontblanc(kind: ReceiptKind, id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");

  switch (kind) {
    // A step is a Task like any other; its parent is left alone, which is what
    // "undo the step I just added" means.
    case "task":
    case "subtask":
      await deleteTask(id);
      return;
    case "contentItem":
      await deleteContentItem(id);
      return;
    case "project":
      // Refuses if anything has been hung off it since. That is the right
      // failure: the message names what is holding it, and by then undoing is
      // not what you want anyway.
      await deleteProject(id);
      return;
    case "event":
      await deleteEvent(id);
      return;
    case "journalEntry":
      await deleteJournalEntry(id);
      return;
    case "transactionClaim":
      // **Releases the claim; it does not delete the transaction.** A bank row
      // is a payment that really happened, and undoing "file this against the
      // rental" cannot mean "pretend it never left the account". Safe to clear
      // outright because `claim_transaction` refuses a row that is already
      // claimed — so the state before was always unclaimed.
      await releaseTransaction(id);
      return;
  }
}
