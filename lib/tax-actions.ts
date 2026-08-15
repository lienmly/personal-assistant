"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { centsFromText } from "@/lib/money";
import type { FilingStatusKey } from "@/lib/tax/rules";
import { FILING_STATUSES } from "@/lib/tax/rules";

/**
 * The tax layer's writes.
 *
 * Same conventions as everywhere else on this surface: the session is re-checked
 * because a server action is its own public endpoint, and a refusal comes back
 * as a value while a bug throws.
 */

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session;
}

function refresh() {
  revalidatePath("/ledger");
}

export type TaxResult = { ok: true } | { ok: false; message: string };

/**
 * A money field, where **blank and zero are different answers**.
 *
 * `TaxProfile`'s income columns are nullable on purpose: null means "derive it
 * from the linked accounts if you can", zero means "there genuinely is none".
 * Collapsing them is how a missing 1099 silently becomes a $0 line, which is the
 * kind of wrong that looks finished.
 */
function optionalCents(form: FormData, key: string): number | null {
  const raw = form.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  return centsFromText(raw);
}

function optionalInt(form: FormData, key: string): number | null {
  const raw = form.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw.trim());
  return Number.isInteger(value) && value >= 0 ? value : null;
}

/**
 * The answers the app cannot derive.
 *
 * Filing status, dependents, wages, withholding, prior-year figures — each is a
 * claim only a person can make, which is why they are one model with one
 * `updatedAt`: the tab shows how old the answers are, and a stale W-2 figure is
 * the likeliest reason an estimate is wrong.
 */
export async function saveTaxProfile(form: FormData): Promise<TaxResult> {
  await requireSession();

  const taxYear = Number(form.get("taxYear"));
  if (!Number.isInteger(taxYear) || taxYear < 2000) {
    return { ok: false, message: "Which tax year?" };
  }

  const status = String(form.get("filingStatus") ?? "");
  if (!(FILING_STATUSES as string[]).includes(status)) {
    return { ok: false, message: "Pick a filing status." };
  }

  const data = {
    filingStatus: status as FilingStatusKey,
    dependents: optionalInt(form, "dependents") ?? 0,
    stateOfResidence: String(form.get("stateOfResidence") ?? "CA").toUpperCase(),

    w2WagesCents: optionalCents(form, "w2Wages"),
    spouseW2WagesCents: optionalCents(form, "spouseW2Wages"),
    federalWithheldCents: optionalCents(form, "federalWithheld"),
    stateWithheldCents: optionalCents(form, "stateWithheld"),

    selfEmploymentNetCents: optionalCents(form, "selfEmploymentNet"),

    interestIncomeCents: optionalCents(form, "interestIncome"),
    ordinaryDividendsCents: optionalCents(form, "ordinaryDividends"),
    qualifiedDividendsCents: optionalCents(form, "qualifiedDividends"),
    shortTermGainCents: optionalCents(form, "shortTermGain"),
    longTermGainCents: optionalCents(form, "longTermGain"),

    hsaContributionCents: optionalCents(form, "hsaContribution"),
    traditionalRetirementCents: optionalCents(form, "traditionalRetirement"),
    studentLoanInterestCents: optionalCents(form, "studentLoanInterest"),

    charitableCents: optionalCents(form, "charitable"),
    primaryMortgageInterestCents: optionalCents(form, "primaryMortgageInterest"),
    primaryPropertyTaxCents: optionalCents(form, "primaryPropertyTax"),
    stateIncomeTaxPaidCents: optionalCents(form, "stateIncomeTaxPaid"),

    priorYearTaxCents: optionalCents(form, "priorYearTax"),
    priorYearAgiCents: optionalCents(form, "priorYearAgi"),
    estimatedPaidCents: optionalCents(form, "estimatedPaid"),

    reSafeHarbourHours: optionalInt(form, "reSafeHarbourHours"),
    realEstateProfessional: form.get("realEstateProfessional") === "on",
  };

  await db.taxProfile.upsert({
    where: { taxYear },
    update: data,
    create: { taxYear, ...data },
    select: { id: true },
  });

  refresh();
  return { ok: true };
}

