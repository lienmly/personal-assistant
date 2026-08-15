import { applyRate } from "@/lib/money";
import type { FederalRules, FilingStatusKey } from "@/lib/tax/rules";

/**
 * Self-employment tax.
 *
 * Computed **before AGI**, because half of it is an above-the-line deduction —
 * so AGI depends on this and this does not depend on AGI. That ordering is not
 * a convenience; running it the other way round makes the two mutually
 * dependent and invites a fixed-point loop for a problem that statute has
 * already ordered.
 *
 * Three parts, and they behave differently:
 *
 * - **OASDI (Social Security)** applies only up to the wage base, and **W-2
 *   wages consume that base first.** Somebody with $160,000 of salary and
 *   $20,000 of self-employment income owes almost no OASDI on the second, and
 *   forgetting this is the commonest way an SE figure comes out far too high.
 * - **Medicare** has no ceiling.
 * - **Additional Medicare** applies above a threshold that is *not* inflation
 *   adjusted, on wages and SE income combined.
 *
 * Returns `null` if any needed figure is unconfirmed. Every function in
 * `lib/tax/` does — see `lib/tax/rules.ts` for why a default would be the same
 * lie one indirection away.
 */

export type SelfEmploymentTax = {
  /** 92.35% of net profit — the base the rates apply to. */
  netEarningsCents: number;
  oasdiCents: number;
  medicareCents: number;
  additionalMedicareCents: number;
  totalCents: number;
  /** Half the OASDI+Medicare portion, deductible above the line. Additional
   *  Medicare is **not** included: it is not deductible. */
  deductibleHalfCents: number;
};

export function selfEmploymentTax(input: {
  netProfitCents: number;
  w2WagesCents: number;
  filingStatus: FilingStatusKey;
  rules: FederalRules;
}): SelfEmploymentTax | null {
  const { seTax } = input.rules;

  if (input.netProfitCents <= 0) {
    return {
      netEarningsCents: 0,
      oasdiCents: 0,
      medicareCents: 0,
      additionalMedicareCents: 0,
      totalCents: 0,
      deductibleHalfCents: 0,
    };
  }

  if (
    seTax.netEarningsFactor === null ||
    seTax.oasdiRate === null ||
    seTax.medicareRate === null ||
    seTax.wageBaseCents === null
  ) {
    return null;
  }

  const netEarningsCents = applyRate(
    input.netProfitCents,
    seTax.netEarningsFactor,
  );

  // Wages eat the wage base first. This is the step people miss.
  const baseLeft = Math.max(0, seTax.wageBaseCents - input.w2WagesCents);
  const oasdiBase = Math.min(netEarningsCents, baseLeft);
  const oasdiCents = applyRate(oasdiBase, seTax.oasdiRate);

  const medicareCents = applyRate(netEarningsCents, seTax.medicareRate);

  let additionalMedicareCents = 0;
  const threshold = seTax.additionalMedicareThreshold[input.filingStatus];
  if (seTax.additionalMedicareRate !== null && threshold !== null) {
    const combined = input.w2WagesCents + netEarningsCents;
    const over = Math.max(0, combined - threshold);
    // Only the self-employment share is charged here; an employer withholds the
    // rest on wages, and charging it twice is a real overstatement.
    const share = Math.min(over, netEarningsCents);
    additionalMedicareCents = applyRate(share, seTax.additionalMedicareRate);
  } else if (seTax.additionalMedicareRate !== null || threshold !== null) {
    // One half confirmed and not the other is an incomplete rule set, not a
    // reason to skip the charge.
    return null;
  }

  const totalCents = oasdiCents + medicareCents + additionalMedicareCents;

  return {
    netEarningsCents,
    oasdiCents,
    medicareCents,
    additionalMedicareCents,
    totalCents,
    // Additional Medicare is deliberately excluded — it is not deductible.
    deductibleHalfCents: Math.round((oasdiCents + medicareCents) / 2),
  };
}
