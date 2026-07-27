export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-950 px-6 text-center text-zinc-50">
      <main className="flex w-full max-w-xl flex-col items-center gap-8">
        <span
          className="text-6xl"
          role="img"
          aria-label="moogle"
        >
          🐭
        </span>

        <div className="flex flex-col items-center gap-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Clan Centurio
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-400">
            Your personal command center — organizing every mark in your life,
            with <span className="font-medium text-zinc-200">Montblanc</span> at
            its heart.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-1.5 text-sm text-zinc-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Phase 0 — foundation online, kupo!
        </div>
      </main>
    </div>
  );
}
