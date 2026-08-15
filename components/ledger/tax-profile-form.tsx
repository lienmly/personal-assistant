"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";

import type { TaxProfileView } from "@/lib/tax";
import { FILING_STATUSES, FILING_STATUS_LABEL } from "@/lib/tax/rules";
import { saveTaxProfile } from "@/lib/tax-actions";
import { cn } from "@/lib/utils";

/**
 * The answers no bank can supply.
 *
 * Everything else on this surface fills itself in; this is the second and last
 * form in the Ledger, after the property address. It is the honest boundary of
 * "automate everything" — a W-2 figure, a filing status and how much has been
 * withheld are claims only a person can make.
 *
 * **Blank and zero are different answers here**, and the form says so rather
 * than defaulting: a blank income field means "work it out from the accounts if
 * you can", a zero means "there genuinely is none". Collapsing them is how a
 * missing 1099 silently becomes a $0 line, and the estimate looks finished.
 */

const fieldBase =
  "rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";
const field = `w-full ${fieldBase}`;
const labelClass = "mb-1.5 block text-[12.5px] text-muted";

export function TaxProfileButton({
  taxYear,
  profile,
}: {
  taxYear: number;
  profile: TaxProfileView | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-chip px-4 py-2 text-[13px] font-medium transition-[background-color,transform] duration-(--duration-base) ease-soft active:scale-[0.97]",
          profile
            ? "bg-inset text-ink hover:bg-line/60"
            : "bg-accent text-white hover:bg-accent-hover",
        )}
      >
        <Pencil className="size-3.5" strokeWidth={2} />
        {profile ? "Your answers" : "Answer a few things"}
      </button>
      {open && (
        <ProfilePanel
          taxYear={taxYear}
          profile={profile}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ProfilePanel({
  taxYear,
  profile,
  onClose,
}: {
  taxYear: number;
  profile: TaxProfileView | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dismiss = () => setClosing(true);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await saveTaxProfile(form);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
      dismiss();
    });
  };

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-scrim",
          closing ? "animate-scrim-out" : "animate-scrim-in",
        )}
        onClick={dismiss}
        aria-hidden
      />
      <div
        role="dialog"
        aria-label="Tax answers"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-card shadow-float sm:max-w-md",
          closing ? "animate-panel-out" : "animate-panel-in",
        )}
        onAnimationEnd={(event) => {
          if (event.target !== event.currentTarget) return;
          if (closing) onClose();
        }}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              Your answers, {taxYear}
            </h2>
            {profile && (
              <p className="mt-0.5 text-xs text-faint">
                Last changed {profile.updatedLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="rounded-chip p-1.5 text-faint transition-colors duration-(--duration-quick) hover:text-ink active:scale-[0.97]"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <form
          onSubmit={submit}
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            pending && "pointer-events-none opacity-45",
          )}
        >
          <input type="hidden" name="taxYear" value={taxYear} />

          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <p className="mb-4 text-[12.5px] leading-relaxed text-muted">
              Leave a box empty if you do not know it yet — empty and zero mean
              different things here, and an empty one is never treated as none.
            </p>

            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <div className="min-w-0 flex-1">
                  <label className={labelClass} htmlFor="filingStatus">
                    Filing as
                  </label>
                  <select
                    id="filingStatus"
                    name="filingStatus"
                    defaultValue={profile?.filingStatus ?? "single"}
                    className={field}
                  >
                    {FILING_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {FILING_STATUS_LABEL[status]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className={labelClass} htmlFor="dependents">
                    Dependents
                  </label>
                  <input
                    id="dependents"
                    name="dependents"
                    className={field}
                    defaultValue={profile?.dependents ?? 0}
                    inputMode="numeric"
                  />
                </div>
              </div>

              <Group title="Salary and withholding">
                <Money name="w2Wages" label="Your salary" />
                <Money name="spouseW2Wages" label="Spouse's salary" />
                <Money name="federalWithheld" label="Federal withheld" />
                <Money name="stateWithheld" label="State withheld" />
                <Money name="estimatedPaid" label="Estimated payments made" />
              </Group>

              <p className="-mb-2 text-xs leading-relaxed text-faint">
                Washington has no income tax, so the state line on Schedule A is
                <strong className="font-medium"> sales tax</strong> rather than
                income tax — leaving it blank understates the deduction.
              </p>

              <Group title="Other income">
                <Money name="selfEmploymentNet" label="Self-employment profit" />
                <Money name="interestIncome" label="Interest" />
                <Money name="ordinaryDividends" label="Dividends" />
                <Money name="qualifiedDividends" label="of which qualified" />
                <Money name="shortTermGain" label="Short-term gains" />
                <Money name="longTermGain" label="Long-term gains" />
                <Money name="realEstateGain" label="of which from real estate" />
              </Group>

              <p className="-mb-2 text-xs leading-relaxed text-faint">
                Washington taxes long-term gains at 7% above a threshold, but
                <strong className="font-medium"> exempts real estate</strong> —
                so a gain from selling the rental has to be told apart from a
                stock sale.
              </p>

              <Group title="What comes off">
                <Money name="hsaContribution" label="HSA contributions" />
                <Money name="traditionalRetirement" label="Traditional retirement" />
                <Money name="studentLoanInterest" label="Student loan interest" />
                <Money name="charitable" label="Charitable giving" />
                <Money name="primaryMortgageInterest" label="Home mortgage interest" />
                <Money name="primaryPropertyTax" label="Home property tax" />
                <Money name="stateIncomeTaxPaid" label="State income tax paid" />
                <Money name="salesTaxPaid" label="Sales tax paid" />
              </Group>

              <Group title="Last year, for the safe harbour">
                <Money name="priorYearTax" label="Last year's total tax" />
                <Money name="priorYearAgi" label="Last year's AGI" />
              </Group>

              <div>
                <label className={labelClass} htmlFor="reSafeHarbourHours">
                  Hours on the rentals this year
                </label>
                <input
                  id="reSafeHarbourHours"
                  name="reSafeHarbourHours"
                  className={field}
                  inputMode="numeric"
                  placeholder="250"
                />
                <p className="mt-1.5 text-xs leading-relaxed text-faint">
                  250 hours is one of three conditions for the §199A rental safe
                  harbour. The others — separate books, and records kept at the
                  time — are yours to confirm, and the app never assumes them.
                </p>
              </div>

              <label className="flex items-start gap-2.5 text-[13px] text-ink">
                <input
                  type="checkbox"
                  name="realEstateProfessional"
                  defaultChecked={false}
                  className="mt-0.5 size-4 accent-[var(--color-accent)]"
                />
                <span>
                  I qualify as a real-estate professional
                  <span className="block text-xs leading-relaxed text-faint">
                    A high bar — more than half your working time and over 750
                    hours in real property trades. It changes whether rental
                    income counts as investment income.
                  </span>
                </span>
              </label>

              {error && <p className="text-[13px] text-bad">{error}</p>}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-0 border-t border-line px-5 py-4">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-chip px-3.5 py-2 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-tile bg-inset p-3.5">
      <legend className="px-1 text-[12.5px] font-medium text-muted">
        {title}
      </legend>
      <div className="flex flex-col gap-2.5">{children}</div>
    </fieldset>
  );
}

function Money({ name, label }: { name: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <label className="min-w-0 flex-1 text-[12.5px] text-ink" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={`${fieldBase} w-32 bg-card text-right`}
        inputMode="decimal"
        placeholder="—"
      />
    </div>
  );
}
