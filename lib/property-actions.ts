"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/ledger-jobs";
import {
  parseBasisPoints,
  parseDateOnly,
  parseDomain,
  parseMoneyField,
  propertyDeleteBlocker,
} from "@/lib/property-rules";
import { slugify } from "@/lib/utils";

/**
 * Everything the Property tab writes.
 *
 * Same two conventions as `lib/ledger-actions.ts`: every action re-checks the
 * session because a server action is its own public endpoint, and **a refusal is
 * a returned value while a bug throws** — React redacts thrown messages in
 * production, so "that property still has statements" has to come back as data.
 */

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Not signed in");
  return session;
}

function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Every field parser lives in `lib/property-rules.ts` — client-safe, so the
 *  form and this action refuse the same input in the same words, and testable
 *  without a request scope, which a `"use server"` module is not. */
function cents(form: FormData, key: string): number | null {
  return parseMoneyField(str(form, key));
}

const dateOnly = parseDateOnly;

function basisPoints(form: FormData, key: string): number | null {
  return parseBasisPoints(str(form, key));
}

export type PropertyResult =
  | { ok: true; slug: string }
  | { ok: false; message: string };

function refresh() {
  revalidatePath("/ledger");
  // The companion project appears in the sidebar tree, which lives in the app
  // layout — the same reason `lib/project-actions.ts` revalidates the layout
  // rather than a list of pages.
  revalidatePath("/", "layout");
}

/**
 * Create or update a property.
 *
 * **Creating one mints a companion Project** in the Home & Money area, and that
 * is the decision worth arguing. A property has tasks (chase the plumber), docs
 * (the lease, the CPA's notes) and a journal (what the tenant reported in
 * March) — and all three of those already exist in this app, already work, and
 * already have a page at `/projects/[slug]`. Inventing property-tasks and
 * property-docs would be the parallel system `AreaDoc` was refused for. So the
 * Project holds the work and this model holds the money.
 *
 * Two rules inherited from `saveProject`:
 *
 * - **The slug is minted once and never follows a rename.** Name is the label,
 *   slug is the identity, and a slug that tracked the name would break every
 *   link to the property the moment you tidied its name.
 * - **An update never re-owns the row.** `areaId` and the project link are read
 *   on create only, so a stray field posted alongside an `id` is inert.
 */
export async function saveProperty(form: FormData): Promise<PropertyResult> {
  await requireSession();

  const id = str(form, "id");
  const label = str(form, "label");
  const addressLine = str(form, "addressLine");
  const city = str(form, "city");
  const state = str(form, "state");
  const postalCode = str(form, "postalCode");

  if (!label) return { ok: false, message: "A property needs a name." };
  if (!addressLine || !city || !state || !postalCode) {
    return {
      ok: false,
      message: "The full address is needed — the valuation is looked up from it.",
    };
  }

  const purchasePriceCents = cents(form, "purchasePrice");
  const purchasedOn = dateOnly(str(form, "purchasedOn"));

  if (!id) {
    if (purchasePriceCents === null || purchasePriceCents <= 0) {
      return { ok: false, message: "What did it cost? This is the start of the tax basis." };
    }
    if (!purchasedOn) {
      return { ok: false, message: "When did you buy it?" };
    }
  }

  const shared = {
    label,
    addressLine,
    city,
    state: state.toUpperCase(),
    postalCode,
    closingCostsCents: cents(form, "closingCosts") ?? 0,
    landAllocationBasisPoints: basisPoints(form, "landAllocation"),
    landAllocationSource: str(form, "landAllocationSource"),
    placedInServiceOn: dateOnly(str(form, "placedInServiceOn")),
    managerName: str(form, "managerName"),
    managerDomain: parseDomain(str(form, "managerDomain")),
    activeParticipation: form.get("activeParticipation") === "on",
    notes: str(form, "notes"),
    ...(purchasePriceCents !== null ? { purchasePriceCents } : {}),
    ...(purchasedOn ? { purchasedOn } : {}),
  };

  if (id) {
    const updated = await db.property.update({
      where: { id },
      data: shared,
      select: { slug: true },
    });
    refresh();
    return { ok: true, slug: updated.slug };
  }

  const slug = await mintSlug(label);

  const area = await db.area.findUnique({
    where: { slug: "home" },
    select: { id: true },
  });

  const project = await db.project.create({
    data: {
      slug: await mintProjectSlug(label),
      name: label,
      description: `${addressLine}, ${city}`,
      // Filed where every other project is filed, so it appears in the sidebar
      // tree. Without an area there is nowhere to put it — `Project.areaId` is
      // required — so a missing Home & Money area is a genuine fault.
      areaId: area?.id ?? (await db.area.findFirstOrThrow({ orderBy: { sortOrder: "asc" }, select: { id: true } })).id,
      priority: "side",
      // A rental is not a thing you push forward on a cadence; it is a thing you
      // respond to. A drift warning on it would fire every fortnight and mean
      // nothing, which is exactly what got the Multilingual Baby project deleted.
      cadenceDays: null,
    },
    select: { id: true },
  });

  await db.property.create({
    data: {
      ...shared,
      slug,
      purchasePriceCents: purchasePriceCents ?? 0,
      purchasedOn: purchasedOn ?? new Date(),
      areaId: area?.id ?? null,
      projectId: project.id,
    },
    select: { id: true },
  });

  refresh();
  return { ok: true, slug };
}

