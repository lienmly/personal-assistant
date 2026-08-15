import type { AccountKind } from "@prisma/client";

import type { NetWorthGroup } from "@/lib/ledger-rules";

/** Plain view types — the Ledger's lists and panels are client components, so
 *  they must not pull `lib/db` into the bundle. Same rule as today/, studio/
 *  and board/.
 *
 *  Every money figure arrives here **twice**: once as a preformatted `…Label`
 *  string, which is what gets rendered, and once as raw cents where a chart
 *  needs it for geometry. Formatting in the client means `Intl` in the bundle
 *  and a hydration mismatch on any locale difference, which is the same rule
 *  `components/today/types.ts` already states for dates. */

export type AccountView = {
  id: string;
  name: string;
  officialName: string | null;
  mask: string | null;
  kind: AccountKind;
  kindLabel: string;
  group: NetWorthGroup;
  institutionName: string;
  /** Signed for the roll-up: an owed balance is negative here, even though the
   *  column stores a positive magnitude. `netWorthSideFor` applied once, so
   *  nothing downstream repeats the decision. */
  signedCents: number;
  /** What the institution says — always positive, matching a statement. */
  balanceLabel: string;
  availableLabel: string | null;
  limitLabel: string | null;
  includeInNetWorth: boolean;
  syncedLabel: string | null;
  needsAttention: boolean;
};

export type GroupView = {
  group: NetWorthGroup;
  label: string;
  totalCents: number;
  totalLabel: string;
  accounts: AccountView[];
};

export type NetWorthView = {
  totalCents: number;
  /** Split for `StatTile`, which de-emphasises the decimal part. */
  total: { value: string; tail?: string };
  assetsCents: number;
  liabilitiesCents: number;
  liquidCents: number;
  liquidLabel: string;
  investedCents: number;
  investedLabel: string;
  liabilitiesLabel: string;
  /** The sum of every property with a real valuation. Zero until Layer 3 has
   *  one — never falls back on a purchase price. */
  propertyCents: number;
  propertyLabel: string;
  groups: GroupView[];
  /** Null until there are two snapshots to compare. A change figure invented
   *  from a single data point is the app asserting something nobody told it. */
  changeLabel: string | null;
  changeCents: number | null;
  changeSinceLabel: string | null;
};

export type ItemView = {
  id: string;
  institutionName: string;
  status: string;
  statusDetail: string | null;
  /** The one state no amount of automation can clear: the bank wants a person
   *  and a phone. Rendered in crimson, on every Ledger page, because an
   *  automation that has quietly stopped is the failure being designed against. */
  needsAttention: boolean;
  accountCount: number;
  syncedLabel: string | null;
};

export type LedgerStatusView = {
  /** Null when everything needed is present. Rendered *instead of* the surface,
   *  naming the missing environment variable — a 500 does not say which one. */
  setupProblem: string | null;
  items: ItemView[];
  accountCount: number;
  syncedLabel: string | null;
  attention: ItemView[];
};

export type JobView = {
  id: string;
  kindLabel: string;
  status: string;
  result: string | null;
  error: string | null;
  whenLabel: string;
  attempts: number;
};
