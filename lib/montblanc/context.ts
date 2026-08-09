import { db } from "@/lib/db";
import { TRACKS } from "@/lib/tracks";
import { todayKey } from "@/lib/utils";

/**
 * What exists, rendered as text for the system prompt.
 *
 * **This is deliberately not a tool.** The obvious build gives Montblanc a
 * `list_projects` and lets it go and look, and that costs a whole extra round
 * trip — three or four seconds — on *every* request, to fetch about six hundred
 * characters that change roughly once a fortnight. The five areas, five
 * projects, five brands and the track list are small enough to simply hand over
 * up front, and the request that used to need two model calls now needs one.
 *
 * It is also what makes the slugs reliable. The model is choosing from a list it
 * can see rather than guessing an identifier, which is the difference between
 * "file this under Sleepy Cat" working and it inventing `sleepycat`.
 */
export async function buildContext(): Promise<string> {
  const [areas, projects, brands] = await Promise.all([
    db.area.findMany({
      orderBy: { sortOrder: "asc" },
      select: { slug: true, name: true },
    }),
    db.project.findMany({
      where: { status: { in: ["active", "simmering"] } },
      orderBy: [{ priority: "asc" }, { sortOrder: "asc" }],
      select: {
        slug: true,
        name: true,
        focus: true,
        priority: true,
        status: true,
        area: { select: { slug: true } },
      },
    }),
    db.brand.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        slug: true,
        name: true,
        project: { select: { slug: true } },
        channels: {
          where: { state: { not: "paused" } },
          orderBy: { id: "asc" },
          select: { platform: true, handle: true, state: true },
        },
      },
    }),
  ]);

  const today = todayKey();
  const weekday = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
  }).format(new Date());

  const lines: string[] = [];

  lines.push(`TODAY IS ${today} (${weekday}).`);

  lines.push("", "AREAS (slug — name):");
  for (const area of areas) lines.push(`- ${area.slug} — ${area.name}`);

  lines.push("", "PROJECTS (slug — name · area · tier):");
  for (const project of projects) {
    const focus = project.focus ? ` · aiming at: ${project.focus}` : "";
    lines.push(
      `- ${project.slug} — ${project.name} · area ${project.area.slug} · ${project.priority}/${project.status}${focus}`,
    );
  }

  lines.push("", "BRANDS (slug — name · accounts):");
  for (const brand of brands) {
    const accounts =
      brand.channels.length > 0
        ? brand.channels
            .map(
              (channel) =>
                `${channel.platform} ${channel.handle}${channel.state === "planned" ? " (planned)" : ""}`,
            )
            .join(", ")
        : "no accounts yet";
    const owner = brand.project
      ? ` · is the work of project ${brand.project.slug}`
      : "";
    lines.push(`- ${brand.slug} — ${brand.name}${owner} · ${accounts}`);
  }

  lines.push(
    "",
    `TRACKS (a task's workstream — free text, these are the established ones): ${TRACKS.join(", ")}.`,
  );

  return lines.join("\n");
}
