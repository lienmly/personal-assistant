/**
 * Money, as integers.
 *
 * **Client-safe: no Prisma import**, the same rule `lib/tracks.ts`,
 * `lib/calendar-keys.ts` and `lib/media-rules.ts` follow — a chart component and
 * a server action must format the same figure the same way, and the only way to
 * guarantee that is one module both can reach.
 *
 * ## Why cents and not `Decimal`
 *
 * Every money column in the Ledger is an `Int` of cents, suffixed `…Cents`.
 * Prisma's `Decimal` was the obvious alternative and was refused on four counts
 * (CLAUDE.md §8):
 *
 * 1. **The RSC boundary.** A `Decimal` is a class instance, and Next refuses to
 *    serialize one into a client component's props. The failure is a *runtime*
 *    error at the boundary rather than a type error, so it surfaces on the one
 *    page nobody tested. The house rule — format server-side into `…Label`
 *    strings — mitigates it and does not remove it: a chart needs raw numbers for
 *    its path geometry and an edit form needs one for `defaultValue`. `BigInt`
 *    has the mirror defect, since `JSON.stringify` throws on it.
 * 2. **The tax engine is hundreds of multiplications** — mid-month depreciation
 *    factors, phase-out ratios, 92.35% of self-employment earnings, 3.8% of the
 *    lesser of two figures. In Decimal.js each of those is
 *    `a.times(b).dividedBy(c)` *and still* needs an explicit rounding decision.
 *    Here it is `applyRate`, one function, rounding in one place.
 * 3. **Every upstream source already speaks decimal-dollar floats.** Plaid sends
 *    `12.34`, RentCast sends `985000`, a statement PDF gives `"1,250.00"`.
 *    Constructing a `Decimal` from a float has already lost the accuracy Decimal
 *    exists to protect, so the conversion is the thing to get right — once, here.
 * 4. **There is no decimal anywhere in this schema**, so adopting one leaks
 *    Decimal.js semantics into every arithmetic site in the app forever.
 *
 * **The cost, stated:** `Int` is 32-bit, so a single column caps at
 * **$21,474,836.47**. Sums are computed in JS `number` — exact to about $90
 * trillion — and never in Postgres, so only one line item could ever cross it.
 * The escape hatch is `BigInt` plus a `.toString()` at the read layer: a wider
 * column, not a different design.
 */

/** "$1,234.56". Whole dollars still print their cents — a money figure that
 *  sometimes has a decimal part and sometimes does not is one you have to read
 *  twice to be sure of. */
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** "$1,235" — for the big display figures, where the cents go in the tail. */
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const plain = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * `12.34` → `1234`.
 *
 * The `toPrecision(15)` is not decoration. `12.345 * 100` is
 * `1234.4999999999998` in binary floating point and `1.005 * 100` is
 * `100.49999999999999`, so the naive `Math.round(dollars * 100)` rounds a
 * half-cent *down* — silently, on about one value in two hundred. Rounding the
 * product to fifteen significant figures first snaps it back to the decimal the
 * author meant, and only then is it rounded to an integer.
 *
 * Throws on a non-finite input rather than returning `0`: a `NaN` amount is a
 * bug in the caller, and a zero would be indistinguishable from a real one.
 */
export function centsFromDollars(dollars: number): number {
  if (!Number.isFinite(dollars)) {
    throw new Error(`Not a finite amount: ${String(dollars)}`);
  }
  return Math.round(Number((dollars * 100).toPrecision(15)));
}

/** `1234` → `12.34`. For the few places that must hand a float back out — a
 *  form's `defaultValue`, an outbound API body. Never for arithmetic. */
export function dollarsFromCents(cents: number): number {
  return cents / 100;
}

/**
 * What a statement PDF or a pasted figure means, or `null` if it means nothing.
 *
 * Handles the four conventions an owner statement actually uses:
 * `"$1,250.00"`, `"(1,250.00)"` for a negative, a trailing `"CR"`/`"DR"`, and a
 * bare `"1250"`. Anything else returns `null` rather than `0`, because a value
 * that failed to parse and a value that is genuinely zero are different answers
 * and the extractor has to be able to tell them apart.
 */
