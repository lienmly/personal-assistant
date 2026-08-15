import Link from "next/link";
import { KeyRound, Landmark, ScrollText, Wallet } from "lucide-react";

import { AccountList } from "@/components/ledger/account-list";
import { BarColumn } from "@/components/ledger/bar-column";
import { CompositionBar } from "@/components/ledger/composition-bar";
import { JobsKick } from "@/components/ledger/jobs-kick";
import { LinkBankButton } from "@/components/ledger/link-bank-button";
import {
  NoProperties,
  PropertyCard,
} from "@/components/ledger/property-card";
import { AddPropertyButton } from "@/components/ledger/property-form";
import { StatementReview } from "@/components/ledger/statement-review";
import { StatementSources } from "@/components/ledger/statement-upload";
import { RuleSetCard } from "@/components/ledger/ruleset-card";
import { RuleSetDiff } from "@/components/ledger/ruleset-diff";
import { StrategyList } from "@/components/ledger/strategy-list";
import { ScheduleETable } from "@/components/ledger/schedule-e-table";
import { TaxEstimateView } from "@/components/ledger/tax-estimate";
import { TaxProfileButton } from "@/components/ledger/tax-profile-form";
import { SparkLine } from "@/components/ledger/spark-line";
import { SyncStrip } from "@/components/ledger/sync-strip";
import {
  CategoryBreakdown,
  TransactionList,
} from "@/components/ledger/transaction-list";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceHeader } from "@/components/ui/surface-header";
import {
  SERIES_RANGES,
  type SeriesRange,
  ensureNetWorthSnapshot,
  getLedgerStatus,
  getNetWorth,
  getNetWorthSeries,
  getSpending,
  getTransactions,
} from "@/lib/ledger";
import { ensureLedgerJobs } from "@/lib/ledger-jobs";
import { getProperties } from "@/lib/property";
import { getStatementQueue, getStatements } from "@/lib/statements";
import { getTaxView } from "@/lib/tax";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Ledger · Clan Centurio" };

/**
 * Money.
 *
 * The sixth surface, and the one CLAUDE.md §6 named in advance as the test of
 * whether the information architecture could absorb a whole new life area
 * without an IA change. It could: this cost one entry in `lib/nav.ts`.
 *
 * **Tabs arrive with their layer.** Property and Tax estimate are Layers 3 and
 * 5; they are not stubbed here, because a tab that opens on "coming soon" is the
 * same empty promise as a seeded task — a row you have to stop and dismiss.
 * Adding one is a single entry in `TABS`.
 */
