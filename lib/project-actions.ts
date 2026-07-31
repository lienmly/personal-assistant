"use server";

import { revalidatePath } from "next/cache";
import type { ProjectStatus } from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session;
}

/**
 * The explicit "I'm not really on this right now" action (CLAUDE.md §6).
 *
 * A drifting project has two honest answers — pick it back up, or admit it's
 * simmering. Without the second one the warning just accumulates, and a
 * dashboard that only ever adds guilt stops being opened. Demoting does *not*
 * touch `lastTouchedAt`: the project hasn't been worked on, it's been
 * reclassified, and pretending otherwise would falsify the momentum history.
 */
export async function setProjectStatus(projectId: string, status: string) {
  await requireSession();

  await db.project.update({
    where: { id: projectId },
    data: { status: status as ProjectStatus },
  });

  revalidatePath("/today");
  revalidatePath("/projects");
  revalidatePath("/board");
}
