import { db } from "@/lib/db";
import { completeJson } from "@/lib/deepseek";
import { missingFigures } from "@/lib/tax/rules";
import { federalSkeleton } from "@/lib/tax/rulesets/federal";
import { californiaSkeleton } from "@/lib/tax/rulesets/california";

/**
 * Drafting next year's tax constants from the published source.
 *
 * This is the half of "the engine auto-updates its rules" that can honestly be
 * automated: **fetching and extracting.** What is not automated, and will not
 * be, is *confirming* — a draft is filed beside the verified set with the
 * sentence each number came from attached, and somebody reads them.
 *
 * The distinction is the whole design. A tax engine that silently rewrote its
 * own constants and got one wrong would be the worst failure this app could
 * produce: every figure downstream would move, all of them would look
 * authoritative, and nothing would contradict them. So the automation ends one
 * step before the number goes live.
 *
 * ## Why the provenance matters more than the value
 *
 * Every extracted figure carries the **verbatim sentence** it came from. That is
 * what makes confirming cheap enough to actually happen: the reviewer is
 * comparing a number against a quoted line, not searching a 40-page Revenue
 * Procedure for where it might be. A number with no provenance entry is
 * unverified by definition, which is what makes "11 numbers unconfirmed"
 * computable rather than remembered.
 */

/** Where the annual numbers live. `{year}` is substituted. */
const SOURCES: Record<
  "federal" | "ca",
  { label: string; url: string }[]
> = {
  federal: [
    {
      label: "IRS annual inflation adjustments",
      url: "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-{year}",
    },
    {
      label: "IRS standard mileage rates",
      url: "https://www.irs.gov/tax-professionals/standard-mileage-rates",
    },
  ],
  ca: [
    {
      label: "FTB tax rate schedules",
      url: "https://www.ftb.ca.gov/forms/{year}/{year}-california-tax-rate-schedules.html",
    },
  ],
};

const SYSTEM = `You extract published tax constants into JSON. You are a transcriber, not an analyst.

RULES — these matter more than completeness:
1. Return ONLY numbers that appear verbatim in the text. Never compute, infer, interpolate, adjust for inflation, or carry a figure over from a year you happen to know. If a number is not printed in this text, return null for it.
2. Every money amount is in CENTS as an integer. $15,000 is 1500000. Rates are decimals: 22% is 0.22.
3. For EVERY value you return, also return the verbatim sentence or table row it came from, and the section or table number if the text gives one. A value without its source line is useless and will be discarded.
4. A bracket table is an array ordered lowest to highest, each entry {"upToCents": <ceiling or null for the top band>, "rate": <decimal>}. The top band's upToCents is null.
5. If the text covers a different tax year than the one asked for, return null for everything and say so in "problem". Publishing a prior year's numbers as this year's is the single worst thing you could do here.

Return exactly:
{"taxYear": <number or null>, "problem": <string or null>, "figures": {"<dotted.path>": {"value": <number>, "source": "<verbatim line>", "where": "<section/table or null>"}}}

The dotted paths you may fill are given in the user message. Use those exact strings. Omit any you cannot find.`;

type ExtractedFigures = {
  taxYear: number | null;
  problem: string | null;
  figures: Record<
    string,
    { value: number; source: string; where: string | null }
  >;
};

/**
 * Fetch a source and reduce it to text.
 *
 * HTML rather than PDF here, deliberately: the IRS publishes the inflation
 * adjustments as a newsroom page as well as a Revenue Procedure, and a page is
 * both smaller and less likely to defeat extraction than a 40-page PDF. `unpdf`
 * is available for the PDF path if a source only exists that way.
 */