const TABS = ["worth", "accounts", "property", "tax"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  worth: "Net worth",
  accounts: "Accounts",
  property: "Property",
  // "Tax estimate", not "Tax". The word is in the navigation, so it cannot be
  // scrolled past — §6, "an estimate is structural, not a banner".
  tax: "Tax estimate",
};

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    range?: string;
    gmail?: string;
    gmailOk?: string;
    year?: string;
  }>;
}) {
  const query = await searchParams;
  const tab: Tab = TABS.includes(query.tab as Tab)
    ? (query.tab as Tab)
    : "worth";
  const range: SeriesRange =
    query.range === "1y" || query.range === "all" ? query.range : "3m";

  const thisYear = new Date().getUTCFullYear();
  const requested = Number(query.year);
  const taxYear =
    Number.isInteger(requested) && requested > 2000 && requested <= thisYear + 1
      ? requested
      : thisYear;

  const status = await getLedgerStatus();

  // Nothing below this point may run without an encryption key and Plaid
  // credentials — and a missing environment variable must produce a screen that
  // *names it*, not a 500. `DEEPSEEK_API_KEY`'s posture, one surface over.
  if (status.setupProblem) {
    return (
      <>
        <SurfaceHeader
          title="Ledger"
          tagline="What you have, what you owe, and what April will cost"
        />
        <Card>
          <EmptyState
            icon={KeyRound}
            title="The Ledger needs one more environment variable"
            body={`${status.setupProblem} Set it in .env.local and in Railway, then reload. Nothing else in the app is affected.`}
          />
        </Card>
      </>
    );
  }

  // Enqueue only — never awaits a bank. `JobsKick` drains the queue once the
  // page has painted.
  await ensureLedgerJobs();

  const worth = await getNetWorth();
  // After the roll-up, so today's point reflects what was just read.
  await ensureNetWorthSnapshot();

  const hasAccounts = worth.groups.some((group) => group.accounts.length > 0);

  // Only the active tab's heavy read runs — the rule `app/(app)/areas/[slug]`
  // established. The spending query walks a year of transactions and the series
  // walks every snapshot; neither has any business running to draw the other tab.
  const [series, spending, transactions, properties, statements, queue, tax] =
    await Promise.all([
    hasAccounts && tab === "worth"
      ? getNetWorthSeries(range)
      : Promise.resolve(null),
    hasAccounts && tab === "accounts" ? getSpending(12) : Promise.resolve(null),
    hasAccounts && tab === "accounts" ? getTransactions(40) : Promise.resolve([]),
    tab === "property" ? getProperties(12) : Promise.resolve([]),
    tab === "property" ? getStatements(24) : Promise.resolve([]),
    tab === "property" ? getStatementQueue() : Promise.resolve(null),
    tab === "tax" ? getTaxView(taxYear) : Promise.resolve(null),
  ]);

  return (
    <>
      <JobsKick />

      <SurfaceHeader
        title="Ledger"
        tagline="What you have, what you owe, and what April will cost"
        meta={hasAccounts ? worth.total.value : undefined}
      />

      <SyncStrip status={status} />

      {/* The tab strip is not gated on having a bank: a property can be added
          before anything is linked, and its value, mortgage and statements do
          not come from the same place as the bank feed. Only the two tabs that
          genuinely need accounts say so. */}
      <>
          <nav className="mb-5 flex flex-wrap gap-1.5 rounded-chip bg-inset p-1 sm:w-fit">
            {TABS.map((name) => (
              <Link
                key={name}
                href={`/ledger${name === "worth" ? "" : `?tab=${name}`}`}
                className={cn(
                  "rounded-chip px-4 py-2 text-[13px] transition-[background-color,color] duration-(--duration-base) ease-soft",
                  name === tab
                    ? "bg-obsidian font-medium text-white"
                    : "text-muted hover:text-ink",
                )}
              >
                {TAB_LABELS[name]}
              </Link>
            ))}
          </nav>

          {tab === "worth" && !hasAccounts && (
            <Card>
              <EmptyState
                icon={Landmark}
                title="No banks connected yet"
                body="Link an account and the balances, transactions and net worth fill themselves in — and keep doing it. Nothing here is typed in by hand."
              />
              <div className="mt-4 flex justify-center">
                <LinkBankButton />
              </div>
            </Card>
          )}

          {tab === "accounts" && !hasAccounts && (
            <Card>
              <EmptyState
                icon={Landmark}
                title="Nothing to show yet"
                body="Transactions, spending and categories all arrive from a linked bank."
              />
              <div className="mt-4 flex justify-center">
                <LinkBankButton />
              </div>
            </Card>
          )}

          {tab === "property" && (
            <>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted">
                  {properties.length === 0
                    ? "The one thing here that has to be typed in"
                    : `${properties.length} ${properties.length === 1 ? "property" : "properties"}`}
                </p>
                <AddPropertyButton />
              </div>

              {properties.length === 0 ? (
                <Card>
                  <NoProperties />
                </Card>
              ) : (
                <div className="flex flex-col gap-5">
                  {properties.map((property, index) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      index={index}
                    />
                  ))}
                </div>
              )}

              {queue && (
                <Card className="mt-5">
                  <CardHeader
                    title="Owner statements"
                    count={
                      queue.needsReview > 0
                        ? `${queue.needsReview} to check`
                        : `${queue.accepted} accepted`
                    }
                    hint={
                      queue.pending > 0 ? `${queue.pending} being read` : undefined
                    }
                  />
                  <StatementSources
                    queue={queue}
                    properties={properties.map((property) => ({
                      id: property.id,
                      label: property.label,
                    }))}
                    notice={
                      query.gmail
                        ? { kind: "error", message: query.gmail }
                        : query.gmailOk
                          ? {
                              kind: "ok",
                              message: `Gmail connected as ${query.gmailOk}. Statements will be read as they arrive.`,
                            }
                          : null
                    }
                  />
                </Card>
              )}


              {statements.length > 0 && (
                <div className="mt-5 flex flex-col gap-4">
                  {statements.map((statement) => (
                    <StatementReview
                      key={statement.id}
                      statement={statement}
                      properties={properties.map((property) => ({
                        id: property.id,
                        label: property.label,
                      }))}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "tax" && tax && (
            <>
              {/* The rule sets come first, and when one is incomplete this is
                  the first thing on the tab. A badge beside a figure would make
                  the numbers the headline and their provenance an aside, which
                  is the wrong way round when the figures are only as good as
                  constants nobody has looked up yet. §6. */}
              <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <RuleSetCard ruleSet={tax.federal} />
                <RuleSetCard ruleSet={tax.california} />
              </div>

              {tax.pendingFigures.length > 0 && (
                <Card className="mb-5">
                  <CardHeader
                    title="Numbers waiting to be confirmed"
                    count={`${tax.pendingFigures.length}`}
                    hint="Read off the published source"
                  />
                  <RuleSetDiff figures={tax.pendingFigures} />
                </Card>
              )}

              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-muted">
                  {tax.profile
                    ? `Your answers were last changed ${tax.profile.updatedLabel}`
                    : "The estimate needs a few things no bank can supply"}
                </p>
                <TaxProfileButton taxYear={tax.taxYear} profile={tax.profile} />
              </div>

              {tax.estimate ? (
                <div className="mb-5">
                  <TaxEstimateView tax={tax} />
                </div>
              ) : (
                <Card className="mb-5">
                  <EmptyState
                    icon={ScrollText}
                    title="Nothing is estimated yet, on purpose"
                    body={
                      tax.estimateBlocker ??
                      tax.blocker ??
                      "Something the estimate needs is still missing."
                    }
                  />
                  <p className="mt-4 text-center text-[12.5px] leading-relaxed text-muted">
                    A tax figure that is 4% wrong looks exactly like one that is
                    right, and nothing downstream contradicts it. So the engine
                    computes nothing until every constant has been read off its
                    published source.
                  </p>
                </Card>
              )}

              <Card className="mb-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                    Rentals, {tax.taxYear}
                  </h2>
                  <nav className="flex gap-1 rounded-chip bg-inset p-1">
                    {tax.availableYears.slice(0, 4).map((year) => (
                      <Link
                        key={year}
                        href={`/ledger?tab=tax${year === thisYear ? "" : `&year=${year}`}`}
                        className={cn(
                          "rounded-chip px-3 py-1 text-[12.5px] transition-[background-color,color] duration-(--duration-base) ease-soft",
                          year === tax.taxYear
                            ? "bg-obsidian font-medium text-white"
                            : "text-muted hover:text-ink",
                        )}
                      >
                        {year}
                      </Link>
                    ))}
                  </nav>
                </div>

                {tax.scheduleEs.length === 0 ? (
                  <p className="text-[13px] leading-relaxed text-muted">
                    No rentals yet. Add a property and accept a statement, and
                    the year&rsquo;s income, expenses and depreciation assemble
                    themselves here.
                  </p>
                ) : (
                  <div className="flex flex-col gap-8">
                    {tax.scheduleEs.map((schedule) => (
                      <ScheduleETable
                        key={schedule.propertyId}
                        schedule={schedule}
                      />
                    ))}
                  </div>
                )}
              </Card>

              {tax.estimate && (
                <Card className="mb-5">
                  <CardHeader
                    title="Worth asking your accountant"
                    count={
                      tax.strategies.length > 0
                        ? `${tax.strategies.length}`
                        : undefined
                    }
                    hint="Questions, not instructions"
                  />
                  <StrategyList
                    strategies={tax.strategies}
                    taxYear={tax.taxYear}
                    notes={tax.strategyNotes}
                  />
                </Card>
              )}

              {/* Permanent, non-dismissible, and enumerated rather than gestured
                  at. §6 — the honest half of an estimate is the list of what it
                  does not model. */}
              <Card>
                <CardHeader title="What this does not model" />
                <ul className="flex flex-col gap-1.5 text-[13px] leading-relaxed text-muted">
                  {[
                    "Alternative minimum tax",
                    "K-1s from partnerships or S-corps",
                    "1031 exchanges and installment sales",
                    "Moving between states part-way through a year",
                    "Converting a rental to personal use, or back",
                    "Most state credits",
                    "California's separate passive-loss bookkeeping",
                  ].map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-faint">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12.5px] leading-relaxed text-faint">
                  This is a working estimate for planning, assembled from your
                  statements and bank rows. It is not a return, and nothing here
                  is advice — anything worth acting on is worth raising with your
                  accountant.
                </p>
              </Card>
            </>
          )}

          {tab === "worth" && hasAccounts && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {/* The one dark tile on this screen (§9's budget of one). The
                    hero figure is the whole reason the surface exists, and it
                    is an achievement rather than a deficit — the same swap
                    Today made when the sprint tile became "Ticked off today". */}
                <StatTile
                  label="Net worth"
                  value={worth.total.value}
                  tail={worth.total.tail}
                  tone="dark"
                  note={
                    worth.changeLabel ??
                    "Tracking starts today — a change needs two days to exist"
                  }
                />
                <StatTile
                  label="Liquid"
                  value={worth.liquidLabel}
                  note="Spendable this afternoon"
                />
                <StatTile
                  label="Invested"
                  value={worth.investedLabel}
                  note="Brokerage and retirement"
                />
                <StatTile
                  label="Owed"
                  value={worth.liabilitiesLabel}
                  note={
                    worth.liabilitiesCents === 0
                      ? "Nothing outstanding"
                      : "Cards and loans"
                  }
                />
              </div>

              <Card className="mb-5">
                <CardHeader
                  title="What it is made of"
                  hint={
                    worth.changeSinceLabel
                      ? `Compared with ${worth.changeSinceLabel}`
                      : undefined
                  }
                />
                <CompositionBar worth={worth} />
              </Card>

              <Card className="mb-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-[15px] font-semibold tracking-tight text-ink">
                    Over time
                  </h2>
                  {/* §9 allows one accent per region and it is spent on "Link a
                      bank" above, so the selected pill is the filled-obsidian
                      segmented control the tab strip already uses. */}
                  <nav className="flex gap-1 rounded-chip bg-inset p-1">
                    {(Object.keys(SERIES_RANGES) as SeriesRange[]).map((key) => (
                      <Link
                        key={key}
                        href={`/ledger${key === "3m" ? "" : `?range=${key}`}`}
                        className={cn(
                          "rounded-chip px-3 py-1 text-[12.5px] transition-[background-color,color] duration-(--duration-base) ease-soft",
                          key === range
                            ? "bg-obsidian font-medium text-white"
                            : "text-muted hover:text-ink",
                        )}
                      >
                        {SERIES_RANGES[key].label}
                      </Link>
                    ))}
                  </nav>
                </div>

                {series ? (
                  <SparkLine series={series} />
                ) : (
                  <p className="text-[13px] leading-relaxed text-muted">
                    A line needs two days to exist. Net worth is recorded once
                    each day you open the Ledger, so this fills in from
                    tomorrow — nothing is being computed backwards, because a
                    chart drawn through one point is a claim about a fortnight
                    nobody measured.
                  </p>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="What is counted"
                  hint="Crypto and vehicles are deliberately out"
                />
                <p className="text-[13px] leading-relaxed text-muted">
                  Bank balances, brokerage and retirement holdings, credit cards
                  and loans — all pulled automatically. Property arrives with the
                  next layer and is the one figure that is an estimate rather
                  than a statement.
                </p>
              </Card>
            </>
          )}

          {tab === "accounts" && spending && (
            <>
              <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {/* The one dark tile on this tab. Spending is the question the
                    Accounts tab is opened with. */}
                <StatTile
                  label="Spent this month"
                  value={spending.outLabel}
                  tone="dark"
                  note={spending.monthLabel}
                />
                <StatTile
                  label="Money in"
                  value={spending.inLabel}
                  note="Transfers excluded"
                />
                <StatTile
                  label="Net"
                  value={spending.netLabel}
                  note={spending.netCents >= 0 ? "Ahead this month" : "Behind this month"}
                />
                <StatTile
                  label="Recurring"
                  value={spending.recurringLabel}
                  note="Roughly, each month"
                />
              </div>

              <Card className="mb-5">
                <CardHeader title="In and out" hint="Last 12 months" />
                <BarColumn months={spending.months} />
              </Card>

              <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader
                    title="Where it went"
                    hint={spending.monthLabel}
                  />
                  <CategoryBreakdown
                    categories={spending.categories}
                    monthLabel={spending.monthLabel}
                  />
                </Card>

                <Card>
                  <CardHeader
                    title="Accounts"
                    count={`${status.accountCount}`}
                  />
                  <AccountList groups={worth.groups} />
                </Card>
              </div>

              <Card>
                <CardHeader title="Recent" count={`${transactions.length}`} />
                <TransactionList transactions={transactions} />

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <LinkBankButton label="Link another bank" tone="quiet" />
                  <Link
                    href="/ledger/connections"
                    className="text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
                  >
                    Connections →
                  </Link>
                </div>
              </Card>
            </>
          )}
      </>

      {!hasAccounts && tab === "worth" && (
        <div className="mt-5">
          <Card>
            <CardHeader title="What this will do" />
            <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
              <li className="flex gap-2">
                <Wallet
                  className="mt-0.5 size-3.5 shrink-0 text-faint"
                  strokeWidth={1.8}
                />
                Every balance in one place, refreshed without being asked.
              </li>
              <li className="flex gap-2">
                <Wallet
                  className="mt-0.5 size-3.5 shrink-0 text-faint"
                  strokeWidth={1.8}
                />
                Spending, categorised, so &ldquo;where did it go&rdquo; is a
                question with an answer.
              </li>
              <li className="flex gap-2">
                <Wallet
                  className="mt-0.5 size-3.5 shrink-0 text-faint"
                  strokeWidth={1.8}
                />
                The rental&rsquo;s value, mortgage, cash flow and Schedule E —
                read out of the statements that already arrive by email.
              </li>
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
