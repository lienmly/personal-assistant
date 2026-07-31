"use server";

import { revalidatePath } from "next/cache";
import type {
  Cadence,
  ChannelPostState,
  ChannelState,
  DropFormat,
  DropStage,
  Platform,
  Prisma,
} from "@prisma/client";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { STAGE_ORDER, type StageId } from "@/lib/platforms";

/**
 * Every action goes through this. The layout already gates the pages, but
 * server actions are their own public endpoints — the route guard does not
 * cover them, so each one re-checks the session itself.
 */
async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session;
}

function refresh() {
  revalidatePath("/studio");
  revalidatePath("/studio/batch");
  revalidatePath("/studio/channels");
  revalidatePath("/today");
  revalidatePath("/projects");
}

function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Publishing is the event that proves a project is alive — it's what section 4
 *  of Today reads. Bump it from one place so no caller can forget. */
async function touchProject(
  tx: Prisma.TransactionClient,
  projectId: string | null,
) {
  if (!projectId) return;
  await tx.project.update({
    where: { id: projectId },
    data: { lastTouchedAt: new Date() },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Drops
// ─────────────────────────────────────────────────────────────────────────────

export async function saveDrop(form: FormData) {
  await requireSession();

  const id = str(form, "id");
  const brandId = str(form, "brandId");
  const title = str(form, "title") ?? "";
  const publishAtRaw = str(form, "publishAt");
  const channelIds = form.getAll("channelIds").filter(
    (value): value is string => typeof value === "string" && value !== "",
  );

  if (!brandId) throw new Error("A drop needs a brand — who is publishing it?");

  const data = {
    title,
    notes: str(form, "notes"),
    body: str(form, "body"),
    refUrl: str(form, "refUrl"),
    brandId,
    projectId: str(form, "projectId"),
    format: (str(form, "format") ?? "short_video") as DropFormat,
    stage: (str(form, "stage") ?? "idea") as DropStage,
    publishAt: publishAtRaw ? new Date(publishAtRaw) : null,
  };

  const drop = id
    ? await db.drop.update({ where: { id }, data })
    : await db.drop.create({ data });

  // Reconcile the channel fan-out. Rows already published are kept even if the
  // box was unticked — deleting them would throw away the URL.
  const existing = await db.dropChannel.findMany({ where: { dropId: drop.id } });
  const keep = new Set(channelIds);

  const removable = existing.filter(
    (row) => !keep.has(row.channelId) && row.state !== "published",
  );
  if (removable.length > 0) {
    await db.dropChannel.deleteMany({
      where: { id: { in: removable.map((row) => row.id) } },
    });
  }

  const have = new Set(existing.map((row) => row.channelId));
  const additions = channelIds.filter((channelId) => !have.has(channelId));
  if (additions.length > 0) {
    await db.dropChannel.createMany({
      data: additions.map((channelId) => ({ dropId: drop.id, channelId })),
      skipDuplicates: true,
    });
  }

  refresh();
  return drop.id;
}

/**
 * The batch save. A week of dailies on two accounts is fourteen posts, and
 * they're produced in one sitting — so the composer submits all fourteen at
 * once rather than making you open fourteen panels.
 *
 * Fields arrive as `title:<dropId>` / `ref:<dropId>`. `advanceTo` comes from
 * whichever button was pressed and only ever moves a row *forward*: a slot you
 * already scheduled must not be dragged back to `produce` because it happened
 * to be on screen.
 */
export async function saveBatch(form: FormData) {
  await requireSession();

  const advanceTo = str(form, "advanceTo") as DropStage | null;
  const edits = new Map<string, { title?: string; refUrl?: string | null }>();

  for (const [key, value] of form.entries()) {
    if (typeof value !== "string") continue;
    const split = key.indexOf(":");
    if (split === -1) continue;

    const field = key.slice(0, split);
    const id = key.slice(split + 1);
    if (field !== "title" && field !== "ref") continue;

    const entry = edits.get(id) ?? {};
    const trimmed = value.trim();
    if (field === "title") entry.title = trimmed;
    else entry.refUrl = trimmed === "" ? null : trimmed;
    edits.set(id, entry);
  }

  if (edits.size === 0) return 0;

  const current = await db.drop.findMany({
    where: { id: { in: [...edits.keys()] } },
    select: { id: true, title: true, refUrl: true, stage: true },
  });

  const rank = (stage: DropStage) => STAGE_ORDER.indexOf(stage as StageId);

  const writes = current.flatMap((drop) => {
    const edit = edits.get(drop.id);
    if (!edit) return [];

    const title = edit.title ?? drop.title;
    const refUrl = edit.refUrl !== undefined ? edit.refUrl : drop.refUrl;

    // A row is only worth advancing once it actually says something — an empty
    // slot marked "produced" is a lie the board would then hide from you.
    const filled = title.trim() !== "";
    const stage =
      advanceTo && filled && rank(advanceTo) > rank(drop.stage)
        ? advanceTo
        : drop.stage;

    if (title === drop.title && refUrl === drop.refUrl && stage === drop.stage) {
      return [];
    }

    return [
      db.drop.update({
        where: { id: drop.id },
        data: { title, refUrl, stage },
      }),
    ];
  });

  if (writes.length > 0) await db.$transaction(writes);

  refresh();
  return writes.length;
}

export async function moveDrop(dropId: string, stage: string) {
  await requireSession();

  await db.$transaction(async (tx) => {
    const drop = await tx.drop.update({
      where: { id: dropId },
      data: {
        stage: stage as DropStage,
        publishedAt: stage === "published" ? new Date() : null,
      },
    });

    if (stage === "published") {
      await tx.dropChannel.updateMany({
        where: { dropId, state: { in: ["pending", "scheduled"] } },
        data: { state: "published", publishedAt: new Date() },
      });
      await touchProject(tx, drop.projectId);
    }
  });

  refresh();
}

export async function deleteDrop(dropId: string) {
  await requireSession();
  await db.drop.delete({ where: { id: dropId } });
  refresh();
}

/**
 * Repurposing, kind 2: same idea, different form — a Medium essay becoming a
 * Threads post. Kind 1 (same asset, more places) needs none of this; it's just
 * another ticked channel box on the original drop.
 */
export async function deriveDrop(form: FormData) {
  await requireSession();

  const sourceDropId = str(form, "sourceDropId");
  const brandId = str(form, "brandId");
  const format = str(form, "format") ?? "text_post";
  const channelIds = form.getAll("channelIds").filter(
    (value): value is string => typeof value === "string" && value !== "",
  );
  if (!sourceDropId || !brandId) throw new Error("Missing source or brand");

  const source = await db.drop.findUniqueOrThrow({ where: { id: sourceDropId } });

  const derived = await db.drop.create({
    data: {
      title: source.title,
      notes: source.notes,
      // The body is carried over as a starting point — it will need rewriting
      // for the new form, which is the whole reason this is a separate drop.
      body: source.body,
      format: format as DropFormat,
      stage: "script",
      brandId,
      projectId: source.projectId,
      sourceDropId: source.id,
      channels: { create: channelIds.map((channelId) => ({ channelId })) },
    },
  });

  refresh();
  return derived.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-channel publishing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The checklist. Ticking the last outstanding channel moves the whole drop to
 * `published` and bumps its project — so the common case (post it everywhere,
 * paste the links) never needs a separate "mark done" step.
 */
export async function setChannelState(form: FormData) {
  await requireSession();

  const id = str(form, "dropChannelId");
  const state = str(form, "state") ?? "pending";
  const publishedUrl = str(form, "publishedUrl");
  if (!id) throw new Error("Missing channel row");

  await db.$transaction(async (tx) => {
    const row = await tx.dropChannel.update({
      where: { id },
      data: {
        state: state as ChannelPostState,
        publishedUrl,
        publishedAt: state === "published" ? new Date() : null,
      },
    });

    const siblings = await tx.dropChannel.findMany({
      where: { dropId: row.dropId },
    });
    const outstanding = siblings.filter(
      (sibling) => sibling.state !== "published" && sibling.state !== "skipped",
    );

    if (outstanding.length === 0 && siblings.some((s) => s.state === "published")) {
      const drop = await tx.drop.update({
        where: { id: row.dropId },
        data: { stage: "published", publishedAt: new Date() },
      });
      await touchProject(tx, drop.projectId);
    }
  });

  refresh();
}

// ─────────────────────────────────────────────────────────────────────────────
// Brands, channels, series
// ─────────────────────────────────────────────────────────────────────────────

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function saveBrand(form: FormData) {
  await requireSession();

  const id = str(form, "id");
  const name = str(form, "name");
  if (!name) throw new Error("A brand needs a name");

  const data = {
    name,
    tagline: str(form, "tagline"),
    color: str(form, "color") ?? "#8b847e",
  };

  if (id) {
    await db.brand.update({ where: { id }, data });
  } else {
    await db.brand.create({ data: { ...data, slug: slugify(name) } });
  }

  refresh();
}

export async function saveChannel(form: FormData) {
  await requireSession();

  const id = str(form, "id");
  const brandId = str(form, "brandId");
  const handle = str(form, "handle")?.replace(/^@/, "");
  const platform = str(form, "platform");
  if (!handle || !platform) throw new Error("A channel needs a platform and handle");

  const data = {
    handle,
    platform: platform as Platform,
    label: str(form, "label"),
    url: str(form, "url"),
    state: (str(form, "state") ?? "planned") as ChannelState,
  };

  if (id) {
    await db.channel.update({ where: { id }, data });
  } else {
    if (!brandId) throw new Error("A channel needs a brand");
    await db.channel.create({ data: { ...data, brandId } });
  }

  refresh();
}

export async function deleteChannel(channelId: string) {
  await requireSession();
  await db.channel.delete({ where: { id: channelId } });
  refresh();
}

export async function toggleSeries(seriesId: string, isActive: boolean) {
  await requireSession();
  await db.series.update({ where: { id: seriesId }, data: { isActive } });
  refresh();
}

export async function saveSeries(form: FormData) {
  await requireSession();

  const id = str(form, "id");
  const brandId = str(form, "brandId");
  const name = str(form, "name");
  const channelIds = form.getAll("channelIds").filter(
    (value): value is string => typeof value === "string" && value !== "",
  );
  const daysOfWeek = form
    .getAll("daysOfWeek")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7);

  if (!name || !brandId) throw new Error("A series needs a name and a brand");

  const data = {
    name,
    brandId,
    projectId: str(form, "projectId"),
    format: (str(form, "format") ?? "short_video") as DropFormat,
    cadence: (str(form, "cadence") ?? "daily") as Cadence,
    daysOfWeek,
    timeOfDay: str(form, "timeOfDay"),
    isActive: form.get("isActive") === "on",
  };

  const series = id
    ? await db.series.update({ where: { id }, data })
    : await db.series.create({
        data: { ...data, startsOn: new Date(new Date().toISOString().slice(0, 10)) },
      });

  await db.seriesChannel.deleteMany({
    where: { seriesId: series.id, channelId: { notIn: channelIds } },
  });
  await db.seriesChannel.createMany({
    data: channelIds.map((channelId) => ({ seriesId: series.id, channelId })),
    skipDuplicates: true,
  });

  refresh();
}
