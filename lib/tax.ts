import type { RuleSetStatus } from "@prisma/client";

import { db } from "@/lib/db";
import {
  type LoadedRules,
  type TaxRules,
  missingFigures,
  parseTaxRules,
} from "@/lib/tax/rules";
import {
  CALIFORNIA_SOURCES,
  californiaSkeleton,
} from "@/lib/tax/rulesets/california";
import { FEDERAL_SOURCES, federalSkeleton } from "@/lib/tax/rulesets/federal";
import { type ScheduleE, scheduleEFor } from "@/lib/tax/schedule-e";
import {
  type TaxEstimate,
  estimate,
  estimateLabels,
} from "@/lib/tax/engine";
import type { CaliforniaRules, FederalRules } from "@/lib/tax/rules";
import {
  type SurfacedStrategy,
  surfaceStrategies,
} from "@/lib/tax/strategies";

/** Everything the Tax tab reads. */

export type RuleSetView = {
  id: string | null;
  jurisdiction: "federal" | "ca";
  jurisdictionLabel: string;
  taxYear: number;
  status: RuleSetStatus | "absent";
  /** How many numbers still need confirming, and which. */
  missing: string[];
  missingCount: number;
  totalFigures: number;
  sourceLabel: string | null;
  sourceUrl: string | null;
  /** True when the engine may use it at all. */
  usable: boolean;
};

export type TaxView = {
  taxYear: number;
  availableYears: number[];
  federal: RuleSetView;
  california: RuleSetView;
  scheduleEs: ScheduleE[];
  /** Set when nothing can be computed, and it says which numbers are missing. */
  blocker: string | null;
  hasProfile: boolean;
  profile: TaxProfileView | null;
  /** Null whenever any input or constant is missing. Never a partial figure. */
  estimate: TaxEstimate | null;
  labels: ReturnType<typeof estimateLabels> | null;
  /** True when the estimate rests on constants nobody has confirmed. Badged on
   *  every figure derived from them. */
  usingDraftRules: boolean;
  /** Why there is no estimate, when there is a profile and rules but no result. */
  estimateBlocker: string | null;
  /** Questions worth putting to an accountant, with your figures in them. Empty
   *  when this year's numbers do not make any of them worth a conversation —
   *  which is a real answer rather than an empty list. */
  strategies: SurfacedStrategy[];
  strategyNotes: Record<string, { state: string; note: string | null }>;
  /** Figures a draft has extracted, waiting to be confirmed against their
   *  quoted source. */
  pendingFigures: PendingFigure[];
};

export type PendingFigure = {
  ruleSetId: string;
  jurisdiction: string;
  path: string;
  value: number;
  /** The verbatim sentence it was read from — what makes confirming cheap. */
  source: string;
  where: string | null;
};

export type TaxProfileView = {
  taxYear: number;
  filingStatus: string;
  dependents: number;
  stateOfResidence: string;
  updatedLabel: string;
  /** Fields still unanswered, so the tab can say what is holding the estimate. */
  missing: string[];
};

const JURISDICTION_LABEL = { federal: "Federal", ca: "California" } as const;

/**
 * Load a rule set, preferring `verified` over `draft`.
 *
 * **A draft never becomes live silently.** When one is used, that is returned on
 * the value rather than logged or assumed, and every figure derived from it is
 * badged. `lib/tax/rules.ts` explains why at length; the short version is that a
 * tax number nobody checked is indistinguishable from one that is right.
 */
export async function loadRules(
  taxYear: number,
  jurisdiction: "federal" | "ca",
): Promise<LoadedRules | null> {
  const row = await db.taxRuleSet.findFirst({
    where: { taxYear, jurisdiction, supersededAt: null },
    // `verified` sorts before `draft` alphabetically by luck rather than design,
    // so the order is explicit: newest verified first, then newest draft.
    orderBy: [{ status: "asc" }, { version: "desc" }],
  });
  if (!row) return null;

  const parsed = parseTaxRules(row.payload);
  if (!parsed.ok) return null;

  return {
    rules: parsed.rules,
    status: row.status,
    missing: missingFigures(row.payload),
    sourceLabel: row.sourceLabel,
    sourceUrl: row.sourceUrl,
    version: row.version,
  };
}

