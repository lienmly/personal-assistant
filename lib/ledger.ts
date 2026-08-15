import type {
  AccountView,
  GroupView,
  ItemView,
  JobView,
  LedgerStatusView,
  NetWorthView,
} from "@/components/ledger/types";
import { db } from "@/lib/db";
import {
  ACCOUNT_KIND_LABEL,
  NET_WORTH_GROUPS,
  NET_WORTH_GROUP_LABEL,
  NEEDS_ATTENTION,
  TRANSFER_WINDOW_DAYS,
  type NetWorthGroup,
  netWorthGroupFor,
  netWorthSideFor,
} from "@/lib/ledger-rules";
import { moneyLabel, moneyParts, signedMoneyLabel } from "@/lib/money";
import { encryptionProblem } from "@/lib/crypto-box";
import { plaidProblem } from "@/lib/plaid";

/**
 * Everything `/ledger` reads.
 *
 * **Every figure leaves here as a string.** The client components in
 * `components/ledger/` must not import `lib/db`, and they must not format a
 * number either — `Intl` in a client bundle is both weight and a hydration
 * mismatch waiting to happen, which is the rule `components/today/types.ts`
 * already states for dates. Raw cents travel alongside the labels only where a
 * chart needs them for geometry.
 */

const stampFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** "2 hours ago". Coarse on purpose: the question this answers is "is this
 *  current", and a figure accurate to the minute invites reading it as one. */
function agoLabel(when: Date | null): string | null {
  if (!when) return null;

  const minutes = Math.floor((Date.now() - when.getTime()) / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;

  return stampFormat.format(when);
}

/**
 * Why the Ledger cannot run yet, as a sentence, or `null`.
 *
 * Both halves are refusals rather than throws — `DEEPSEEK_API_KEY`'s posture:
 * without a key the drawer opens and says so, and nothing else in the app
 * breaks. A missing encryption key in particular must not be a 500, because the
 * 500 does not say which variable is missing.
 */
function setupProblem(): string | null {
  return encryptionProblem() ?? plaidProblem();
}

export async function getLedgerStatus(): Promise<LedgerStatusView> {
  const problem = setupProblem();

  const items = await db.plaidItem.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      institutionName: true,
      status: true,
      statusDetail: true,
      lastSyncedAt: true,
      _count: { select: { accounts: true } },
    },
  });

  const views: ItemView[] = items.map((item) => ({
    id: item.id,
    institutionName: item.institutionName,
    status: item.status,
    statusDetail: item.statusDetail,
    needsAttention: NEEDS_ATTENTION.has(item.status),
    accountCount: item._count.accounts,
    syncedLabel: agoLabel(item.lastSyncedAt),
  }));

  const syncedAt = items
    .map((item) => item.lastSyncedAt)
    .filter((value): value is Date => value !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    setupProblem: problem,
    items: views,
    accountCount: views.reduce((sum, item) => sum + item.accountCount, 0),
    syncedLabel: agoLabel(syncedAt ?? null),
    attention: views.filter((item) => item.needsAttention),
  };
}

/**
 * The net worth, and every account that makes it up.
 *
 * A closed account is excluded outright; an account with `includeInNetWorth`
 * false is still *listed* but contributes nothing — the distinction matters,
 * because a hidden account that vanished from the list would be one you cannot
 * un-hide.
 */
