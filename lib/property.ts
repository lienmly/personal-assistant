import type { PropertyStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { moneyLabel, moneyParts, signedMoneyLabel } from "@/lib/money";
import { depreciationBlocker } from "@/lib/property-rules";
import { VALUATION_STALE_DAYS } from "@/lib/rentcast";

/**
 * Everything the Property tab reads.
 *
 * The one figure on this surface that is an **estimate rather than a
 * statement** is the property's value, and the whole design of this file is
 * about not letting that leak into figures that are neither. Equity is
 * value-minus-debt, so it inherits the estimate's error bars and says so; cash
 * flow is bank transactions and is exact; the Schedule E lines in Layer 5 come
 * from statements and are exact. Mixing them into one confident number would be
 * the most expensive kind of wrong this app could produce.
 */

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const monthFormat = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: "UTC",
});

export type PropertyLoanView = {
  id: string;
  label: string;
  balanceCents: number;
  balanceLabel: string;
  ratePercent: number | null;
  /** True when the balance came from a linked account rather than by hand. */
  live: boolean;
  asOfLabel: string | null;
  accountName: string | null;
  ytdInterestCents: number | null;
  ytdInterestLabel: string | null;
  nextPaymentLabel: string | null;
};

export type PropertyCashFlowMonth = {
  key: string;
  label: string;
  inCents: number;
  outCents: number;
  netCents: number;
};

export type PropertyView = {
  id: string;
  slug: string;
  label: string;
  addressLabel: string;
  status: PropertyStatus;
  statusLabel: string;

  purchasePriceCents: number;
  purchasePriceLabel: string;
  purchasedLabel: string;
  basisCents: number;
  basisLabel: string;

  /** Null until a valuation exists. Never invented from the purchase price. */
  valueCents: number | null;
  value: { value: string; tail?: string } | null;
  valueRangeLabel: string | null;
  valuationAgeLabel: string | null;
  valuationStale: boolean;
  rentEstimateLabel: string | null;

  loans: PropertyLoanView[];
  owedCents: number;
  owedLabel: string;

  /** Null when there is no valuation — equity against an invented value is the
   *  one number on this screen that would be confidently wrong. */
  equityCents: number | null;
  equityLabel: string | null;

  monthlyRentCents: number | null;
  monthlyRentLabel: string | null;
  /** Market rent minus the lease, when both exist. The "are you under-renting"
   *  answer, and the only reason the rent estimate is fetched at all. */
  rentGapCents: number | null;
  rentGapLabel: string | null;

  cashFlow: PropertyCashFlowMonth[];
  cashFlowNetCents: number;
  cashFlowNetLabel: string;
  transactionCount: number;

  /** Annual rent over the value. Null without a valuation or a lease. */
  capRateLabel: string | null;

  landAllocationBasisPoints: number | null;
  placedInServiceLabel: string | null;
  /** What Layer 5 cannot compute without. Rendered as a prompt, not a warning. */
  depreciationBlocker: string | null;

  projectSlug: string | null;
  areaName: string | null;
  areaColor: string | null;
  managerName: string | null;
};

const STATUS_LABEL: Record<PropertyStatus, string> = {
  rented: "Rented",
  vacant: "Vacant",
  owner_occupied: "Lived in",
  sold: "Sold",
};

function agoDays(when: Date | null): number | null {
  if (!when) return null;
  return Math.floor((Date.now() - when.getTime()) / 86_400_000);
}

