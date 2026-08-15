import Link from "next/link";
import { ArrowLeft, KeyRound, Landmark } from "lucide-react";

import { ConnectionsList } from "@/components/ledger/connections-list";
import { JobLog } from "@/components/ledger/job-log";
import { JobsKick } from "@/components/ledger/jobs-kick";
import { LinkBankButton } from "@/components/ledger/link-bank-button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceHeader } from "@/components/ui/surface-header";
import { getJobs, getLedgerStatus } from "@/lib/ledger";
import { plaidEnv } from "@/lib/plaid";

export const dynamic = "force-dynamic";

export const metadata = { title: "Connections · Clan Centurio" };

/**
 * The Ledger's admin screen.
 *
 * The same relationship `/studio/channels` has to `/studio`, and for the same
 * reason: this is where the plumbing is configured, and it is not something you
 * look at daily — so it is a sub-page reached from a link, never a tab
 * competing with the four questions the surface actually answers.
 */
export default async function LedgerConnectionsPage() {
  const status = await getLedgerStatus();
  const jobs = status.setupProblem ? [] : await getJobs();
  const env = plaidEnv();

  return (
    <>
      <JobsKick />

      <Link
        href="/ledger"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-(--duration-quick) hover:text-ink"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} />
        Ledger
      </Link>

      <SurfaceHeader
        title="Connections"
        tagline="Where the numbers come from, and whether they are still arriving"
        meta={env === "sandbox" ? "Plaid sandbox" : undefined}
      />

      {status.setupProblem ? (
        <Card>
          <EmptyState
            icon={KeyRound}
            title="Not configured yet"
            body={`${status.setupProblem} Set it in .env.local and in Railway, then reload.`}
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              title="Banks"
              count={`${status.items.length}`}
              hint={
                status.attention.length > 0
                  ? `${status.attention.length} need attention`
                  : undefined
              }
            />

            {status.items.length === 0 ? (
              <>
                <EmptyState
                  icon={Landmark}
                  title="Nothing connected"
                  body="Linking a bank is the only manual step here. After that, balances, transactions, holdings and loan balances all arrive on their own."
                />
                <div className="mt-4 flex justify-center">
                  <LinkBankButton />
                </div>
              </>
            ) : (
              <ConnectionsList items={status.items} />
            )}
          </Card>

          <Card>
            <CardHeader title="Recent activity" hint="Newest, failures first" />
            <JobLog jobs={jobs} />
          </Card>

          {/* Stated plainly rather than buried in a doc, because it is the one
              thing about this surface a person should know without going
              looking. §9 keeps the full version in `docs/ledger.md`. */}
          <Card>
            <CardHeader title="What is stored" />
            <ul className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
              <li>
                Bank credentials are never here. Plaid holds them; this app holds
                an access token, encrypted, that can read balances and
                transactions and nothing else.
              </li>
              <li>
                That token is sealed with AES-256-GCM before it touches the
                database, and exactly one module in the codebase can read it.
                What that protects against is a database dump — not someone with
                access to the server, which necessarily holds the key.
              </li>
              <li>
                Disconnecting a bank ends the grant at Plaid first, then removes
                the connection. The accounts and their history stay; they simply
                stop updating.
              </li>
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
