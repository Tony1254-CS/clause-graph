import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/clausegraph/AppShell";
import { BacktestCard } from "@/components/clausegraph/BacktestCard";
import { backtestCasesQuery } from "@/data/queries";
import { RouteError } from "@/components/clausegraph/RouteError";

export const Route = createFileRoute("/_authenticated/backtest")({
  head: () => ({
    meta: [
      { title: "Backtested Validation — ClauseGraph" },
      {
        name: "description",
        content:
          "Reconstructed contract scenarios from real enforcement cases, analyzed live to validate the ClauseGraph pipeline against known outcomes.",
      },
      { property: "og:title", content: "Backtested Validation — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Reconstructed contract scenarios from real enforcement cases, analyzed live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(backtestCasesQuery),
  component: BacktestPage,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Backtest library unavailable" error={error} reset={reset} />
  ),
});

function BacktestPage() {
  const { data: cases } = useSuspenseQuery(backtestCasesQuery);

  const totalFines = cases.reduce((acc, c) => acc + (Number(c.fine_usd) || 0), 0);

  return (
    <AppShell>
      <div className="w-full max-w-[1400px] mx-auto space-y-8 pb-16">
        {/* ── Top Header & Context Banner ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Empirical Validation · Real-World Regulatory Case Studies
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Real Enforcement, Reconstructed Live
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Landmark enforcement actions stress-tested against the live ClauseGraph impact engine. 
              The clauses are synthetic reconstructions; the statutory penalties and regulatory citations are 100% real.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] text-muted-foreground">
              Historical Penalties: <strong className="text-[var(--risk)] font-semibold">${(totalFines / 1_000_000_000).toFixed(2)}B USD</strong>
            </span>
            <span className="rounded-full border border-[var(--brass)]/30 bg-[var(--brass)]/10 px-3.5 py-1.5 font-mono text-[11px] font-semibold text-[var(--brass)]">
              Active Case Studies: {cases.length}
            </span>
          </div>
        </div>

        {/* ── Landmark Cases Grid ── */}
        <div className="grid gap-6 md:grid-cols-2 items-start">
          {cases.map((bt, i) => (
            <div key={bt.id} className="stagger-item" style={{ ["--i" as string]: i }}>
              <BacktestCard bt={bt} />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