export async function getProperties(months = 12): Promise<PropertyView[]> {
  const properties = await db.property.findMany({
    orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
    include: {
      area: { select: { name: true, color: true } },
      project: { select: { slug: true } },
      loans: {
        orderBy: { sortOrder: "asc" },
        include: {
          account: {
            select: {
              name: true,
              currentCents: true,
              balanceAt: true,
              loan: {
                select: {
                  interestRatePercent: true,
                  ytdInterestCents: true,
                  nextPaymentCents: true,
                  nextPaymentDueOn: true,
                },
              },
            },
          },
        },
      },
      leases: { orderBy: { startsOn: "desc" }, take: 1 },
    },
  });

  if (properties.length === 0) return [];

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - (months - 1));
  const from = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), 1));

  const claimed = await db.transaction.findMany({
    where: { propertyId: { in: properties.map((p) => p.id) }, postedOn: { gte: from } },
    select: { propertyId: true, amountCents: true, postedOn: true },
  });

  return properties.map((property) => {
    const loans: PropertyLoanView[] = property.loans.map((loan) => {
      const live = loan.account !== null;
      const balanceCents = loan.account?.currentCents ?? loan.manualBalanceCents ?? 0;
      const detail = loan.account?.loan ?? null;

      return {
        id: loan.id,
        label: loan.label,
        balanceCents,
        balanceLabel: moneyLabel(balanceCents),
        ratePercent: detail?.interestRatePercent ?? loan.manualRatePercent ?? null,
        live,
        asOfLabel: live
          ? loan.account?.balanceAt
            ? dayFormat.format(loan.account.balanceAt)
            : null
          : loan.manualBalanceOn
            ? `entered ${dayFormat.format(loan.manualBalanceOn)}`
            : "entered by hand",
        accountName: loan.account?.name ?? null,
        ytdInterestCents: detail?.ytdInterestCents ?? null,
        ytdInterestLabel:
          detail?.ytdInterestCents != null
            ? moneyLabel(detail.ytdInterestCents)
            : null,
        nextPaymentLabel:
          detail?.nextPaymentCents != null
            ? `${moneyLabel(detail.nextPaymentCents)}${detail.nextPaymentDueOn ? ` due ${dayFormat.format(detail.nextPaymentDueOn)}` : ""}`
            : null,
      };
    });

    const owedCents = loans.reduce((sum, loan) => sum + loan.balanceCents, 0);
    const equityCents =
      property.valueCents === null ? null : property.valueCents - owedCents;

    const buckets = new Map<string, { inCents: number; outCents: number }>();
    for (let index = 0; index < months; index += 1) {
      const when = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + index, 1),
      );
      buckets.set(when.toISOString().slice(0, 7), { inCents: 0, outCents: 0 });
    }

    let count = 0;
    for (const row of claimed) {
      if (row.propertyId !== property.id) continue;
      count += 1;
      const bucket = buckets.get(row.postedOn.toISOString().slice(0, 7));
      if (!bucket) continue;
      if (row.amountCents >= 0) bucket.inCents += row.amountCents;
      else bucket.outCents += -row.amountCents;
    }

    const cashFlow: PropertyCashFlowMonth[] = [...buckets.entries()].map(
      ([key, bucket]) => {
        const [year, month] = key.split("-").map(Number);
        return {
          key,
          label: monthFormat.format(new Date(Date.UTC(year, month - 1, 1))),
          inCents: bucket.inCents,
          outCents: bucket.outCents,
          netCents: bucket.inCents - bucket.outCents,
        };
      },
    );

    const cashFlowNetCents = cashFlow.reduce((sum, month) => sum + month.netCents, 0);

    const lease = property.leases[0] ?? null;
    const rentGapCents =
      lease && property.rentEstimateCents !== null
        ? property.rentEstimateCents - lease.monthlyRentCents
        : null;

    const capRateLabel =
      lease && property.valueCents
        ? `${(((lease.monthlyRentCents * 12) / property.valueCents) * 100).toFixed(1)}%`
        : null;

    const age = agoDays(property.valuationAt);
    const basisCents = property.purchasePriceCents + property.closingCostsCents;

    return {
      id: property.id,
      slug: property.slug,
      label: property.label,
      addressLabel: `${property.addressLine}, ${property.city}, ${property.state} ${property.postalCode}`,
      status: property.status,
      statusLabel: STATUS_LABEL[property.status],

      purchasePriceCents: property.purchasePriceCents,
      purchasePriceLabel: moneyLabel(property.purchasePriceCents),
      purchasedLabel: dayFormat.format(property.purchasedOn),
      basisCents,
      basisLabel: moneyLabel(basisCents),

      valueCents: property.valueCents,
      value: property.valueCents === null ? null : moneyParts(property.valueCents),
      valueRangeLabel:
        property.valueLowCents !== null && property.valueHighCents !== null
          ? `${moneyLabel(property.valueLowCents)} – ${moneyLabel(property.valueHighCents)}`
          : null,
      valuationAgeLabel:
        age === null
          ? null
          : age === 0
            ? "valued today"
            : `valued ${age} ${age === 1 ? "day" : "days"} ago`,
      valuationStale: age === null || age > VALUATION_STALE_DAYS,
      rentEstimateLabel:
        property.rentEstimateCents === null
          ? null
          : moneyLabel(property.rentEstimateCents),

      loans,
      owedCents,
      owedLabel: moneyLabel(owedCents),
      equityCents,
      equityLabel: equityCents === null ? null : moneyLabel(equityCents),

      monthlyRentCents: lease?.monthlyRentCents ?? null,
      monthlyRentLabel: lease ? moneyLabel(lease.monthlyRentCents) : null,
      rentGapCents,
      rentGapLabel: rentGapCents === null ? null : signedMoneyLabel(rentGapCents),

      cashFlow,
      cashFlowNetCents,
      cashFlowNetLabel: signedMoneyLabel(cashFlowNetCents),
      transactionCount: count,

      capRateLabel,

      landAllocationBasisPoints: property.landAllocationBasisPoints,
      placedInServiceLabel: property.placedInServiceOn
        ? dayFormat.format(property.placedInServiceOn)
        : null,
      // Stated as what is *missing*, not as an error. Layer 5 refuses to
      // estimate depreciation without these two, because a plausible guess at
      // the land split is wrong by thousands a year and looks exactly like a
      // real figure.
      depreciationBlocker: depreciationBlocker(property),

      projectSlug: property.project?.slug ?? null,
      areaName: property.area?.name ?? null,
      areaColor: property.area?.color ?? null,
      managerName: property.managerName,
    };
  });
}

