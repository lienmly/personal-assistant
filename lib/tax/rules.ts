/**
 * Every number the tax engine multiplies by.
 *
 * **Nothing in this app hardcodes a tax constant, and the rule sets ship with
 * every numeric field `null`.** That is not caution for its own sake; it is
 * CLAUDE.md §6's "an unverified date is a note, not a due date", applied to
 * numbers, with the stakes raised.
 *
 * A bracket table written into a `.ts` file from a model's memory is a row you
 * would have to stop and disprove — except that here **you would not know to
 * stop**. A tax figure that is 4% wrong looks exactly like a tax figure that is
 * right. The seeded tasks of 2026-08-04 at least announced themselves by
 * existing; a wrong standard deduction announces nothing and is believed.
 *
 * So the data files carry the *structure*, the `sourceLabel` of the document
 * each number comes from, and nothing else. `loadRules` returns what is missing
 * alongside what is present, and the engine reports **"not computed"** for any
 * figure whose inputs include an unverified one — rather than substituting a
 * default, which is the same lie one indirection further away.
 *
 * Client-safe: no Prisma import. `lib/tax.ts` does the reading.
 */

export type FilingStatusKey = "single" | "mfj" | "mfs" | "hoh" | "qw";

export const FILING_STATUSES: FilingStatusKey[] = [
  "single",
  "mfj",
  "mfs",
  "hoh",
  "qw",
];

export const FILING_STATUS_LABEL: Record<FilingStatusKey, string> = {
  single: "Single",
  mfj: "Married, filing jointly",
  mfs: "Married, filing separately",
  hoh: "Head of household",
  qw: "Qualifying surviving spouse",
};

/** One bracket. `upToCents: null` is the top bracket, which has no ceiling. */
export type Bracket = { upToCents: number | null; rate: number | null };

/** A value that has to come from a published source before it can be used. */
export type Figure = number | null;

export type ByStatus<T> = Record<FilingStatusKey, T>;

export type FederalRules = {
  taxYear: number;
  jurisdiction: "federal";

  brackets: ByStatus<Bracket[]>;
  standardDeduction: ByStatus<Figure>;
  additionalStandardDeduction: { age65: Figure; blind: Figure };

  /** Long-term capital gains and qualified dividends, stacked on top of
   *  ordinary income. */
  ltcgBrackets: ByStatus<Bracket[]>;

  seTax: {
    oasdiRate: Figure;
    medicareRate: Figure;
    wageBaseCents: Figure;
    additionalMedicareRate: Figure;
    additionalMedicareThreshold: ByStatus<Figure>;
    /** 92.35% — the share of net earnings that is subject to SE tax. */
    netEarningsFactor: Figure;
  };

  niit: { rate: Figure; threshold: ByStatus<Figure> };

  /** §469 — the special allowance for a rental you actively participate in,
   *  and the MAGI range it phases out over. */
  pal469: {
    specialAllowanceCents: Figure;
    phaseoutStartMagiCents: ByStatus<Figure>;
    /** 0.5 — fifty cents of allowance lost per dollar of MAGI over the start. */
    phaseoutRate: Figure;
  };

  /** §199A. */
  qbi: {
    rate: Figure;
    thresholdCents: ByStatus<Figure>;
    phaseInRangeCents: ByStatus<Figure>;
    wageLimitRate: Figure;
    wageUbiaRate: Figure;
    ubiaRate: Figure;
  };

  saltCapCents: Figure;
  deMinimisSafeHarbourCents: Figure;
  standardMileageCents: Figure;
  section179LimitCents: Figure;
  section179PhaseoutCents: Figure;
  bonusDepreciationRate: Figure;

  estimatedSafeHarbour: {
    currentYearRate: Figure;
    priorYearRate: Figure;
    priorYearHighAgiRate: Figure;
    highAgiThresholdCents: Figure;
  };
};

export type WashingtonRules = {
  taxYear: number;
  jurisdiction: "wa";

  /** **Standing facts, not figures.** Washington has no personal income tax —
   *  which is why this file is a fraction of the size a state with one needs —
   *  and does have a tax on long-term capital gains. Both want an annual glance,
   *  because legislatures change them, but both have a defensible default in a
   *  way a rate does not. */
  hasIncomeTax: false;
  hasCapitalGainsTax: boolean;

  capitalGains: {
    rate: Figure;
    /** Long-term gain excluded before the rate applies. Indexed annually. */
    standardDeductionCents: Figure;
    charitableFloorCents: Figure;
    charitableCapCents: Figure;
  };
};

export type TaxRules = FederalRules | WashingtonRules;

/** A rule set as it comes back from the database, with what is missing named. */
export type LoadedRules<T extends TaxRules = TaxRules> = {
  rules: T;
  status: "draft" | "verified" | "superseded";
  /** Dotted paths of every numeric leaf still `null`. Empty means usable. */
  missing: string[];
  sourceLabel: string | null;
  sourceUrl: string | null;
  version: number;
};