export async function getNetWorth(): Promise<NetWorthView> {
  const accounts = await db.account.findMany({
    where: { closedAt: null },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      officialName: true,
      mask: true,
      kind: true,
      currentCents: true,
      availableCents: true,
      limitCents: true,
      balanceAt: true,
      includeInNetWorth: true,
      item: {
        select: { institutionName: true, status: true, lastSyncedAt: true },
      },
    },
  });

  const views: AccountView[] = accounts.map((account) => {
    const magnitude = account.currentCents ?? 0;
    const side = netWorthSideFor(account.kind);

    return {
      id: account.id,
      name: account.name,
      officialName: account.officialName,
      mask: account.mask,
      kind: account.kind,
      kindLabel: ACCOUNT_KIND_LABEL[account.kind],
      group: netWorthGroupFor(account.kind),
      institutionName: account.item?.institutionName ?? "Disconnected",
      signedCents: side === "liability" ? -magnitude : magnitude,
      balanceLabel: moneyLabel(magnitude),
      availableLabel:
        account.availableCents === null
          ? null
          : moneyLabel(account.availableCents),
      limitLabel:
        account.limitCents === null ? null : moneyLabel(account.limitCents),
      includeInNetWorth: account.includeInNetWorth,
      syncedLabel: agoLabel(account.balanceAt ?? account.item?.lastSyncedAt ?? null),
      needsAttention: NEEDS_ATTENTION.has(account.item?.status ?? "good"),
    };
  });

  const counted = views.filter((account) => account.includeInNetWorth);

  const groups: GroupView[] = NET_WORTH_GROUPS.map((group) => {
    const inGroup = views.filter((account) => account.group === group);
    const totalCents = inGroup
      .filter((account) => account.includeInNetWorth)
      .reduce((sum, account) => sum + Math.abs(account.signedCents), 0);

    return {
      group,
      label: NET_WORTH_GROUP_LABEL[group],
      totalCents,
      totalLabel: moneyLabel(totalCents),
      accounts: inGroup,
    };
  }).filter((group) => group.accounts.length > 0 || group.group === "property");

  const totalCents = counted.reduce(
    (sum, account) => sum + account.signedCents,
    0,
  );
  const assetsCents = counted
    .filter((account) => account.signedCents > 0)
    .reduce((sum, account) => sum + account.signedCents, 0);
  const liabilitiesCents = counted
    .filter((account) => account.signedCents < 0)
    .reduce((sum, account) => sum - account.signedCents, 0);

  const byGroup = (group: NetWorthGroup) =>
    counted
      .filter((account) => account.group === group)
      .reduce((sum, account) => sum + Math.abs(account.signedCents), 0);

  // Property value joins the roll-up here rather than as an `Account`, because
  // it is the one figure on this surface that is an **estimate rather than a
  // statement** — and because the debt against it already *is* an account, so
  // modelling the asset as one too would double-count the mortgage.
  //
  // Only a property with a real valuation contributes. A property worth `null`
  // adds nothing rather than falling back on its purchase price: a house bought
  // in 2019 is not worth what it cost, and quietly saying it is would be the app
  // asserting a number nobody gave it.
  const propertyCents = await countedPropertyValue();

  const change = await monthChange(totalCents + propertyCents);

  const withProperty = totalCents + propertyCents;

  // The property band, injected into the group the composition bar draws. It has
  // no accounts, so `getNetWorth`'s filter keeps it only when it has a value.
  const withPropertyGroups = groups.map((group) =>
    group.group === "property"
      ? {
          ...group,
          totalCents: propertyCents,
          totalLabel: moneyLabel(propertyCents),
        }
      : group,
  );

  return {
    totalCents: withProperty,
    total: moneyParts(withProperty),
    assetsCents: assetsCents + propertyCents,
    liabilitiesCents,
    liquidCents: byGroup("liquid"),
    liquidLabel: moneyLabel(byGroup("liquid")),
    investedCents: byGroup("invested") + byGroup("retirement"),
    investedLabel: moneyLabel(byGroup("invested") + byGroup("retirement")),
    liabilitiesLabel: moneyLabel(liabilitiesCents),
    propertyCents,
    propertyLabel: moneyLabel(propertyCents),
    groups: withPropertyGroups.filter(
      (group) => group.accounts.length > 0 || group.totalCents > 0,
    ),
    ...change,
  };
}

/** The sum of every property that has a real valuation. A property with none
 *  contributes nothing — never its purchase price. */
async function countedPropertyValue(): Promise<number> {
  const properties = await db.property.findMany({
    where: { status: { not: "sold" }, valueCents: { not: null } },
    select: { valueCents: true },
  });
  return properties.reduce((sum, property) => sum + (property.valueCents ?? 0), 0);
}

/**
 * How much the total has moved since the first snapshot of this month.
 *
 * Returns nulls when there is no snapshot to compare against, which is the
 * state on the first day and after any gap — and the honest answer then is
 * silence rather than "+$0". A change figure derived from a single data point
 * would be the app asserting something nobody told it.
 */
