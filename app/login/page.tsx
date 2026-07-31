import type { Metadata } from "next";

import { MoogleMark } from "@/components/brand/moogle-mark";
import { signInWithGoogle } from "@/lib/actions";

export const metadata: Metadata = {
  title: "Sign in · Clan Centurio",
};

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.82-.07-1.6-.21-2.36H12v4.47h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.73Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.28a12 12 0 0 0 0 10.74l4-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.63l4 3.09C6.22 6.87 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from, error } = await searchParams;

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas p-4">
      <div className="w-full max-w-sm rounded-[2rem] bg-card p-8 shadow-float">
        <span className="grid size-12 place-items-center rounded-full bg-obsidian text-white">
          <MoogleMark className="size-7" />
        </span>

        <h1 className="mt-6 text-[26px] font-semibold leading-tight tracking-tight text-ink">
          Clan Centurio
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          A private command center. Montblanc is expecting you, kupo.
        </p>

        {error && (
          <p className="mt-5 rounded-tile bg-accent-soft px-4 py-3 text-[13px] leading-relaxed text-accent">
            {error === "AccessDenied"
              ? "That account isn't on the clan roster. Only allowlisted addresses can enter."
              : "Something went wrong signing in. Give it another go."}
          </p>
        )}

        <form action={signInWithGoogle} className="mt-7">
          <input type="hidden" name="from" value={from ?? ""} />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-full bg-obsidian px-5 py-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <GoogleGlyph />
            Continue with Google
          </button>
        </form>

        <p className="mt-6 text-xs leading-relaxed text-faint">
          Access is restricted to a fixed allowlist. If you&rsquo;ve landed here
          by accident, there&rsquo;s nothing for you inside.
        </p>
      </div>
    </main>
  );
}