async function mintSlug(label: string): Promise<string> {
  const base = slugify(label) || "property";
  const taken = new Set(
    (
      await db.property.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      })
    ).map((row) => row.slug),
  );

  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    if (!taken.has(`${base}-${suffix}`)) return `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}

async function mintProjectSlug(label: string): Promise<string> {
  const base = slugify(label) || "property";
  const taken = new Set(
    (
      await db.project.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      })
    ).map((row) => row.slug),
  );

  if (!taken.has(base)) return base;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    if (!taken.has(`${base}-${suffix}`)) return `${base}-${suffix}`;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Attach a mortgage account to a property.
 *
 * The button a human presses after reading the suggestion — see
 * `getLoanCandidates`, which orders candidates by how well the servicer's
 * address matches and deliberately stops there.
 */
export async function linkPropertyLoan(
  propertyId: string,
  accountId: string,
  label?: string,
): Promise<PropertyResult> {
  await requireSession();

  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { id: true, name: true, propertyLoan: { select: { id: true } } },
  });
  if (!account) return { ok: false, message: "That account is gone." };
  if (account.propertyLoan) {
    return { ok: false, message: "That loan is already attached to a property." };
  }

  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { slug: true, _count: { select: { loans: true } } },
  });
  if (!property) return { ok: false, message: "That property is gone." };

  await db.propertyLoan.create({
    data: {
      propertyId,
      accountId,
      label: label?.trim() || account.name,
      sortOrder: property._count.loans,
    },
    select: { id: true },
  });

  refresh();
  return { ok: true, slug: property.slug };
}

export async function unlinkPropertyLoan(loanId: string): Promise<PropertyResult> {
  await requireSession();

  const loan = await db.propertyLoan.findUnique({
    where: { id: loanId },
    select: { property: { select: { slug: true } } },
  });
  if (!loan) return { ok: false, message: "That loan is already gone." };

  await db.propertyLoan.delete({ where: { id: loanId } });
  refresh();
  return { ok: true, slug: loan.property.slug };
}

/** Record who is in it and for how much — the cross-check that says a month's
 *  rent did not arrive, and half of the "are you under-renting" answer. */
export async function saveLease(form: FormData): Promise<PropertyResult> {
  await requireSession();

  const propertyId = str(form, "propertyId");
  const monthlyRentCents = cents(form, "monthlyRent");
  const startsOn = dateOnly(str(form, "startsOn"));

  if (!propertyId) return { ok: false, message: "Which property?" };
  if (monthlyRentCents === null || monthlyRentCents <= 0) {
    return { ok: false, message: "What is the rent?" };
  }
  if (!startsOn) return { ok: false, message: "When does the lease start?" };

  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: { slug: true },
  });
  if (!property) return { ok: false, message: "That property is gone." };

  const id = str(form, "id");
  const data = {
    propertyId,
    tenantName: str(form, "tenantName"),
    monthlyRentCents,
    depositCents: cents(form, "deposit"),
    startsOn,
    endsOn: dateOnly(str(form, "endsOn")),
    notes: str(form, "notes"),
  };

  if (id) {
    await db.lease.update({ where: { id }, data, select: { id: true } });
  } else {
    await db.lease.create({ data, select: { id: true } });
  }

  refresh();
  return { ok: true, slug: property.slug };
}

/**
 * Claim a transaction for a property, or release it.
 *
 * This is what turns a bank row into a Schedule E line in Layer 5, and it is
 * deliberately a **manual** act. Inferring it — everything on the account the
 * mortgage is paid from, say — would file the weekly shop under the rental, and
 * a Schedule E is not a place to discover an inference was wrong.
 */
export async function claimTransaction(
  transactionId: string,
  propertyId: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireSession();

  await db.transaction.update({
    where: { id: transactionId },
    data: { propertyId },
    select: { id: true },
  });

  refresh();
  return { ok: true };
}

/** Queue a valuation refresh now rather than waiting for the four-week check. */
export async function refreshValuation(
  propertyId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireSession();
  await enqueue("rentcast_refresh", propertyId);
  refresh();
  return { ok: true };
}

/**
 * Delete a property.
 *
 * **Refused while anything is hanging off it**, and the message names what —
 * `deleteProject`'s rule, for the same reason. Every relation pointing at a
 * Property is either `SetNull` (transactions, which must survive) or `Cascade`
 * (valuations, loans, leases, and in Layer 4 the statements). Cascade is right
 * for one row and disastrous in bulk: deleting a property would silently destroy
 * the statement PDFs its tax figures were computed from. Delete is for the one
 * you typed wrong two minutes ago.
 */
export async function deleteProperty(
  propertyId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  await requireSession();

  const property = await db.property.findUnique({
    where: { id: propertyId },
    select: {
      projectId: true,
      _count: { select: { valuations: true, leases: true, transactions: true } },
    },
  });
  if (!property) return { ok: false, message: "That property is already gone." };

  const blocker = propertyDeleteBlocker({
    transactions: property._count.transactions,
    leases: property._count.leases,
    valuations: property._count.valuations,
  });
  if (blocker) return { ok: false, message: blocker };

  await db.property.delete({ where: { id: propertyId } });

  // The companion project is left alone on purpose. It may hold tasks, docs or a
  // journal by now, and those are work somebody did — cascading into them from a
  // property delete is exactly what `deleteProject`'s own guard exists to stop.
  refresh();
  return { ok: true };
}
