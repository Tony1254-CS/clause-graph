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
        content: "Reconstructed contract scenarios from real enforcement cases, analyzed live.",
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
  return (
    <AppShell>
      <div className="w-full max-w-[1280px] mx-auto flex flex-col gap-8">
        <header className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
            Backtested Validation
          </p>
          <h1 className="mt-2 font-display text-[34px] leading-[1.05] tracking-tight text-foreground">
            Real enforcement, reconstructed live
          </h1>
          <p className="mt-3 text-[14px] leading-[1.6] text-muted-foreground">
            Three landmark enforcement actions. For each, ClauseGraph runs a reconstructed contract
            scenario through the same live pipeline as Simulate Impact — so the analysis you see was
            produced now, not curated in advance. Clauses are synthetic; the fines are real.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3 items-start">
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
