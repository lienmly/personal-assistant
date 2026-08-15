import { centsFromDollars } from "@/lib/money";

/**
 * RentCast — an automated valuation and a market-rent estimate from an address.
 *
 * Three `fetch` calls' worth of surface, so it is hand-rolled like `lib/plaid.ts`
 * and `lib/deepseek.ts` before it. There is no SDK worth the dependency.
 *
 * **The free tier is 50 calls a month**, which is the constraint that shapes
 * everything here. Two calls per property per month is well inside it for one
 * property and starts to matter at four or five, so `valuationQuota` counts what
 * has already been written this month and refuses past a deliberately
 * conservative ceiling. That refusal is a **returned value**, not a throw: going
 * over the quota is an expected condition with a sentence to show, not a bug.
 *
 * **An estimate is stored as a range, never as a point.** An AVM on anything
 * that is not a cookie-cutter tract house has real error bars, and a single
 * number on a net-worth screen reads as a fact — which is the error this file
 * keeps deleting elsewhere. `Property.valueLowCents` and `valueHighCents` are
 * not optional decoration; the Property tab shows them beside the figure.
 */

const BASE = "https://api.rentcast.io/v1";

/** Deliberately below the free tier's 50, so a month that goes wrong somewhere
 *  else cannot spend the allowance a real refresh needs. */
export const MONTHLY_CALL_CEILING = 40;

/** How stale a valuation may get before the Property tab queues a refresh.
 *  Four weeks rather than a calendar month, so it does not all land on the 1st. */
export const VALUATION_STALE_DAYS = 28;

export type RentcastEstimate = {
  valueCents: number;
  valueLowCents: number | null;
  valueHighCents: number | null;
  rentCents: number | null;
};

export function rentcastConfigured(): boolean {
  return Boolean(process.env.RENTCAST_API_KEY);
}

/** Why RentCast cannot be used, as a sentence, or `null`. */
export function rentcastProblem(): string | null {
  if (!process.env.RENTCAST_API_KEY) {
    return "RENTCAST_API_KEY is not set, so property values have to be entered by hand.";
  }
  return null;
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.RENTCAST_API_KEY;
  if (!key) throw new Error("RENTCAST_API_KEY is not set.");

  const url = new URL(`${BASE}${path}`);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }

  const response = await fetch(url, {
    headers: { "X-Api-Key": key, accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // 404 is RentCast saying it has no comparable data for the address, which is
    // a real answer rather than a failure — a rural or unusual property may
    // simply not be valuable enough data to model.
    if (response.status === 404) {
      throw new Error("RentCast has no valuation for that address.");
    }
    if (response.status === 401) throw new Error("RentCast rejected the API key.");
    if (response.status === 429) {
      throw new Error("RentCast is rate-limiting — the monthly allowance may be spent.");
    }
    throw new Error(
      `RentCast returned ${response.status}${body ? `: ${body.slice(0, 120)}` : ""}.`,
    );
  }

  return (await response.json()) as T;
}

function num(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cents(source: Record<string, unknown>, key: string): number | null {
  const value = num(source, key);
  return value === null ? null : centsFromDollars(value);
}

export type AddressParts = {
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
};

/** RentCast wants one string, comma-separated. */
export function formatAddress(address: AddressParts): string {
  return `${address.addressLine}, ${address.city}, ${address.state}, ${address.postalCode}`;
}

/**
 * Value and rent for one address. **Two API calls** — count them against the
 * quota accordingly.
 *
 * The rent estimate is fetched even though the tax engine has no use for it,
 * because it answers a question nothing else in this app can: *are you under-
 * renting?* A property whose market rent has drifted $400 above its lease is a
 * fact worth seeing once a month, and it costs one call.
 */
export async function estimateProperty(
  address: AddressParts,
): Promise<RentcastEstimate> {
  const query = { address: formatAddress(address) };

  const value = (await call<Record<string, unknown>>("/avm/value", query)) ?? {};
  const valueCents = cents(value, "price");
  if (valueCents === null) {
    throw new Error("RentCast returned no value for that address.");
  }

  let rentCents: number | null = null;
  try {
    const rent = await call<Record<string, unknown>>("/avm/rent/long-term", query);
    rentCents = cents(rent ?? {}, "rent");
  } catch {
    // A missing rent estimate must not cost the value estimate that already
    // succeeded — they are separate endpoints and one can have data the other
    // does not.
  }

  return {
    valueCents,
    valueLowCents: cents(value, "priceRangeLow"),
    valueHighCents: cents(value, "priceRangeHigh"),
    rentCents,
  };
}