async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: "text/html,application/pdf" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}.`);
  }

  const type = response.headers.get("content-type") ?? "";

  if (type.includes("application/pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }

  const html = await response.text();
  // Crude, and sufficient: scripts and styles out, tags to spaces, whitespace
  // collapsed. A parser would be a dependency for a job that runs once a year.
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** A hard ceiling on what goes to the model. */
const MAX_CHARS = 30_000;

/**
 * Build a draft rule set for a year, from the published sources.
 *
 * Files it as `draft` with per-field provenance, and **never touches a verified
 * set**. Returns a sentence for the job log.
 */
export async function draftRuleSetFor(
  taxYear: number,
  jurisdiction: "federal" | "ca",
): Promise<string> {
  const existing = await db.taxRuleSet.findFirst({
    where: { taxYear, jurisdiction, status: "verified" },
    select: { id: true },
  });
  if (existing) {
    return `${jurisdiction} ${taxYear} is already confirmed — leaving it alone.`;
  }

  const skeleton =
    jurisdiction === "federal"
      ? federalSkeleton(taxYear)
      : californiaSkeleton(taxYear);
  const wanted = missingFigures(skeleton);

  const sources = SOURCES[jurisdiction];
  const collected: ExtractedFigures["figures"] = {};
  const problems: string[] = [];
  let sourceUrl: string | null = null;
  let sourceLabel: string | null = null;

  for (const source of sources) {
    const url = source.url.replace(/\{year\}/g, String(taxYear));
    let text: string;
    try {
      text = await fetchText(url);
    } catch (cause) {
      problems.push(
        `${source.label}: ${cause instanceof Error ? cause.message : "could not be fetched"}`,
      );
      continue;
    }

    if (text.length < 200) {
      problems.push(`${source.label}: almost no text came back.`);
      continue;
    }

    const parsed = await completeJson<ExtractedFigures>({
      system: SYSTEM,
      user: `Tax year: ${taxYear}\nJurisdiction: ${jurisdiction}\n\nFill any of these paths you can find:\n${wanted.join("\n")}\n\n---\n\n${text.slice(0, MAX_CHARS)}`,
      maxTokens: 6000,
    });

    // **A source covering the wrong year is discarded entirely**, not merged.
    // Last year's numbers filed as this year's is precisely the failure this
    // whole design exists to prevent, and it would look completely normal.
    if (parsed.taxYear !== null && parsed.taxYear !== taxYear) {
      problems.push(
        `${source.label}: covers tax year ${parsed.taxYear}, not ${taxYear} — discarded.`,
      );
      continue;
    }
    if (parsed.problem) problems.push(`${source.label}: ${parsed.problem}`);

    for (const [path, figure] of Object.entries(parsed.figures ?? {})) {
      // Only paths the skeleton actually has, and only with a source line.
      if (!wanted.includes(path)) continue;
      if (!figure || typeof figure.value !== "number") continue;
      if (!figure.source || figure.source.trim().length < 8) continue;
      if (collected[path]) continue;

      collected[path] = {
        value: figure.value,
        source: figure.source.trim(),
        where: figure.where ?? null,
      };
    }

    sourceUrl ??= url;
    sourceLabel ??= source.label;
  }

  const found = Object.keys(collected);
  if (found.length === 0) {
    return `Could not extract anything for ${jurisdiction} ${taxYear}. ${problems.join(" ")}`;
  }

  // The draft carries the extracted values in `provenance` and leaves `payload`
  // as the skeleton. Nothing is written into the payload until a person
  // confirms it — `confirmRuleFigure` is what moves a value across.
  const version =
    ((
      await db.taxRuleSet.aggregate({
        where: { taxYear, jurisdiction },
        _max: { version: true },
      })
    )._max.version ?? 0) + 1;

  await db.taxRuleSet.create({
    data: {
      taxYear,
      jurisdiction,
      version,
      status: "draft",
      payload: skeleton as object,
      provenance: collected as object,
      sourceUrl,
      sourceLabel,
      fetchedAt: new Date(),
      extractorModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    },
    select: { id: true },
  });

  return `Drafted ${found.length} of ${wanted.length} ${jurisdiction} figures for ${taxYear}, each with its source line. None is live until confirmed.${problems.length > 0 ? ` (${problems.join(" ")})` : ""}`;
}

/**
 * Is it time to draft next year's rules?
 *
 * Past 15 October, because the IRS publishes the inflation adjustments in
 * October or November — earlier than that and there is nothing to fetch.
 */
export function shouldDraftNextYear(now = new Date()): number | null {
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  if (month < 10 || (month === 10 && day < 15)) return null;
  return now.getUTCFullYear() + 1;
}