async function monthChange(totalCents: number): Promise<{
  changeLabel: string | null;
  changeCents: number | null;
  changeSinceLabel: string | null;
}> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));

  const earliest = await db.netWorthSnapshot.findFirst({
    where: { on: { gte: monthStart } },
    orderBy: { on: "asc" },
    select: { on: true, totalCents: true },
  });

  if (!earliest) {
    return { changeLabel: null, changeCents: null, changeSinceLabel: null };
  }

  const changeCents = totalCents - earliest.totalCents;

  return {
    changeCents,
    changeLabel: `${signedMoneyLabel(changeCents)} this month`,
    // `@db.Date`, so it formats in UTC — CLAUDE.md §6.
    changeSinceLabel: new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(earliest.on),
  };
}

/**
 * Record today's answer, once.
 *
 * Idempotent on `on`, and called from `/ledger`'s data pass — the
 * `ensureSeriesSlots` bargain, for the same reason and at the same price. The
 * series therefore exists because you opened the page, and a gap is a day you
 * did not look.
 *
 * **Upsert rather than create-if-absent**, because a balance refresh later the
 * same day should move today's point. The alternative records the figure as it
 * stood at 7am and then disagrees with the number on screen all afternoon,
 * which is the kind of quiet contradiction that costs a surface its
 * trustworthiness.
 *
 * It writes nothing when there are no accounts. A zero snapshot on a fresh
 * install is a false data point, and one is enough to make the first real
 * reading look like a windfall.
 */
export async function ensureNetWorthSnapshot(): Promise<void> {
  const accounts = await db.account.findMany({
    where: { closedAt: null, includeInNetWorth: true },
    select: { kind: true, currentCents: true },
  });

  if (accounts.length === 0) return;

  const totals: Record<NetWorthGroup, number> = {
    liquid: 0,
    invested: 0,
    retirement: 0,
    property: 0,
    owed: 0,
  };

  for (const account of accounts) {
    totals[netWorthGroupFor(account.kind)] += Math.abs(
      account.currentCents ?? 0,
    );
  }

  totals.property = await countedPropertyValue();

  const now = new Date();
  const on = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );

  const totalCents =
    totals.liquid +
    totals.invested +
    totals.retirement +
    totals.property -
    totals.owed;

  const figures = {
    liquidCents: totals.liquid,
    investedCents: totals.invested,
    retirementCents: totals.retirement,
    propertyCents: totals.property,
    liabilityCents: totals.owed,
    totalCents,
    accountCount: accounts.length,
  };

  await db.netWorthSnapshot.upsert({
    where: { on },
    update: figures,
    create: { on, ...figures },
    select: { id: true },
  });
}

/**
 * Mark both halves of a transfer between accounts you own.
 *
 * Paying a credit card off is money leaving the current account and arriving at
 * the card. Neither is spending — but without this, the payment is usually the
 * largest "purchase" of the month and the card side shows as income, so the
 * month reads as an enormous spend and an enormous windfall that cancel out
 * only in the net.
 *
 * The match is: equal and opposite amounts, on **different** accounts, within a
 * few days. Plaid's own category is used as a hint but not trusted alone —
 * `TRANSFER_IN`/`TRANSFER_OUT` also covers money moving to somewhere you do not
 * own, which genuinely is spending as far as this ledger is concerned.
 *
 * Idempotent, and it runs over a window rather than the whole table: a transfer
 * that has already been marked simply matches itself again and is written with
 * the same value.
 */
export async function markTransfers(withinDays = 120): Promise<number> {
  const since = new Date(Date.now() - withinDays * 24 * 60 * 60_000);

  const rows = await db.transaction.findMany({
    where: { postedOn: { gte: since }, pending: false },
    select: { id: true, accountId: true, amountCents: true, postedOn: true, isTransfer: true },
    orderBy: { postedOn: "asc" },
  });

  const transferIds = new Set<string>();
  const byAmount = new Map<number, typeof rows>();

  for (const row of rows) {
    const list = byAmount.get(row.amountCents) ?? [];
    list.push(row);
    byAmount.set(row.amountCents, list);
  }

  for (const row of rows) {
    if (transferIds.has(row.id)) continue;

    const opposites = byAmount.get(-row.amountCents) ?? [];
    const match = opposites.find(
      (other) =>
        other.id !== row.id &&
        !transferIds.has(other.id) &&
        other.accountId !== row.accountId &&
        Math.abs(other.postedOn.getTime() - row.postedOn.getTime()) <=
          TRANSFER_WINDOW_DAYS * 24 * 60 * 60_000,
    );

    if (match) {
      transferIds.add(row.id);
      transferIds.add(match.id);
    }
  }

  const ids = [...transferIds];
  const alreadyMarked = rows.filter((row) => row.isTransfer).map((row) => row.id);

  // Both directions, so a pair that stops matching (one side deleted by Plaid)
  // goes back to being ordinary spending rather than staying hidden forever.
  const toMark = ids.filter((id) => !alreadyMarked.includes(id));
  const toUnmark = alreadyMarked.filter((id) => !transferIds.has(id));

  if (toMark.length > 0) {
    await db.transaction.updateMany({
      where: { id: { in: toMark } },
      data: { isTransfer: true },
    });
  }
  if (toUnmark.length > 0) {
    await db.transaction.updateMany({
      where: { id: { in: toUnmark } },
      data: { isTransfer: false },
    });
  }

  return ids.length;
}

