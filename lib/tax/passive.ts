import { applyRate } from "@/lib/money";
import type { FederalRules, FilingStatusKey } from "@/lib/tax/rules";

/**
 * §469 — how much of a rental loss you may actually use this year.
 *
 * Rental activity is passive by default, and passive losses can normally only
 * offset passive income. The exception this engine cares about is the **$25,000
 * special allowance** for someone who *actively participates* — approves
 * tenants, sets the rent, authorises repairs — which phases out over a MAGI
 * range and is gone entirely above the top of it.
 *
 * ## The circularity, and why there is not one
 *
 * The allowance depends on MAGI; AGI depends on the rental loss you are allowed
 * to deduct. That looks circular and is not: **the MAGI the phase-out tests is
 * computed *without* the passive loss itself.** Statute settles the ordering, so
 * the obvious fix — iterate to a fixed point — would be solving a problem that
 * does not exist and would produce a different (wrong) answer.
 *
 * The same shape appears again in §199A. Both are worth stating out loud
 * because both look like they need a loop.
 *
 * ## What is disallowed is suspended, not lost
 *
 * A loss you cannot use this year carries forward and offsets passive income in
 * a later one — or is released in full when the property is sold. Writing it to
 * `TaxCarryforward` rather than discarding it is the difference between a
 * planning tool and one that quietly understates what you own.
 *
 * **`activeParticipation` is a claim only a human can make**, which is why it is
 * a column on `Property` and not something inferred from how many transactions
 * were claimed.
 */

export type PassiveResult = {
  /** Net across every property, before any limit. Negative is a loss. */
  netCents: number;
  /** The part deductible against ordinary income this year. */
  allowedCents: number;
  /** Carried forward. Always positive — it is a magnitude of loss. */
  suspendedCents: number;
  /** The allowance after the MAGI phase-out, for the explanation. */
  allowanceCents: number;
  /** Why the answer is what it is, in a sentence. */
  reason: string;
};

export function applyPassiveLimits(input: {
  /** Per property: net Schedule E, and whether it is actively participated in. */
  properties: { netCents: number; activeParticipation: boolean }[];
  /** **Computed without the passive loss.** See above. */
  magiCents: number;
  filingStatus: FilingStatusKey;
  /** Losses suspended from previous years, available against passive income. */
  carryforwardCents: number;
  rules: FederalRules;
}): PassiveResult | null {
  const netCents =
    input.properties.reduce((sum, property) => sum + property.netCents, 0) -
    input.carryforwardCents;

  // Passive income is taxable in full; there is nothing to limit.
  if (netCents >= 0) {
    return {
      netCents,
      allowedCents: netCents,
      suspendedCents: 0,
      allowanceCents: 0,
      reason:
        input.carryforwardCents > 0
          ? "The rentals made a profit this year, and suspended losses from earlier years were used against it first."
          : "The rentals made a profit, which is taxable in full.",
    };
  }

  const lossCents = -netCents;

  const { pal469 } = input.rules;
  const start = pal469.phaseoutStartMagiCents[input.filingStatus];

  if (
    pal469.specialAllowanceCents === null ||
    pal469.phaseoutRate === null ||
    start === null
  ) {
    return null;
  }

  // No active participation, no allowance. The whole loss suspends.
  const anyActive = input.properties.some(
    (property) => property.activeParticipation && property.netCents < 0,
  );
  if (!anyActive) {
    return {
      netCents,
      allowedCents: 0,
      suspendedCents: lossCents,
      allowanceCents: 0,
      reason:
        "Without active participation the whole loss is suspended and carries forward.",
    };
  }

  const over = Math.max(0, input.magiCents - start);
  const reduction = applyRate(over, pal469.phaseoutRate);
  const allowanceCents = Math.max(0, pal469.specialAllowanceCents - reduction);

  const allowedLoss = Math.min(lossCents, allowanceCents);
  const suspendedCents = lossCents - allowedLoss;

  return {
    netCents,
    allowedCents: -allowedLoss,
    suspendedCents,
    allowanceCents,
    reason:
      allowanceCents === 0
        ? "Income is above the range where the special allowance applies, so the whole loss is suspended and carries forward."
        : suspendedCents === 0
          ? "The whole loss fits inside the special allowance for a rental you actively participate in."
          : "Part of the loss fits inside the special allowance; the rest is suspended and carries forward.",
  };
}
