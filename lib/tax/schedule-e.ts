import { db } from "@/lib/db";
import { moneyLabel, signedMoneyLabel } from "@/lib/money";
import { SCHEDULE_E_LABEL, SCHEDULE_E_LINES } from "@/lib/statement-rules";
import {
  annualDepreciation,
  buildingBasisCents,
} from "@/lib/tax/depreciation";

/**
 * One property's Schedule E, for one year.
 *
 * Assembled from three sources, and **they are not interchangeable**:
 *
 * 1. **Accepted statements** — the rent, the management fee, the repairs. Only
 *    `accepted`: a statement that has not reconciled is not a fact, and a
 *    Schedule E built from unreviewed rows would be a number nobody checked
 *    presented as a filing figure.
 * 2. **Claimed transactions** — anything paid directly rather than through the
 *    manager. Only rows a human attached to the property (§6): inferring them
 *    from the account the mortgage is paid out of would file the weekly shop
 *    under the rental.
 * 3. **`LoanDetail.ytdInterestCents`** — the mortgage interest, straight from
 *    the servicer. This is the one line the transaction feed genuinely cannot
 *    recover, because a mortgage payment leaves the account as a single figure
 *    with the split nowhere in it.
 *
 * Plus depreciation, which is computed and **refused** without the land split.
 *
 * The whole thing returns `notComputed` reasons rather than falling back on
 * anything. A Schedule E missing its depreciation line is obviously incomplete;
 * a Schedule E with a *guessed* depreciation line is wrong and looks finished.
 */

export type ScheduleELine = {
  key: string;
  label: string;
  cents: number;
  centsLabel: string;
  /** Where it came from, so a figure can be traced without running a query.
   *  A line sourced from the servicer and one summed out of statements are
   *  different kinds of certainty, and the tab says which. */
  source: "statements" | "transactions" | "servicer" | "computed";
};

export type ScheduleE = {
  propertyId: string;
  propertyLabel: string;
  taxYear: number;

  incomeCents: number;
  incomeLabel: string;

  lines: ScheduleELine[];
  expenseCents: number;
  expenseLabel: string;

  /** Null when it could not be computed — never zero, never a guess. */
  depreciationCents: number | null;
  depreciationLabel: string | null;
  depreciationBlocker: string | null;

  /** Income minus expenses minus depreciation. Null if depreciation is. */
  netCents: number | null;
  netLabel: string | null;

  /** What the figures rest on, said plainly on the tab. */
  statementCount: number;
  unacceptedCount: number;
  transactionCount: number;
  notes: string[];
};

