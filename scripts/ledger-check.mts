/**
 * Golden cases for the Ledger's pure functions.
 *
 *   npx tsx scripts/ledger-check.mts
 *
 * **No test framework**, following `scripts/generate-icons.mjs`: this repo has
 * six runtime dependencies and no runner, and adding one for a file of
 * assertions is the trade §8 keeps refusing. `node --test` is built in if this
 * ever grows enough to want structure.
 *
 * What is in here is deliberately narrow — the functions where being wrong is
 * both easy and silent. Money conversion is the whole foundation: every balance,
 * every transaction and eventually every tax figure passes through
 * `centsFromDollars`, and the failure mode of getting it wrong is not a crash
 * but a number that is quietly a cent out and reconciles against nothing.
 *
 * `lib/tax/…` joins this file in Layer 6, where the same argument applies with
 * more zeroes on it.
 */

import {
  applyRate,
  centsFromDollars,
  centsFromText,
  compactMoneyLabel,
  moneyLabel,
  moneyParts,
  signedMoneyLabel,
} from "../lib/money";
import {
  kindFromPlaid,
  netWorthGroupFor,
  netWorthSideFor,
} from "../lib/ledger-rules";

let failed = 0;
let passed = 0;

function eq(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failed += 1;
    console.log(`  FAIL  ${label}\n        got  ${a}\n        want ${e}`);
  } else {
    passed += 1;
  }
}

function section(name: string): void {
  console.log(`\n${name}`);
}

section("centsFromDollars — the binary-float trap");
eq("12.34", centsFromDollars(12.34), 1234);
// The one that matters: 1.005 is really 1.00499999999999989, so the naive
// Math.round(v * 100) rounds a half-cent DOWN. Silently, on ~1 value in 200.
eq("1.005 rounds up, not down", centsFromDollars(1.005), 101);
eq("12.345", centsFromDollars(12.345), 1235);
eq("0.1 + 0.2", centsFromDollars(0.1 + 0.2), 30);
eq("-5.55", centsFromDollars(-5.55), -555);
eq("985000 (a house)", centsFromDollars(985000), 98500000);
eq("0", centsFromDollars(0), 0);

section("centsFromText — what an owner statement actually contains");
eq('"$1,250.00"', centsFromText("$1,250.00"), 125000);
eq('"(1,250.00)" is negative', centsFromText("(1,250.00)"), -125000);
eq('"1,250.00CR" is money in', centsFromText("1,250.00CR"), 125000);
eq('"1,250.00 DR" is money out', centsFromText("1,250.00 DR"), -125000);
eq('"-45.50"', centsFromText("-45.50"), -4550);
eq('"1250" with no decimal', centsFromText("1250"), 125000);
// Zero and unparseable must not collapse into each other — the extractor has to
// be able to tell "the statement says nothing" from "the statement says none".
eq('"0.00" is zero', centsFromText("0.00"), 0);
eq('"" is null', centsFromText(""), null);
eq('"n/a" is null', centsFromText("n/a"), null);
eq("null is null", centsFromText(null), null);
eq('"." is null', centsFromText("."), null);

section("labels");
eq("moneyLabel", moneyLabel(125000), "$1,250.00");
eq("moneyLabel negative", moneyLabel(-4550), "-$45.50");
eq("signed +", signedMoneyLabel(314000), "+$3,140.00");
eq("signed −", signedMoneyLabel(-4550), "−$45.50");
eq("signed zero has no sign", signedMoneyLabel(0), "$0.00");
eq("moneyParts", moneyParts(41280642), { value: "$412,806", tail: ".42" });
eq("moneyParts negative", moneyParts(-4500), { value: "−$45", tail: ".00" });
eq("moneyParts pads", moneyParts(41280602), { value: "$412,806", tail: ".02" });
eq("compact k", compactMoneyLabel(41280642), "$412.8k");
eq("compact M", compactMoneyLabel(120000000), "$1.2M");

section("applyRate — the one place a rate meets money");
eq("92.35% of $100 (SE earnings factor)", applyRate(10000, 0.9235), 9235);
eq("3.8% of $1,000 (NIIT)", applyRate(100000, 0.038), 3800);
// Math.round(-0.5) is -0, so an unguarded version rounds a loss a cent shy of
// the equivalent gain. Half-away-from-zero in both directions.
eq("half away from zero (+)", applyRate(100, 0.005), 1);
eq("half away from zero (−)", applyRate(-100, 0.005), -1);

section("kindFromPlaid");
eq("depository/checking", kindFromPlaid("depository", "checking"), "checking");
eq("depository/savings", kindFromPlaid("depository", "savings"), "savings");
eq("depository/cd", kindFromPlaid("depository", "cd"), "savings");
eq("unknown subtype falls back on type", kindFromPlaid("depository", "zzz"), "checking");
eq("credit/credit card", kindFromPlaid("credit", "credit card"), "credit_card");
eq("loan/mortgage", kindFromPlaid("loan", "mortgage"), "mortgage");
eq("loan/home equity", kindFromPlaid("loan", "home equity"), "mortgage");
eq("loan/student", kindFromPlaid("loan", "student"), "loan");
eq("investment/401k", kindFromPlaid("investment", "401k"), "retirement");
eq("investment/ira", kindFromPlaid("investment", "ira"), "retirement");
eq("investment/529", kindFromPlaid("investment", "529"), "retirement");
// An HSA arrives as depository at a bank and investment at a brokerage. Both
// must land in retirement — `liquid` is labelled "spendable this afternoon",
// and an HSA is spendable on medical expenses or on anything else at a 20%
// penalty. Caught by running against Plaid's sandbox, which returns both.
eq("depository/hsa is not liquid", kindFromPlaid("depository", "hsa"), "retirement");
eq("investment/hsa agrees", kindFromPlaid("investment", "hsa"), "retirement");
eq("investment/brokerage", kindFromPlaid("investment", "brokerage"), "brokerage");
eq("legacy brokerage type", kindFromPlaid("brokerage", null), "brokerage");
eq("unknown type is other", kindFromPlaid("wormhole", "x"), "other");
eq("case insensitive", kindFromPlaid("DEPOSITORY", "Savings"), "savings");

section("net worth sides and groups");
eq("mortgage is owed", netWorthSideFor("mortgage"), "liability");
eq("credit card is owed", netWorthSideFor("credit_card"), "liability");
eq("checking is an asset", netWorthSideFor("checking"), "asset");
eq("other is an asset", netWorthSideFor("other"), "asset");
// Overstating spendable cash is the dangerous direction of error, so Plaid's
// unclassifiable bucket is deliberately NOT liquid.
eq("other is not liquid", netWorthGroupFor("other"), "invested");
eq("retirement", netWorthGroupFor("retirement"), "retirement");
eq("mortgage", netWorthGroupFor("mortgage"), "owed");

console.log(
  failed === 0
    ? `\n${passed} passed.\n`
    : `\n${passed} passed, ${failed} FAILED.\n`,
);
process.exit(failed === 0 ? 0 : 1);
