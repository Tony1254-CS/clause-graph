import { createFileRoute, Link, Outlet, useMatches, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radar } from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import {
  predictAmendmentRisk,
  type ForecastEntry,
  type ProbabilityBand,
} from "@/lib/predict.functions";
import { Button } from "@/components/ui/button";

export const forecastsQuery = () =>
  queryOptions({
    queryKey: ["forecasts"],
    queryFn: () => predictAmendmentRiskFetcher(),
    staleTime: 60_000,
  });

// Function reference indirection so useServerFn is only needed at call site.
let cachedFetcher: (() => Promise<ForecastEntry[]>) | null = null;
async function predictAmendmentRiskFetcher(): Promise<ForecastEntry[]> {
  if (!cachedFetcher) {
    cachedFetcher = () => predictAmendmentRisk();
  }
  return cachedFetcher();
}

export const Route = createFileRoute("/_authenticated/predictive")({
  head: () => ({
    meta: [
      { title: "Predictive Radar — ClauseGraph" },
      {
        name: "description",
        content:
          "Heuristic forecast of which regulations are likely to be amended next, based on public amendment history.",
      },
      { property: "og:title", content: "Predictive Radar — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Which regulations will likely change next — and which contracts they will expose.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(forecastsQuery()),
  component: PredictiveLayout,
  errorComponent: PredictiveError,
  notFoundComponent: PredictiveNotFound,
});

function PredictiveError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <AppShell>
      <div className="glass-panel max-w-lg p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--risk)]">
          Predictive radar unavailable
        </p>
        <h1 className="mt-2 font-display text-[24px] leading-[1.15] tracking-tight text-foreground">
          Forecast data did not load.
        </h1>
        <p className="mt-3 text-[13px] leading-[1.6] text-muted-foreground">{error.message}</p>
        <Button
          className="mt-5"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Retry
        </Button>
      </div>
    </AppShell>
  );
}

function PredictiveNotFound() {
  return (
    <AppShell>
      <div className="glass-panel max-w-md p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Not found
        </p>
        <h1 className="mt-2 font-display text-[22px] leading-[1.15] text-foreground">
          Forecast route unavailable.
        </h1>
      </div>
    </AppShell>
  );
}

const BAND_STYLE: Record<ProbabilityBand, { pill: string; label: string }> = {
  high: {
    pill: "border-brass/60 bg-brass/15 text-brass",
    label: "High",
  },
  medium: {
    pill: "border-brass/30 bg-brass/5 text-brass/90",
    label: "Medium",
  },
  low: {
    pill: "border-[var(--hairline)] text-muted-foreground",
    label: "Low",
  },
};

function PredictiveLayout() {
  const matches = useMatches();
  const onDetail = matches.some((m) => m.routeId.includes("predictive.$regulationId"));
  if (onDetail) return <Outlet />;
  return <RadarDashboard />;
}

function RadarDashboard() {
  const { data: forecasts } = useSuspenseQuery(forecastsQuery());
  return (
    <AppShell>
      <div className="w-full max-w-[1280px] mx-auto">
        <header className="flex flex-wrap items-end justify-between gap-6 mb-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-brass" strokeWidth={1.6} />
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
                Predictive Radar
              </p>
            </div>
            <h1 className="mt-3 font-display text-[34px] leading-[1.1] tracking-tight text-foreground">
              Which regulations move next.
            </h1>
            <p className="mt-3 text-[13.5px] leading-[1.65] text-muted-foreground">
              A heuristic forecast built from each regulation's own public amendment history:
              average interval between amendments, time since the last one, and a small editorial
              signal from active regulatory chatter. Click any card to draft an adversarial what-if
              amendment and run it through the live blast-radius pipeline.
            </p>
            <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground/80">
              Heuristic forecast · Public record only · Not a leak, not a legal prediction
            </p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forecasts.map((f) => (
            <RadarCard key={f.regulation_id} entry={f} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function RadarCard({ entry }: { entry: ForecastEntry }) {
  const style = BAND_STYLE[entry.band];
  const pct = Math.round(entry.probability * 100);
  const lastAmended = entry.last_amended_on
    ? new Date(entry.last_amended_on).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
      })
    : "—";
  return (
    <Link
      to="/predictive/$regulationId"
      params={{ regulationId: entry.regulation_id }}
      className="glass-panel group p-5 flex flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-brass/60 hover:border-[var(--hairline-strong)] duration-200 ease-out transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {entry.jurisdiction}
          </p>
          <h2 className="mt-1 font-display text-[17px] leading-[1.25] tracking-tight text-foreground line-clamp-2">
            {entry.title}
          </h2>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${style.pill}`}
          title={`Base ${(entry.base_probability * 100).toFixed(0)}% + signal ${(entry.boost * 100).toFixed(0)}%`}
        >
          {style.label} · {pct}%
        </span>
      </div>

      <p className="text-[12.5px] leading-[1.55] text-muted-foreground line-clamp-3">
        {entry.summary}
      </p>

      <dl className="mt-auto grid grid-cols-3 gap-3 pt-3 border-t border-[var(--hairline)]">
        <div>
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Last amended
          </dt>
          <dd className="mt-0.5 font-mono text-[12px] text-foreground tabular-nums">
            {lastAmended}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
            History
          </dt>
          <dd className="mt-0.5 font-mono text-[12px] text-foreground tabular-nums">
            {entry.amendment_count}×
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Window
          </dt>
          <dd className="mt-0.5 font-mono text-[12px] text-foreground tabular-nums">
            ≤ {entry.window_months} mo
          </dd>
        </div>
      </dl>

      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass group-hover:translate-x-0.5 duration-150 ease-out transition-transform">
        Simulate forecast →
      </span>
    </Link>
  );
}