export type MonthView = {
  key: string;
  label: string;
  inCents: number;
  outCents: number;
  netCents: number;
  netLabel: string;
};

export type CategoryView = {
  key: string;
  label: string;
  totalCents: number;
  totalLabel: string;
  count: number;
};

export type SpendingView = {
  months: MonthView[];
  categories: CategoryView[];
  inCents: number;
  outCents: number;
  netCents: number;
  inLabel: string;
  outLabel: string;
  netLabel: string;
  monthLabel: string;
  recurringCents: number;
  recurringLabel: string;
  transactionCount: number;
};

const monthFormat = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC",
});
const monthYearFormat = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Plaid's `personal_finance_category.primary` is SCREAMING_SNAKE. */
function categoryLabel(key: string): string {
  return key
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Where the money went, over the last `months` months.
 *
 * **Transfers are excluded from every figure here**, and pending rows are
 * included — a pending charge is money you have spent, whatever the bank has
 * settled, and leaving it out makes the current month read low for three days
 * and then jump.
 *
 * The month key is a **local** calendar month, built the same way `todayKey` is,
 * because "what did I spend in August" means the August you lived through.
 */
export async function getSpending(months = 12): Promise<SpendingView> {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getFullYear(), now.getMonth() - (months - 1), 1),
  );

  const rows = await db.transaction.findMany({
    where: { postedOn: { gte: start }, isTransfer: false },
    select: {
      amountCents: true,
      postedOn: true,
      category: true,
      plaidCategory: true,
    },
  });

  const buckets = new Map<string, { inCents: number; outCents: number }>();
  for (let index = 0; index < months; index += 1) {
    const when = new Date(
      Date.UTC(now.getFullYear(), now.getMonth() - (months - 1 - index), 1),
    );
    buckets.set(when.toISOString().slice(0, 7), { inCents: 0, outCents: 0 });
  }

  for (const row of rows) {
    const key = row.postedOn.toISOString().slice(0, 7);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (row.amountCents >= 0) bucket.inCents += row.amountCents;
    else bucket.outCents += -row.amountCents;
  }

  const monthViews: MonthView[] = [...buckets.entries()].map(([key, bucket]) => {
    const [year, month] = key.split("-").map(Number);
    const when = new Date(Date.UTC(year, month - 1, 1));
    const netCents = bucket.inCents - bucket.outCents;
    return {
      key,
      label: monthFormat.format(when),
      inCents: bucket.inCents,
      outCents: bucket.outCents,
      netCents,
      netLabel: signedMoneyLabel(netCents),
    };
  });

  // The current month is what the tiles report — "spent this month" is the
  // question, not "spent on average".
  const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = buckets.get(thisKey) ?? { inCents: 0, outCents: 0 };

  const spendThisMonth = rows.filter(
    (row) => row.postedOn.toISOString().slice(0, 7) === thisKey && row.amountCents < 0,
  );

  const categoryTotals = new Map<string, { totalCents: number; count: number }>();
  for (const row of spendThisMonth) {
    const key = row.category ?? row.plaidCategory ?? "UNCATEGORISED";
    const bucket = categoryTotals.get(key) ?? { totalCents: 0, count: 0 };
    bucket.totalCents += -row.amountCents;
    bucket.count += 1;
    categoryTotals.set(key, bucket);
  }

  const categories: CategoryView[] = [...categoryTotals.entries()]
    .map(([key, bucket]) => ({
      key,
      // A category you set by hand is already readable; only Plaid's needs
      // un-shouting.
      label: key === key.toUpperCase() ? categoryLabel(key) : key,
      totalCents: bucket.totalCents,
      totalLabel: moneyLabel(bucket.totalCents),
      count: bucket.count,
    }))
    .sort((a, b) => b.totalCents - a.totalCents);

  const netCents = thisMonth.inCents - thisMonth.outCents;
  const recurringCents = await estimateRecurring();

  return {
    months: monthViews,
    categories,
    inCents: thisMonth.inCents,
    outCents: thisMonth.outCents,
    netCents,
    inLabel: moneyLabel(thisMonth.inCents),
    outLabel: moneyLabel(thisMonth.outCents),
    netLabel: signedMoneyLabel(netCents),
    monthLabel: monthYearFormat.format(now),
    recurringCents,
    recurringLabel: moneyLabel(recurringCents),
    transactionCount: rows.length,
  };
}