function skeletonFor(taxYear: number, jurisdiction: "federal" | "ca"): TaxRules {
  return jurisdiction === "federal"
    ? federalSkeleton(taxYear)
    : californiaSkeleton(taxYear);
}

export function sourcesFor(jurisdiction: "federal" | "ca") {
  return jurisdiction === "federal" ? FEDERAL_SOURCES : CALIFORNIA_SOURCES;
}

async function ruleSetView(
  taxYear: number,
  jurisdiction: "federal" | "ca",
): Promise<RuleSetView> {
  const loaded = await loadRules(taxYear, jurisdiction);
  const skeleton = skeletonFor(taxYear, jurisdiction);
  const totalFigures = missingFigures(skeleton).length;

  if (!loaded) {
    return {
      id: null,
      jurisdiction,
      jurisdictionLabel: JURISDICTION_LABEL[jurisdiction],
      taxYear,
      status: "absent",
      missing: missingFigures(skeleton),
      missingCount: totalFigures,
      totalFigures,
      sourceLabel: null,
      sourceUrl: null,
      usable: false,
    };
  }

  const row = await db.taxRuleSet.findFirst({
    where: { taxYear, jurisdiction, supersededAt: null },
    orderBy: [{ status: "asc" }, { version: "desc" }],
    select: { id: true },
  });

  return {
    id: row?.id ?? null,
    jurisdiction,
    jurisdictionLabel: JURISDICTION_LABEL[jurisdiction],
    taxYear,
    status: loaded.status,
    missing: loaded.missing,
    missingCount: loaded.missing.length,
    totalFigures,
    sourceLabel: loaded.sourceLabel,
    sourceUrl: loaded.sourceUrl,
    // The rule that makes all of this worth having: a set with any unconfirmed
    // number cannot be used at all. Not "used with defaults", not "used with a
    // warning" — a figure whose inputs include a guess is not computed.
    usable: loaded.missing.length === 0,
  };
}

/**
 * Make sure a year has a rule set to confirm.
 *
 * Creates the **empty skeleton** if none exists, flagged `draft`. That is not
 * the app asserting anything — the skeleton contains no numbers. It is the
 * difference between "there is nothing here" and "here is the list of 34 things
 * that need looking up", and the second is the one you can act on.
 *
 * Idempotent on `[taxYear, jurisdiction, version]`, and it never touches an
 * existing set: a confirmed number is a decision, and re-creating over it would
 * be the seed's `update: {}` failure with a tax return attached.
 */
export async function ensureRuleSets(taxYear: number): Promise<void> {
  for (const jurisdiction of ["federal", "ca"] as const) {
    const existing = await db.taxRuleSet.findFirst({
      where: { taxYear, jurisdiction },
      select: { id: true },
    });
    if (existing) continue;

    const sources = sourcesFor(jurisdiction);
    await db.taxRuleSet.create({
      data: {
        taxYear,
        jurisdiction,
        version: 1,
        status: "draft",
        payload: skeletonFor(taxYear, jurisdiction) as object,
        sourceLabel: sources[0]?.label ?? null,
        sourceUrl: sources[0]?.url ?? null,
      },
      select: { id: true },
    });
  }
}