export type LoanCandidate = {
  accountId: string;
  accountName: string;
  balanceLabel: string;
  servicerAddress: string | null;
  /** How well the servicer's address matches this property's, 0–1. A hint for
   *  ordering the list — never a decision. */
  score: number;
};

/**
 * Mortgage accounts that are not yet attached to any property.
 *
 * Plaid's Liabilities product hands back a `property_address` string, and the
 * temptation is to match it and attach the loan automatically. **It suggests and
 * never assigns.** A mortgage on the wrong property is a wrong Schedule E — the
 * depreciation, the interest deduction and the cash flow all move — and a string
 * comparison is a guess. So the candidates are ordered by similarity and a human
 * presses the button.
 */
export async function getLoanCandidates(
  address: { addressLine: string; postalCode: string } | null,
): Promise<LoanCandidate[]> {
  const accounts = await db.account.findMany({
    where: {
      kind: { in: ["mortgage", "loan"] },
      closedAt: null,
      propertyLoan: null,
    },
    select: {
      id: true,
      name: true,
      currentCents: true,
      loan: { select: { propertyAddress: true } },
    },
  });

  const target = address
    ? `${address.addressLine} ${address.postalCode}`.toLowerCase()
    : "";

  return accounts
    .map((account) => {
      const servicer = account.loan?.propertyAddress ?? null;
      return {
        accountId: account.id,
        accountName: account.name,
        balanceLabel: moneyLabel(account.currentCents ?? 0),
        servicerAddress: servicer,
        score: servicer && target ? similarity(servicer.toLowerCase(), target) : 0,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/** Shared-token overlap. Crude on purpose — it orders a short list and nothing
 *  more, so a cleverer metric would buy precision nobody acts on. */
function similarity(a: string, b: string): number {
  const left = new Set(a.split(/[\s,]+/).filter((word) => word.length > 2));
  const right = new Set(b.split(/[\s,]+/).filter((word) => word.length > 2));
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.max(left.size, right.size);
}

/** Properties whose valuation is stale enough to refresh. Read by
 *  `ensureLedgerJobs`; the quota guard lives in the job itself. */
export async function staleValuations(): Promise<{ id: string }[]> {
  const cutoff = new Date(Date.now() - VALUATION_STALE_DAYS * 86_400_000);
  return db.property.findMany({
    where: {
      status: { not: "sold" },
      OR: [{ valuationAt: null }, { valuationAt: { lt: cutoff } }],
    },
    select: { id: true },
  });
}