export async function scheduleEFor(
  propertyId: string,
  taxYear: number,
): Promise<ScheduleE | null> {
  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      label: true,
      purchasePriceCents: true,
      closingCostsCents: true,
      landAllocationBasisPoints: true,
      placedInServiceOn: true,
      loans: {
        select: {
          account: {
            select: { loan: { select: { ytdInterestCents: true, refreshedAt: true } } },
          },
        },
      },
      assets: {
        select: {
          basisCents: true,
          placedInServiceOn: true,
          method: true,
          disposedOn: true,
        },
      },
    },
  });
  if (!property) return null;

  const yearStart = new Date(Date.UTC(taxYear, 0, 1));
  const yearEnd = new Date(Date.UTC(taxYear, 11, 31));

  const [statements, transactions] = await Promise.all([
    db.propertyStatement.findMany({
      where: {
        propertyId,
        status: "accepted",
        periodStart: { gte: yearStart, lte: yearEnd },
      },
      select: {
        id: true,
        lineItems: { select: { amountCents: true, taxCategory: true, kind: true } },
      },
    }),
    db.transaction.findMany({
      where: {
        propertyId,
        postedOn: { gte: yearStart, lte: yearEnd },
        // A capital improvement has been promoted to an asset and is deducted
        // through depreciation instead. Counting it here as well would deduct
        // it twice — once in full this year and again over 27.5 years.
        assetId: null,
      },
      select: { amountCents: true, taxCategory: true },
    }),
  ]);

  const unaccepted = await db.propertyStatement.count({
    where: {
      propertyId,
      status: { in: ["needs_review", "pending"] },
      periodStart: { gte: yearStart, lte: yearEnd },
    },
  });

  const buckets = new Map<string, { cents: number; source: ScheduleELine["source"] }>();
  let incomeCents = 0;

  for (const statement of statements) {
    for (const item of statement.lineItems) {
      // Owner draws and reserve movements are money moving between accounts,
      // not income or expense (§6).
      if (item.kind === "distribution" || item.kind === "reserve") continue;

      if (item.taxCategory === "rents_received") {
        incomeCents += item.amountCents;
        continue;
      }
      if (!item.taxCategory) continue;

      const bucket = buckets.get(item.taxCategory) ?? {
        cents: 0,
        source: "statements" as const,
      };
      bucket.cents += Math.abs(item.amountCents);
      buckets.set(item.taxCategory, bucket);
    }
  }

  for (const row of transactions) {
    if (!row.taxCategory) continue;
    if (row.taxCategory === "rents_received") {
      incomeCents += row.amountCents;
      continue;
    }
    const bucket = buckets.get(row.taxCategory) ?? {
      cents: 0,
      source: "transactions" as const,
    };
    bucket.cents += Math.abs(row.amountCents);
    buckets.set(row.taxCategory, bucket);
  }

  const notes: string[] = [];

  // Mortgage interest, from the servicer. YTD is a *year-to-date* figure, so it
  // is only the year's total once the year is over — said out loud rather than
  // presented as final.
  const interest = property.loans
    .map((loan) => loan.account?.loan?.ytdInterestCents ?? 0)
    .reduce((sum, cents) => sum + cents, 0);

  if (interest > 0) {
    buckets.set("mortgage_interest", { cents: interest, source: "servicer" });
    const currentYear = new Date().getUTCFullYear();
    if (taxYear === currentYear) {
      notes.push(
        "Mortgage interest is the servicer's year-to-date figure, so it will keep rising until December.",
      );
    }
  }

  // Depreciation. The building, plus any assets promoted from expenses.
  const buildingBasis = buildingBasisCents(property);
  let depreciationCents: number | null = null;
  let depreciationBlocker: string | null = null;

  if (buildingBasis === null) {
    depreciationBlocker =
      "The land/improvement split has not been entered, and land does not depreciate — so the building's basis is unknown.";
  } else if (!property.placedInServiceOn) {
    depreciationBlocker =
      "The date it was first available to rent has not been entered, and the first year's deduction depends on the month.";
  } else {
    const building = annualDepreciation(
      {
        basisCents: buildingBasis,
        placedInServiceOn: property.placedInServiceOn,
        method: "sl_27_5_mid_month",
      },
      taxYear,
    );

    let total = building ?? 0;
    let blocked = building === null;

    for (const asset of property.assets) {
      const amount = annualDepreciation(asset, taxYear);
      if (amount === null) {
        blocked = true;
        break;
      }
      total += amount;
    }

    if (blocked) {
      depreciationBlocker =
        "One of the depreciating items needs a rule-set figure that has not been confirmed yet.";
    } else {
      depreciationCents = total;
    }
  }

  const lines: ScheduleELine[] = SCHEDULE_E_LINES.filter(
    (key) => key !== "rents_received" && key !== "depreciation",
  )
    .map((key): ScheduleELine | null => {
      const bucket = buckets.get(key);
      if (!bucket || bucket.cents === 0) return null;
      return {
        key,
        label: SCHEDULE_E_LABEL[key] ?? key,
        cents: bucket.cents,
        centsLabel: moneyLabel(bucket.cents),
        source: bucket.source,
      };
    })
    .filter((line): line is ScheduleELine => line !== null);

  const expenseCents = lines.reduce((sum, line) => sum + line.cents, 0);
  const netCents =
    depreciationCents === null
      ? null
      : incomeCents - expenseCents - depreciationCents;

  if (unaccepted > 0) {
    notes.push(
      `${unaccepted} ${unaccepted === 1 ? "statement has" : "statements have"} not been accepted yet, so ${unaccepted === 1 ? "its" : "their"} rows are not counted here.`,
    );
  }
  if (statements.length === 0 && transactions.length === 0) {
    notes.push(
      "Nothing has been counted for this year yet — accepted statements and claimed transactions are what fill this in.",
    );
  }

  return {
    propertyId: property.id,
    propertyLabel: property.label,
    taxYear,

    incomeCents,
    incomeLabel: moneyLabel(incomeCents),

    lines,
    expenseCents,
    expenseLabel: moneyLabel(expenseCents),

    depreciationCents,
    depreciationLabel:
      depreciationCents === null ? null : moneyLabel(depreciationCents),
    depreciationBlocker,

    netCents,
    netLabel: netCents === null ? null : signedMoneyLabel(netCents),

    statementCount: statements.length,
    unacceptedCount: unaccepted,
    transactionCount: transactions.length,
    notes,
  };
}
