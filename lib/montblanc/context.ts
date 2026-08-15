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

  // The Ledger, when there is one. Kept to the *names* — accounts, properties,
  // and whether the tax year is computable — for the same reason the projects
  // are: they are what a sentence names, they change once a fortnight, and
  // fetching them behind a tool would cost a round trip on every request.
  //
  // Deliberately no balances and no figures. Money is what the Ledger is for,
  // and a number in the prompt is a number the model can repeat back stale.
  const [accounts, properties, ruleSet] = await Promise.all([
    db.account.findMany({
      where: { closedAt: null },
      orderBy: { sortOrder: "asc" },
      select: { name: true, mask: true, kind: true },
      take: 25,
    }),
    db.property.findMany({
      where: { status: { not: "sold" } },
      orderBy: { sortOrder: "asc" },
      select: { slug: true, label: true, addressLine: true },
    }),
    db.taxRuleSet.findFirst({
      where: { taxYear: new Date().getUTCFullYear(), jurisdiction: "federal" },
      select: { status: true },
    }),
  ]);

  if (accounts.length > 0 || properties.length > 0) {
    lines.push("", "LEDGER:");
  }

  if (accounts.length > 0) {
    lines.push(
      `- accounts: ${accounts
        .map((account) => `${account.name}${account.mask ? ` ···${account.mask}` : ""} (${account.kind})`)
        .join(", ")}`,
    );
  }

  if (properties.length > 0) {
    lines.push(
      `- properties (slug — name): ${properties
        .map((property) => `${property.slug} — ${property.label}`)
        .join(", ")}`,
    );
  }

  if (ruleSet) {
    lines.push(
      ruleSet.status === "verified"
        ? `- the ${new Date().getUTCFullYear()} tax constants are confirmed, so the estimate computes.`
        : `- the ${new Date().getUTCFullYear()} tax constants are NOT confirmed yet, so there is no tax estimate. Never quote a tax figure; point at the Tax estimate tab.`,
    );
  }

  lines.push(
  );

  return lines.join("\n");
}