/**
 * Confirm one number in a rule set against its published source.
 *
 * The path is a dotted one from `missingFigures`, so the field being confirmed
 * and the field reported missing are the same thing by construction.
 *
 * **A set becomes `verified` only when nothing is left**, and that flip is
 * automatic rather than a button — there is no state in which someone declares a
 * rule set finished while it still contains a `null`, because the engine's
 * refusal to compute is keyed on exactly that.
 */
export async function confirmRuleFigure(
  ruleSetId: string,
  path: string,
  value: number,
  note?: string,
): Promise<TaxResult> {
  await requireSession();

  const row = await db.taxRuleSet.findUnique({
    where: { id: ruleSetId },
    select: { payload: true, provenance: true, status: true },
  });
  if (!row) return { ok: false, message: "That rule set is gone." };
  if (row.status === "superseded") {
    return { ok: false, message: "That rule set has been superseded." };
  }

  const payload = structuredClone(row.payload) as Record<string, unknown>;
  if (!setAtPath(payload, path, value)) {
    return { ok: false, message: `There is no field at ${path}.` };
  }

  const provenance = {
    ...((row.provenance as Record<string, unknown>) ?? {}),
    [path]: { value, note: note ?? null, confirmedAt: new Date().toISOString() },
  };

  const { missingFigures } = await import("@/lib/tax/rules");
  const stillMissing = missingFigures(payload);

  await db.taxRuleSet.update({
    where: { id: ruleSetId },
    data: {
      payload: payload as object,
      provenance: provenance as object,
      // Automatic, not a button. See above.
      ...(stillMissing.length === 0
        ? { status: "verified" as const, verifiedAt: new Date() }
        : {}),
    },
    select: { id: true },
  });

  refresh();
  return { ok: true };
}

/** Walks a dotted path like `seTax.wageBaseCents` or
 *  `brackets.single[1].rate`, and refuses rather than creating keys — a typo
 *  should not silently invent a constant the engine then trusts. */
function setAtPath(
  target: Record<string, unknown>,
  path: string,
  value: number,
): boolean {
  const parts = path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean);

  let cursor: unknown = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (typeof cursor !== "object" || cursor === null) return false;
    const next = (cursor as Record<string, unknown>)[parts[index]];
    if (next === undefined) return false;
    cursor = next;
  }

  if (typeof cursor !== "object" || cursor === null) return false;
  const last = parts[parts.length - 1];
  if (!(last in (cursor as Record<string, unknown>))) return false;

  (cursor as Record<string, unknown>)[last] = value;
  return true;
}

/**
 * What you decided about one strategy.
 *
 * The only state a strategy carries, because the catalogue itself is code. The
 * amount is stamped at the moment it was surfaced, so "you said this was worth
 * $4,100 in March" survives the estimate moving underneath it.
 *
 * **A declined strategy stops resurfacing for the year and returns next year**,
 * when the facts have changed — which is why this is per-year rather than a
 * permanent dismissal.
 */
export async function setStrategyState(
  taxYear: number,
  slug: string,
  state: string,
  amountCents: number | null,
): Promise<TaxResult> {
  await requireSession();

  const allowed = ["surfaced", "raised", "doing", "declined", "done"];
  if (!allowed.includes(state)) {
    return { ok: false, message: "That is not a state a strategy can be in." };
  }

  await db.taxStrategyNote.upsert({
    where: { taxYear_slug: { taxYear, slug } },
    update: { state },
    create: { taxYear, slug, state, amountCents },
    select: { id: true },
  });

  refresh();
  return { ok: true };
}

/** A note against a strategy — what your accountant actually said. */
export async function saveStrategyNote(
  taxYear: number,
  slug: string,
  note: string,
): Promise<TaxResult> {
  await requireSession();

  await db.taxStrategyNote.upsert({
    where: { taxYear_slug: { taxYear, slug } },
    update: { note: note.trim() || null },
    create: { taxYear, slug, note: note.trim() || null },
    select: { id: true },
  });

  refresh();
  return { ok: true };
}
