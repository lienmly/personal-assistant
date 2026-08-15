"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

import { saveProperty } from "@/lib/property-actions";
import { cn } from "@/lib/utils";

/**
 * The one place in the Ledger you type anything.
 *
 * The whole surface is built on "automate everything", and an address is the
 * single fact no bank, aggregator or statement can supply — so this form exists,
 * and it is deliberately the *only* one. Everything below the address is
 * optional and says what it unlocks rather than what it is: the point of asking
 * for the land split is not tidiness, it is that Layer 5 refuses to estimate
 * depreciation without it.
 *
 * A side panel rather than an inline form, following `ContentPanel` — including
 * the close-animation rule from §10: hold a `closing` state, run the exit
 * animation, unmount in `onAnimationEnd`, guarded on `event.target ===
 * event.currentTarget` so a child's animation does not fire it early.
 */

const fieldBase =
  "rounded-chip bg-inset px-3 py-2 text-[13px] text-ink outline-none transition-[background-color,box-shadow] duration-(--duration-base) ease-soft placeholder:text-faint hover:bg-line/60 focus:bg-card focus:ring-2 focus:ring-accent/25";
const field = `w-full ${fieldBase}`;
const labelClass = "mb-1.5 block text-[12.5px] text-muted";

export function AddPropertyButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-chip bg-accent px-4 py-2 text-[13px] font-medium text-white transition-[background-color,transform] duration-(--duration-base) ease-soft hover:bg-accent-hover active:scale-[0.97]"
      >
        <Plus className="size-3.5" strokeWidth={2.2} />
        Add a property
      </button>
      {open && <PropertyPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function PropertyPanel({ onClose }: { onClose: () => void }) {
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
      const result = await saveProperty(form);
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
        aria-label="Add a property"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-card shadow-float sm:max-w-md",
          closing ? "animate-panel-out" : "animate-panel-in",
        )}
        onAnimationEnd={(event) => {
          // §10: guarded so a child's animation cannot unmount the panel early.
          if (event.target !== event.currentTarget) return;
          if (closing) onClose();
        }}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">
            Add a property
          </h2>
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
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClass} htmlFor="label">
                  What you call it
                </label>
                <input
                  id="label"
                  name="label"
                  className={field}
                  placeholder="Rental 4B"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className={labelClass} htmlFor="addressLine">
                  Address
                </label>
                <input
                  id="addressLine"
                  name="addressLine"
                  className={field}
                  placeholder="1247 Willow Street"
                  required
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    name="city"
                    className={`${fieldBase} min-w-0 flex-1`}
                    placeholder="City"
                    required
                  />
                  <input
                    name="state"
                    className={`${fieldBase} w-16`}
                    placeholder="WA"
                    maxLength={2}
                    required
                  />
                  <input
                    name="postalCode"
                    className={`${fieldBase} w-24`}
                    placeholder="90042"
                    required
                  />
                </div>
                <p className="mt-1.5 text-xs text-faint">
                  The value and market rent are looked up from this, so it has to
                  be the real one.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="min-w-0 flex-1">
                  <label className={labelClass} htmlFor="purchasePrice">
                    What it cost
                  </label>
                  <input
                    id="purchasePrice"
                    name="purchasePrice"
                    className={field}
                    placeholder="985,000"
                    inputMode="decimal"
                    required
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label className={labelClass} htmlFor="purchasedOn">
                    When
                  </label>
                  <input
                    id="purchasedOn"
                    name="purchasedOn"
                    type="date"
                    className={field}
                    required
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="closingCosts">
                  Closing costs
                </label>
                <input
                  id="closingCosts"
                  name="closingCosts"
                  className={field}
                  placeholder="18,400"
                  inputMode="decimal"
                />
                <p className="mt-1.5 text-xs text-faint">
                  Adds to the tax basis. Usually remembered late, which is why it
                  is its own field.
                </p>
              </div>

              <hr className="border-0 border-t border-line" />

              <p className="text-[12.5px] leading-relaxed text-muted">
                Everything below is optional now and needed before the tax
                numbers mean anything.
              </p>

              <div className="flex flex-wrap gap-2">
                <div className="min-w-0 flex-1">
                  <label className={labelClass} htmlFor="landAllocation">
                    Land, as a %
                  </label>
                  <input
                    id="landAllocation"
                    name="landAllocation"
                    className={field}
                    placeholder="20"
                    inputMode="decimal"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label className={labelClass} htmlFor="placedInServiceOn">
                    First rentable
                  </label>
                  <input
                    id="placedInServiceOn"
                    name="placedInServiceOn"
                    type="date"
                    className={field}
                  />
                </div>
              </div>
              <p className="-mt-2 text-xs text-faint">
                Land does not depreciate, so this split decides the deduction —
                take it from the county assessor&rsquo;s ratio, not from a guess.
                &ldquo;First rentable&rdquo; is <em>not</em> the purchase date.
              </p>

              <div>
                <label className={labelClass} htmlFor="landAllocationSource">
                  Where the split came from
                </label>
                <input
                  id="landAllocationSource"
                  name="landAllocationSource"
                  className={field}
                  placeholder="LA County assessor 2024 — land 197,400 of 986,000"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <div className="min-w-0 flex-1">
                  <label className={labelClass} htmlFor="managerName">
                    Managed by
                  </label>
                  <input
                    id="managerName"
                    name="managerName"
                    className={field}
                    placeholder="Bright Property Co"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <label className={labelClass} htmlFor="managerDomain">
                    Their email domain
                  </label>
                  <input
                    id="managerDomain"
                    name="managerDomain"
                    className={field}
                    placeholder="brightproperty.com"
                  />
                </div>
              </div>
              <p className="-mt-2 text-xs text-faint">
                The domain is how the monthly owner statements get found in your
                email.
              </p>

              <label className="flex items-start gap-2.5 text-[13px] text-ink">
                <input
                  type="checkbox"
                  name="activeParticipation"
                  defaultChecked
                  className="mt-0.5 size-4 accent-[var(--color-accent)]"
                />
                <span>
                  I actively participate
                  <span className="block text-xs text-faint">
                    Approving tenants, setting the rent, authorising repairs.
                    Worth up to $25,000 of losses against ordinary income — and a
                    claim only you can make.
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
              {pending ? "Adding…" : "Add property"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