/**
 * Roughly what leaves every month whatever you do.
 *
 * A merchant charging a **similar** amount in at least three of the last four
 * months. Similar rather than identical, because a utility bill moves and a
 * subscription with tax on it moves — requiring an exact match finds Netflix and
 * misses the electricity, which is the half worth knowing about.
 *
 * Deliberately a single number and not a list. "What is committed before I
 * decide anything" is the useful question; a screen enumerating every
 * subscription is a different feature, and one that invites the app to be wrong
 * out loud about which of them you meant to keep.
 */
async function estimateRecurring(): Promise<number> {
  const since = new Date(Date.now() - 120 * 24 * 60 * 60_000);
  const rows = await db.transaction.findMany({
    where: { postedOn: { gte: since }, isTransfer: false, amountCents: { lt: 0 } },
    select: { merchantName: true, name: true, amountCents: true, postedOn: true },
  });

  const byMerchant = new Map<string, { amountCents: number; month: string }[]>();
  for (const row of rows) {
    const key = (row.merchantName ?? row.name).toLowerCase().trim();
    const list = byMerchant.get(key) ?? [];
    list.push({
      amountCents: -row.amountCents,
      month: row.postedOn.toISOString().slice(0, 7),
    });
    byMerchant.set(key, list);
  }

  let total = 0;
  for (const charges of byMerchant.values()) {
    const months = new Set(charges.map((charge) => charge.month));
    if (months.size < 3) continue;

    const amounts = charges.map((charge) => charge.amountCents).sort((a, b) => a - b);
    const median = amounts[Math.floor(amounts.length / 2)];
    // Within 15% of the median counts as the same commitment.
    const consistent = charges.filter(
      (charge) => Math.abs(charge.amountCents - median) <= median * 0.15,
    );
    if (consistent.length >= 3) total += median;
  }

  return total;
}

export type SeriesPoint = {
  key: string;
  label: string;
  totalCents: number;
  /** True when no snapshot exists for this day and the previous one was carried
   *  forward. The chart draws these differently — a day you did not open the app
   *  is not a day the number was flat, and drawing them identically is the app
   *  asserting something nobody told it. */
  carried: boolean;
};

export type NetWorthSeriesView = {
  points: SeriesPoint[];
  minCents: number;
  maxCents: number;
  firstLabel: string;
  lastLabel: string;
  changeCents: number | null;
  changeLabel: string | null;
  rangeLabel: string;
};

const pointFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export const SERIES_RANGES = {
  "3m": { days: 90, label: "3 months" },
  "1y": { days: 365, label: "1 year" },
  all: { days: 3650, label: "All" },
} as const;

export type SeriesRange = keyof typeof SERIES_RANGES;

/**
 * Net worth over time, one point per day.
 *
 * Snapshots only exist for days the Ledger was opened (see `NetWorthSnapshot`),
 * so gaps are normal and are filled by carrying the previous value forward —
 * **and marked as carried**, because a flat line across a fortnight you did not
 * look is a claim, not a measurement.
 *
 * Returns nothing rather than a single point when there is only one snapshot: a
 * chart drawn through one point is a horizontal line that reads as a fortnight
 * of no change, which is the most misleading thing this surface could show on
 * its first day.
 */
