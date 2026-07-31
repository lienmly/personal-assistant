import { db } from "@/lib/db";

/** UTC midnight for a local calendar day — `@db.Date` columns store no zone,
 *  so everything that touches slotDate has to agree on this one convention. */
export function dateKey(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
function isoDay(date: Date): number {
  return date.getUTCDay() === 0 ? 7 : date.getUTCDay();
}

function matchesCadence(
  date: Date,
  cadence: string,
  daysOfWeek: number[],
): boolean {
  switch (cadence) {
    case "daily":
      return true;
    case "weekdays":
      return isoDay(date) <= 5;
    case "weekly":
    case "custom":
      return daysOfWeek.includes(isoDay(date));
    default:
      return false;
  }
}

/**
 * Materialises the next `horizonDays` of every active Series as real Drops.
 *
 * Called on Studio load rather than from a cron: it's idempotent (the
 * [seriesId, slotDate] unique constraint guarantees that), it's a handful of
 * rows, and it means the app has no infrastructure dependency to keep the
 * daily cadence alive. Slots land in `idea` with the series' channels already
 * attached, so the daily post is a card to fill in, not a row to create.
 */
export async function ensureSeriesSlots(): Promise<number> {
  const today = dateKey(new Date());

  const series = await db.series.findMany({
    where: {
      isActive: true,
      startsOn: { lte: addDays(today, 60) },
      OR: [{ endsOn: null }, { endsOn: { gte: today } }],
    },
    include: { channels: true },
  });

  let created = 0;

  for (const s of series) {
    const from = s.startsOn > today ? s.startsOn : today;
    const to = addDays(today, s.horizonDays);
    if (from > to) continue;

    const wanted: Date[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (s.endsOn && d > s.endsOn) break;
      if (matchesCadence(d, s.cadence, s.daysOfWeek)) wanted.push(d);
    }
    if (wanted.length === 0) continue;

    const existing = await db.drop.findMany({
      where: { seriesId: s.id, slotDate: { in: wanted } },
      select: { slotDate: true },
    });
    const have = new Set(
      existing.map((row) => row.slotDate?.toISOString().slice(0, 10)),
    );

    const [hours, minutes] = (s.timeOfDay ?? "09:00").split(":").map(Number);

    for (const day of wanted) {
      if (have.has(day.toISOString().slice(0, 10))) continue;

      const publishAt = new Date(day);
      publishAt.setUTCHours(hours || 0, minutes || 0, 0, 0);

      await db.drop.create({
        data: {
          title: "",
          format: s.format,
          stage: "idea",
          publishAt,
          slotDate: day,
          seriesId: s.id,
          brandId: s.brandId,
          projectId: s.projectId,
          channels: {
            create: s.channels.map((link) => ({ channelId: link.channelId })),
          },
        },
      });
      created += 1;
    }
  }

  return created;
}

export type StudioBoard = Awaited<ReturnType<typeof getStudioBoard>>;
export type StudioDrop = StudioBoard["drops"][number];

/**
 * Everything the board needs in one round trip. Published drops are capped —
 * the column is a receipt, not an archive, and an unbounded one would grow by
 * two rows a day forever.
 */
export async function getStudioBoard(brandSlug?: string) {
  const brandFilter = brandSlug ? { brand: { slug: brandSlug } } : {};

  const [drops, brands, projects] = await Promise.all([
    db.drop.findMany({
      where: {
        ...brandFilter,
        OR: [
          { stage: { not: "published" } },
          { publishedAt: { gte: addDays(dateKey(new Date()), -30) } },
        ],
      },
      include: {
        brand: { select: { id: true, name: true, slug: true, color: true } },
        project: { select: { id: true, name: true, slug: true } },
        series: { select: { id: true, name: true } },
        channels: {
          include: {
            channel: {
              select: { id: true, platform: true, handle: true, label: true },
            },
          },
          orderBy: { channel: { sortOrder: "asc" } },
        },
      },
      orderBy: [{ publishAt: "asc" }, { createdAt: "asc" }],
    }),
    db.brand.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        channels: { orderBy: { sortOrder: "asc" } },
        _count: { select: { drops: true } },
      },
    }),
    db.project.findMany({
      where: { status: { in: ["active", "simmering"] } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return { drops, brands, projects };
}

/**
 * The upcoming series slots, for the batch composer.
 *
 * Reaches two days into the past on purpose: a slot whose day has gone by and
 * was never filled is the single most useful thing this screen can show you,
 * and it would be invisible in a strictly forward-looking window.
 */
export async function getBatchSlots() {
  const from = addDays(dateKey(new Date()), -2);

  return db.drop.findMany({
    where: {
      seriesId: { not: null },
      slotDate: { gte: from },
      stage: { not: "published" },
    },
    include: {
      brand: { select: { id: true, name: true, slug: true, color: true } },
      series: { select: { id: true, name: true } },
      channels: {
        include: {
          channel: {
            select: { id: true, platform: true, handle: true, label: true },
          },
        },
        orderBy: { channel: { sortOrder: "asc" } },
      },
    },
    orderBy: [{ slotDate: "asc" }, { publishAt: "asc" }],
  });
}

export async function getChannelRoster() {
  return db.brand.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      channels: {
        orderBy: [{ state: "asc" }, { sortOrder: "asc" }],
        include: { _count: { select: { posts: true } } },
      },
      series: {
        orderBy: { name: "asc" },
        include: {
          channels: { include: { channel: true } },
          project: { select: { name: true } },
          _count: { select: { drops: true } },
        },
      },
    },
  });
}