export function centsFromText(raw: string | null | undefined): number | null {
  if (typeof raw !== "string") return null;

  let text = raw.trim();
  if (text === "") return null;

  let negative = false;

  // Accountants' parentheses.
  if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1).trim();
  }

  // A trailing credit/debit marker. `CR` on an owner statement means money in,
  // which is this codebase's positive — so only `DR` flips the sign.
  const marker = /\s*(CR|DR)$/i.exec(text);
  if (marker) {
    if (marker[1].toUpperCase() === "DR") negative = !negative;
    text = text.slice(0, marker.index).trim();
  }

  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1).trim();
  }

  text = text.replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d*$/.test(text) || text === "" || text === ".") return null;

  const value = Number(text);
  if (!Number.isFinite(value)) return null;

  const cents = centsFromDollars(value);
  return negative ? -cents : cents;
}

/** "$1,234.56", negatives as "−$1,234.56" with a real minus sign. */
export function moneyLabel(cents: number): string {
  return usd.format(cents / 100);
}

/** "+$1,234.56" / "−$1,234.56". For a figure whose *sign* is the point — a
 *  month's net change, a P&L line, a balance due. Never for a balance. */
export function signedMoneyLabel(cents: number): string {
  if (cents === 0) return usd.format(0);
  return `${cents > 0 ? "+" : "−"}${usd.format(Math.abs(cents) / 100)}`;
}

/**
 * A display figure split for `StatTile`, which de-emphasises the decimal part.
 *
 * `412806_42` → `{ value: "$412,806", tail: ".42" }`. The tail is dropped
 * entirely past a million, where two cents on a seven-figure number is noise
 * that costs the figure its readability.
 */
export function moneyParts(cents: number): { value: string; tail?: string } {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.trunc(abs / 100);
  const value = `${negative ? "−" : ""}${usdWhole.format(whole)}`;

  if (abs >= 100_000_000) return { value };

  const remainder = abs % 100;
  return { value, tail: `.${String(remainder).padStart(2, "0")}` };
}

/** "$412.8k", "$1.2M". For an axis label or a chart tick, where the exact
 *  figure is available by other means and the room is not. */
export function compactMoneyLabel(cents: number): string {
  const negative = cents < 0;
  const dollars = Math.abs(cents) / 100;
  const sign = negative ? "−" : "";

  if (dollars >= 1_000_000) return `${sign}$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `${sign}$${(dollars / 1_000).toFixed(1)}k`;
  return `${sign}$${Math.round(dollars)}`;
}

/** Cents without the currency symbol — for a column that has already said so. */
export function amountLabel(cents: number): string {
  return plain.format(cents / 100);
}

/** Basis points → "20.0%". Rates are stored in basis points wherever they are
 *  stored at all, for the reason amounts are stored in cents. */
export function percentLabel(basisPoints: number, digits = 1): string {
  return `${(basisPoints / 100).toFixed(digits)}%`;
}

/** A rate that arrived as a float (Plaid reports `6.125`) → "6.125%". */
export function ratePercentLabel(rate: number): string {
  return `${Number(rate.toFixed(3))}%`;
}

export function sumCents(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

/**
 * **The one place a rate meets money.**
 *
 * Every percentage in the tax engine — a bracket rate, a phase-out fraction, a
 * depreciation factor, 92.35% of self-employment earnings — goes through here,
 * so there is exactly one rounding rule in the system and exactly one place to
 * argue about it. Half-away-from-zero, which is what `Math.round` does for
 * positives and deliberately is not for negatives, hence the explicit branch:
 * `Math.round(-0.5)` is `-0`, so a rounded loss would be a cent shy of a rounded
 * gain of the same size.
 */
export function applyRate(cents: number, rate: number): number {
  const scaled = cents * rate;
  return scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
}