/**
 * Every numeric leaf that is still `null`, as a dotted path.
 *
 * Walks the payload rather than checking a list, so a field added to the type
 * cannot be forgotten here — the failure mode of a hand-maintained list is that
 * the newest constant is the one nobody checks.
 *
 * `conformsToBonus` and its siblings are booleans and legitimately `false`, so
 * only `null` counts as missing; a bracket's `upToCents` is legitimately `null`
 * on the top band, which is why brackets are walked by index and the top one's
 * ceiling is exempt.
 */
export function missingFigures(payload: unknown, path = ""): string[] {
  if (payload === null) return [path || "(root)"];
  if (typeof payload !== "object") return [];

  if (Array.isArray(payload)) {
    // **An empty bracket table is a missing figure, not an absent one.** Every
    // array in a rule set is a bracket table, and a table with no bands cannot
    // tax anything — `taxOnOrdinary` correctly returns null for it. Without this
    // line, a set whose scalar leaves were all confirmed reported itself
    // `usable` while the engine refused to compute, and the two disagreed with
    // no way to tell which was right. Found by `scripts/tax-view-check.mts`.
    if (payload.length === 0) return [path || "(root)"];

    const out: string[] = [];
    payload.forEach((item, index) => {
      const isLast = index === payload.length - 1;
      if (item && typeof item === "object") {
        for (const [key, value] of Object.entries(item)) {
          // The top bracket has no ceiling. That is the shape, not an omission.
          if (isLast && key === "upToCents" && value === null) continue;
          out.push(...missingFigures(value, `${path}[${index}].${key}`));
        }
      } else {
        out.push(...missingFigures(item, `${path}[${index}]`));
      }
    });
    return out;
  }

  const out: string[] = [];
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    out.push(...missingFigures(value, path ? `${path}.${key}` : key));
  }
  return out;
}

/** Reads a stored payload back into a typed rule set. Structural only — the
 *  numbers are checked by `missingFigures`, not here. */
export function parseTaxRules(
  payload: unknown,
): { ok: true; rules: TaxRules } | { ok: false; problem: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, problem: "That rule set has no payload." };
  }

  const candidate = payload as Partial<TaxRules>;
  if (candidate.jurisdiction !== "federal" && candidate.jurisdiction !== "wa") {
    return { ok: false, problem: "That rule set names no jurisdiction." };
  }
  if (typeof candidate.taxYear !== "number") {
    return { ok: false, problem: "That rule set names no tax year." };
  }
  // Deliberately no bracket check. Washington has none — it has no income tax —
  // and demanding a table every jurisdiction must have was an assumption that
  // only held while the only state modelled was California.
  if (
    candidate.jurisdiction === "federal" &&
    (!("brackets" in candidate) || typeof candidate.brackets !== "object")
  ) {
    return { ok: false, problem: "That federal rule set has no brackets." };
  }

  return { ok: true, rules: candidate as TaxRules };
}

/**
 * Tax on ordinary income, given a bracket table.
 *
 * Returns `null` when any rate or threshold it would need is missing, which is
 * the rule this whole file exists to enforce: **an incomplete rule set produces
 * no number, not a smaller one.**
 */
export function taxOnOrdinary(
  cents: number,
  brackets: Bracket[],
): number | null {
  if (cents <= 0) return 0;
  if (brackets.length === 0) return null;

  let tax = 0;
  let floor = 0;

  for (const band of brackets) {
    if (band.rate === null) return null;

    const ceiling = band.upToCents;
    const top = ceiling === null ? cents : Math.min(cents, ceiling);
    if (top > floor) {
      tax += Math.round((top - floor) * band.rate);
      floor = top;
    }
    if (ceiling !== null && cents <= ceiling) break;
    if (ceiling === null) break;
  }

  // Income above the last band's ceiling with no open-ended band means the
  // table is truncated — better to say so than to under-tax silently.
  if (floor < cents) return null;

  return tax;
}

/**
 * Long-term gains and qualified dividends, **stacked on top of ordinary
 * income**.
 *
 * This is the part people get wrong. The preferential rates are not applied to
 * the gain in isolation: the gain sits on top of ordinary taxable income, and
 * whichever brackets it lands in are the ones that apply. A $40,000 gain on top
 * of $30,000 of ordinary income is taxed quite differently from the same gain on
 * top of $300,000.
 */
export function taxOnPreferential(
  preferentialCents: number,
  ordinaryCents: number,
  brackets: Bracket[],
): number | null {
  if (preferentialCents <= 0) return 0;
  if (brackets.length === 0) return null;

  let tax = 0;
  let remaining = preferentialCents;
  let floor = Math.max(0, ordinaryCents);

  for (const band of brackets) {
    if (band.rate === null) return null;
    if (remaining <= 0) break;

    const ceiling = band.upToCents;
    if (ceiling !== null && ceiling <= floor) continue;

    const room = ceiling === null ? remaining : Math.min(remaining, ceiling - floor);
    if (room > 0) {
      tax += Math.round(room * band.rate);
      remaining -= room;
      floor += room;
    }
    if (ceiling === null) break;
  }

  return remaining > 0 ? null : tax;
}
