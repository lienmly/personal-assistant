"use server";

import { auth } from "@/lib/auth";
import { forgetNote, getNotes } from "@/lib/montblanc/memory";
import type { NoteView } from "@/lib/montblanc/types";

/**
 * The two things the drawer does with Montblanc's memory: read it, and correct
 * it. Server actions rather than route handlers because both are things the
 * person is waiting on, which is the opposite of the distiller.
 *
 * Both re-check the session, the rule every action in this app follows.
 */

/** Every live note, for the "What I remember" list in the empty state. Asked for
 *  on expand rather than on open — the drawer exists to be typed into, and this
 *  is a query nobody makes most times they open it. */
export async function listNotes(): Promise<NoteView[]> {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  // Deliberately more than the prompt is given: if Montblanc knows twenty
  // things, being shown fifteen of them would make the list a worse answer to
  // "what do you remember" than the question deserves.
  return getNotes(50);
}

/**
 * Strike one note out.
 *
 * This is the memory's half of the receipt bargain (§6, "A receipt is what a
 * confirmation step would have cost you"). Montblanc is allowed to conclude
 * things about you between conversations without asking first — **because** the
 * conclusions are visible and one tap removes them. Without this the feature is
 * the app asserting things nobody told it, one layer up from a seeded task.
 */
export async function forgetNoteAction(id: string): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  await forgetNote(id);
}