export async function getNetWorthSeries(
  range: SeriesRange = "3m",
): Promise<NetWorthSeriesView | null> {
  const { days, label } = SERIES_RANGES[range];
  const now = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60_000);

  const snapshots = await db.netWorthSnapshot.findMany({
    where: { on: { gte: from } },
    orderBy: { on: "asc" },
    select: { on: true, totalCents: true },
  });

  if (snapshots.length < 2) return null;

  const byKey = new Map(
    snapshots.map((snap) => [snap.on.toISOString().slice(0, 10), snap.totalCents]),
  );

  const points: SeriesPoint[] = [];
  const first = snapshots[0].on;
  const lastDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  let carriedValue = snapshots[0].totalCents;
  for (
    let day = new Date(first);
    day.getTime() <= lastDay.getTime();
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const key = day.toISOString().slice(0, 10);
    const actual = byKey.get(key);
    if (actual !== undefined) carriedValue = actual;

    points.push({
      key,
      label: pointFormat.format(day),
      totalCents: carriedValue,
      carried: actual === undefined,
    });
  }

  const values = points.map((point) => point.totalCents);
  const changeCents =
    points.length > 1
      ? points[points.length - 1].totalCents - points[0].totalCents
      : null;

  return {
    points,
    minCents: Math.min(...values),
    maxCents: Math.max(...values),
    firstLabel: points[0].label,
    lastLabel: points[points.length - 1].label,
    changeCents,
    changeLabel: changeCents === null ? null : signedMoneyLabel(changeCents),
    rangeLabel: label,
  };
}

export type TransactionView = {
  id: string;
  name: string;
  merchantName: string | null;
  amountLabel: string;
  amountCents: number;
  dayLabel: string;
  accountName: string;
  categoryLabel: string | null;
  pending: boolean;
  isTransfer: boolean;
};

const txDayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** The most recent transactions, for the Accounts tab. Transfers included and
 *  labelled — hiding them would make the list disagree with the bank. */
export async function getTransactions(limit = 40): Promise<TransactionView[]> {
  const rows = await db.transaction.findMany({
    orderBy: [{ postedOn: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      name: true,
      merchantName: true,
      amountCents: true,
      postedOn: true,
      pending: true,
      isTransfer: true,
      category: true,
      plaidCategory: true,
      account: { select: { name: true } },
    },
  });

  return rows.map((row) => {
    const key = row.category ?? row.plaidCategory;
    return {
      id: row.id,
      name: row.merchantName ?? row.name,
      merchantName: row.merchantName,
      amountCents: row.amountCents,
      amountLabel: signedMoneyLabel(row.amountCents),
      dayLabel: txDayFormat.format(row.postedOn),
      accountName: row.account.name,
      categoryLabel: key ? (key === key.toUpperCase() ? categoryLabel(key) : key) : null,
      pending: row.pending,
      isTransfer: row.isTransfer,
    };
  });
}

const JOB_LABEL: Record<string, string> = {
  plaid_item_meta: "Checked a connection",
  plaid_balances: "Refreshed balances",
  plaid_sync: "Synced transactions",
  plaid_holdings: "Refreshed holdings",
  plaid_liabilities: "Refreshed loans",
  gmail_scan: "Looked for statements",
  statement_extract: "Read a statement",
  rentcast_refresh: "Refreshed a valuation",
  tax_rules_draft: "Drafted tax constants",
};

/**
 * The job log, for `/ledger/connections`.
 *
 * This is the screen that exists because automation fails silently. Failures
 * sort first regardless of age — a job that failed on Tuesday matters more than
 * one that succeeded this morning, and burying it under a chronological list is
 * how you end up with three weeks of stale balances nobody noticed.
 */
export async function getJobs(limit = 30): Promise<JobView[]> {
  const jobs = await db.ledgerJob.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      kind: true,
      status: true,
      result: true,
      error: true,
      attempts: true,
      createdAt: true,
      finishedAt: true,
    },
  });

  const views = jobs.map((job) => ({
    id: job.id,
    kindLabel: JOB_LABEL[job.kind] ?? job.kind,
    status: job.status,
    result: job.result,
    error: job.error,
    attempts: job.attempts,
    whenLabel: agoLabel(job.finishedAt ?? job.createdAt) ?? "just now",
  }));

  return [
    ...views.filter((job) => job.status === "failed"),
    ...views.filter((job) => job.status !== "failed"),
  ];
}