export async function getTaxView(taxYear: number): Promise<TaxView> {
  await ensureRuleSets(taxYear);

  const [federal, california, properties, profileRow, years] = await Promise.all([
    ruleSetView(taxYear, "federal"),
    ruleSetView(taxYear, "ca"),
    db.property.findMany({
      where: { status: { in: ["rented", "vacant"] } },
      orderBy: { sortOrder: "asc" },
      select: { id: true, activeParticipation: true },
    }),
    db.taxProfile.findUnique({ where: { taxYear } }),
    db.taxRuleSet.findMany({
      distinct: ["taxYear"],
      orderBy: { taxYear: "desc" },
      select: { taxYear: true },
    }),
  ]);

  const scheduleEs = (
    await Promise.all(
      properties.map((property) => scheduleEFor(property.id, taxYear)),
    )
  ).filter((entry): entry is ScheduleE => entry !== null);

  const current = new Date().getUTCFullYear();
  const availableYears = [
    ...new Set([current, current - 1, ...years.map((row) => row.taxYear)]),
  ].sort((a, b) => b - a);

  const blocker =
    federal.usable
      ? null
      : `The tax constants for ${taxYear} have not been confirmed yet — ${federal.missingCount} federal and ${california.missingCount} California figures still need looking up. Nothing is estimated from a guess.`;

  const stampFormat = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  // What the estimate cannot proceed without. Stated as a list rather than a
  // single "incomplete", because the useful thing is which answer is missing.
  const profileMissing: string[] = [];
  if (!profileRow) {
    profileMissing.push("filing status, wages and withholding");
  } else {
    if (profileRow.w2WagesCents === null) profileMissing.push("salary");
    if (profileRow.federalWithheldCents === null) {
      profileMissing.push("federal withholding");
    }
  }

  const profile: TaxProfileView | null = profileRow
    ? {
        taxYear,
        filingStatus: profileRow.filingStatus,
        dependents: profileRow.dependents,
        stateOfResidence: profileRow.stateOfResidence,
        updatedLabel: stampFormat.format(profileRow.updatedAt),
        missing: profileMissing,
      }
    : null;

  // The engine runs only when everything it needs exists. A partial estimate is
  // the failure this whole layer is written against.
  let result: TaxEstimate | null = null;
  let estimateBlocker: string | null = null;

  if (!federal.usable) {
    estimateBlocker = blocker;
  } else if (!profileRow) {
    estimateBlocker =
      "The estimate needs your filing status, salary and withholding — figures no bank can supply.";
  } else if (profileMissing.length > 0) {
    estimateBlocker = `Still needed: ${profileMissing.join(", ")}.`;
  } else {
    const federalRules = (await loadRules(taxYear, "federal"))?.rules as
      | FederalRules
      | undefined;
    const caRules = california.usable
      ? ((await loadRules(taxYear, "ca"))?.rules as CaliforniaRules | undefined)
      : undefined;

    const carryforward = await db.taxCarryforward.aggregate({
      where: { taxYear: { lt: taxYear }, kind: "passive_loss" },
      _sum: { amountCents: true },
    });

    if (federalRules) {
      const byProperty = new Map(
        properties.map((property) => [property.id, property.activeParticipation]),
      );

      result = estimate({
        taxYear,
        filingStatus: profileRow.filingStatus,
        dependents: profileRow.dependents,

        w2WagesCents:
          (profileRow.w2WagesCents ?? 0) + (profileRow.spouseW2WagesCents ?? 0),
        selfEmploymentNetCents: profileRow.selfEmploymentNetCents ?? 0,
        interestIncomeCents: profileRow.interestIncomeCents ?? 0,
        ordinaryDividendsCents: profileRow.ordinaryDividendsCents ?? 0,
        qualifiedDividendsCents: profileRow.qualifiedDividendsCents ?? 0,
        shortTermGainCents: profileRow.shortTermGainCents ?? 0,
        longTermGainCents: profileRow.longTermGainCents ?? 0,

        properties: scheduleEs
          .filter((schedule) => schedule.netCents !== null)
          .map((schedule) => ({
            netCents: schedule.netCents as number,
            activeParticipation: byProperty.get(schedule.propertyId) ?? true,
          })),
        passiveCarryforwardCents: carryforward._sum.amountCents ?? 0,
        // California's own depreciation basis is not reproduced (see
        // `lib/tax/california.ts`), so this stays zero rather than being
        // approximated from the federal figure.
        depreciationDifferenceCents: 0,

        hsaContributionCents: profileRow.hsaContributionCents ?? 0,
        traditionalRetirementCents: profileRow.traditionalRetirementCents ?? 0,
        studentLoanInterestCents: profileRow.studentLoanInterestCents ?? 0,

        charitableCents: profileRow.charitableCents ?? 0,
        primaryMortgageInterestCents:
          profileRow.primaryMortgageInterestCents ?? 0,
        primaryPropertyTaxCents: profileRow.primaryPropertyTaxCents ?? 0,
        stateIncomeTaxPaidCents: profileRow.stateIncomeTaxPaidCents ?? 0,

        federalWithheldCents: profileRow.federalWithheldCents ?? 0,
        stateWithheldCents: profileRow.stateWithheldCents ?? 0,
        estimatedPaidCents: profileRow.estimatedPaidCents ?? 0,

        reSafeHarbourHours: profileRow.reSafeHarbourHours,
        realEstateProfessional: profileRow.realEstateProfessional,

        federal: federalRules,
        california: caRules ?? null,
      });

      if (!result) {
        estimateBlocker =
          "One of the constants the estimate needs is still unconfirmed, so nothing is computed.";
      }
    }
  }

  // A Schedule E that could not compute its depreciation makes the whole
  // estimate unsafe — the rental's net feeds AGI, and a missing depreciation
  // line would overstate it.
  const incompleteSchedule = scheduleEs.find(
    (schedule) => schedule.netCents === null,
  );
  if (result && incompleteSchedule) {
    result = null;
    estimateBlocker = `${incompleteSchedule.propertyLabel} has no depreciation figure yet, and its net feeds the whole estimate. ${incompleteSchedule.depreciationBlocker ?? ""}`;
  }

  // Strategies need an estimate to have figures in them, which is the whole
  // point — a question with no number attached is a leaflet.
  const [noteRows, propertyRows] = await Promise.all([
    db.taxStrategyNote.findMany({ where: { taxYear } }),
    db.property.findMany({
      where: { status: { in: ["rented", "vacant"] } },
      select: {
        label: true,
        purchasePriceCents: true,
        closingCostsCents: true,
        landAllocationBasisPoints: true,
        placedInServiceOn: true,
        activeParticipation: true,
      },
    }),
  ]);

  const strategyNotes: Record<string, { state: string; note: string | null }> =
    Object.fromEntries(
      noteRows.map((row) => [row.slug, { state: row.state, note: row.note }]),
    );

  const strategies: SurfacedStrategy[] = result
    ? surfaceStrategies({
        estimate: result,
        properties: propertyRows.map((property) => ({
          label: property.label,
          basisCents:
            property.landAllocationBasisPoints === null
              ? null
              : property.purchasePriceCents + property.closingCostsCents,
          ageYears: property.placedInServiceOn
            ? taxYear - property.placedInServiceOn.getUTCFullYear()
            : null,
          activeParticipation: property.activeParticipation,
        })),
        carryforwardCents: 0,
        hsaContributionCents: profileRow?.hsaContributionCents ?? 0,
        hasTaxableBrokerage:
          (await db.account.count({ where: { kind: "brokerage" } })) > 0,
        // Cost basis is only known where the institution reports it, and Plaid
        // often does not — so this stays null rather than being guessed at, and
        // the strategy sizes itself as best it can without.
        unrealisedLossCents: null,
      })
    : [];

  // Draft figures waiting to be confirmed. `provenance` is where an extraction
  // lands; `payload` only changes when a person confirms one.
  const draftRows = await db.taxRuleSet.findMany({
    where: { taxYear, status: "draft", supersededAt: null },
    select: { id: true, jurisdiction: true, payload: true, provenance: true },
  });

  const pendingFigures: PendingFigure[] = [];
  for (const row of draftRows) {
    const stillMissing = new Set(missingFigures(row.payload));
    const provenance = (row.provenance ?? {}) as Record<
      string,
      { value?: number; source?: string; where?: string | null }
    >;
    for (const [path, entry] of Object.entries(provenance)) {
      // Only offer what is genuinely still absent from the payload — a figure
      // already confirmed keeps its provenance entry and must not reappear.
      if (!stillMissing.has(path)) continue;
      if (typeof entry?.value !== "number" || !entry.source) continue;
      pendingFigures.push({
        ruleSetId: row.id,
        jurisdiction: row.jurisdiction,
        path,
        value: entry.value,
        source: entry.source,
        where: entry.where ?? null,
      });
    }
  }

  return {
    taxYear,
    availableYears,
    federal,
    california,
    scheduleEs,
    blocker,
    hasProfile: profileRow !== null,
    profile,
    estimate: result,
    labels: result ? estimateLabels(result) : null,
    usingDraftRules: federal.status === "draft",
    estimateBlocker,
    strategies,
    strategyNotes,
    pendingFigures,
  };
}
