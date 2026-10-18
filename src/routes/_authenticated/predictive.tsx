import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useMatches, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radar } from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { predictAmendmentRisk, type ForecastEntry, type ProbabilityBand } from "@/lib/predict.functions";
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
  const onDetail = matches.some(
    (m) =>
      m.routeId.includes("$regulationId") ||
      m.pathname.startsWith("/predictive/") ||
      m.routeId === "/_authenticated/predictive/$regulationId"
  );
  if (onDetail) return <Outlet />;
  return <RadarDashboard />;
}

function RadarDashboard() {
  const { data: forecasts } = useSuspenseQuery(forecastsQuery());
  const [filterBand, setFilterBand] = useState<"all" | ProbabilityBand>("all");

  const highRiskCount = useMemo(
    () => forecasts.filter((f) => f.band === "high").length,
    [forecasts]
  );
  const avgWindow = useMemo(() => {
    if (!forecasts.length) return 0;
    const sum = forecasts.reduce((acc, f) => acc + f.window_months, 0);
    return Math.round(sum / forecasts.length);
  }, [forecasts]);

  const filteredForecasts = useMemo(() => {
    if (filterBand === "all") return forecasts;
    return forecasts.filter((f) => f.band === filterBand);
  }, [forecasts, filterBand]);

  return (
    <AppShell>
      <div className="w-full max-w-[1400px] mx-auto space-y-8">
        {/* Top Header & Context Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Predictive Intelligence &middot; Amendment Horizon
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Predictive Regulatory Radar
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Heuristic probability modeling built from statutory cadence, historical amendment intervals,
              and active public consultation chatter.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] px-4 py-2 backdrop-blur-md">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Monitored</span>
              <span className="font-mono text-sm font-semibold text-foreground">{forecasts.length} Frameworks</span>
            </div>
            <div className="rounded-xl border border-[var(--risk)]/25 bg-[var(--risk)]/10 px-4 py-2 backdrop-blur-md">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-[var(--risk)]">High Horizon</span>
              <span className="font-mono text-sm font-semibold text-[var(--risk)]">{highRiskCount} Imminent</span>
            </div>
          </div>
        </div>

        {/* ── Executive Predictive KPI Summary Strip ──────────────────────── */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* KPI 1 */}
          <div className="group relative overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-[color-mix(in_oklab,var(--risk)_45%,transparent)] hover:shadow-[0_20px_50px_-18px_rgba(225,82,75,0.18)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--risk)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Imminent Amendment Risk
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--risk)]">
                <Radar className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 font-mono text-[28px] font-bold tracking-tight text-[var(--risk)]">
              {highRiskCount}{" "}
              <span className="text-[14px] font-normal text-muted-foreground">regulations</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk)] shadow-[0_0_8px_var(--risk)] animate-pulse" />
              High probability of revisions within window
            </div>
          </div>

          {/* KPI 2 */}
          <div className="group relative overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-[color-mix(in_oklab,var(--brass)_45%,transparent)] hover:shadow-[0_20px_50px_-18px_rgba(94,234,212,0.18)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Average Forecast Horizon
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--brass)]">
                <span className="font-mono text-xs font-bold">&le; mo</span>
              </div>
            </div>
            <div className="mt-3 font-mono text-[28px] font-bold tracking-tight text-foreground">
              ~{avgWindow}{" "}
              <span className="text-[14px] font-normal text-muted-foreground">months</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              Statutory cycle between historical updates
            </div>
          </div>

          {/* KPI 3 */}
          <div className="group relative overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-[color-mix(in_oklab,var(--brass)_45%,transparent)] hover:shadow-[0_20px_50px_-18px_rgba(94,234,212,0.18)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Public Signal Feed
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--brass)]">
                <span className="flex h-2 w-2 rounded-full bg-[var(--brass)] animate-ping" />
              </div>
            </div>
            <div className="mt-3 font-mono text-[28px] font-bold tracking-tight text-foreground">
              Active{" "}
              <span className="text-[14px] font-normal text-muted-foreground">indices</span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              Public record cadence &middot; Zero non-public leaks
            </div>
          </div>
        </section>

        {/* ── Filter Controls Bar ─────────────────────────────────────────── */}
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-2.5 backdrop-blur-xl shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground px-2">
              Filter by Horizon:
            </span>
            <div className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[rgba(0,0,0,0.35)] border border-[var(--hairline)]">
              <button
                type="button"
                onClick={() => setFilterBand("all")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                  filterBand === "all"
                    ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-md ring-1 ring-white/20"
                    : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:border-[var(--brass)]/40 hover:bg-white/[0.08] hover:text-foreground"
                }`}
              >
                <span>All Frameworks</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                  filterBand === "all"
                    ? "bg-black/25 text-[var(--primary-foreground)] border-black/20 font-bold"
                    : "bg-white/[0.05] text-foreground border-white/10"
                }`}>
                  {forecasts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterBand("high")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                  filterBand === "high"
                    ? "bg-[var(--risk)] text-white font-semibold shadow-md ring-1 ring-white/20"
                    : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:border-[var(--risk)]/40 hover:bg-white/[0.08] hover:text-[var(--risk)]"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk)]" />
                <span>High Risk</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                  filterBand === "high"
                    ? "bg-black/25 text-white border-black/20 font-bold"
                    : "bg-white/[0.05] text-foreground border-white/10"
                }`}>
                  {highRiskCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilterBand("medium")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                  filterBand === "medium"
                    ? "bg-amber-500 text-black font-semibold shadow-md ring-1 ring-white/20"
                    : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:border-amber-500/40 hover:bg-white/[0.08] hover:text-amber-400"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>Medium Risk</span>
              </button>

              <button
                type="button"
                onClick={() => setFilterBand("low")}
                className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                  filterBand === "low"
                    ? "bg-blue-500 text-white font-semibold shadow-md ring-1 ring-white/20"
                    : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:border-blue-500/40 hover:bg-white/[0.08] hover:text-blue-400"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                <span>Low / Stable</span>
              </button>
            </div>
          </div>

          <span className="font-mono text-[10px] text-muted-foreground pr-2 flex items-center gap-1">
            <span>Click any card to simulate what-if impact</span>
            <span>&rarr;</span>
          </span>
        </section>

        {/* ── Forecast Cards Grid ─────────────────────────────────────────── */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredForecasts.map((f) => (
            <RadarCard key={f.regulation_id} entry={f} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function RadarCard({ entry }: { entry: ForecastEntry }) {
  const isHigh = entry.band === "high";
  const isMed = entry.band === "medium";
  const pct = Math.round(entry.probability * 100);
  const lastAmended = entry.last_amended_on
    ? new Date(entry.last_amended_on).toLocaleDateString(undefined, { year: "numeric", month: "short" })
    : "—";

  return (
    <Link
      to="/predictive/$regulationId"
      params={{ regulationId: entry.regulation_id }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--brass)_45%,transparent)] hover:shadow-[0_20px_50px_-18px_rgba(94,234,212,0.20)]"
    >
      {/* Top glowing hairline accent on hover */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        style={{
          background: isHigh
            ? "linear-gradient(to right, transparent, var(--risk), transparent)"
            : "linear-gradient(to right, transparent, var(--brass), transparent)",
        }}
      />

      <div>
        {/* Top Header metadata */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="rounded-md border border-white/5 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              {entry.jurisdiction}
            </span>
            <h2 className="mt-2 font-display text-[17px] font-semibold leading-[1.3] tracking-tight text-foreground line-clamp-2 transition-colors duration-200 group-hover:text-[var(--brass)]">
              {entry.title}
            </h2>
          </div>

          {/* Probability Pill Badge */}
          <span
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider ${
              isHigh
                ? "border-[color-mix(in_oklab,var(--risk)_40%,transparent)] bg-[color-mix(in_oklab,var(--risk)_15%,transparent)] text-[var(--risk)]"
                : isMed
                  ? "border-[color-mix(in_oklab,var(--brass)_30%,transparent)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] text-[var(--brass)]"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isHigh ? "bg-[var(--risk)] animate-pulse" : isMed ? "bg-[var(--brass)]" : "bg-muted-foreground"
              }`}
            />
            {pct}% Risk
          </span>
        </div>

        {/* Visual Probability Gauge Bar */}
        <div className="mt-3.5 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-white/[0.05] overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isHigh
                  ? "bg-gradient-to-r from-[var(--risk)] to-rose-400"
                  : isMed
                    ? "bg-gradient-to-r from-[var(--brass)] to-emerald-400"
                    : "bg-muted-foreground/40"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground/70">
            <span>Historical Cadence</span>
            <span>Band: {entry.band.toUpperCase()}</span>
          </div>
        </div>

        <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted-foreground line-clamp-3">
          {entry.summary}
        </p>
      </div>

      <div className="mt-5 pt-3.5 border-t border-[var(--hairline)]">
        {/* Metric Triplet */}
        <dl className="grid grid-cols-3 gap-2 text-center pb-3">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Last Amended</dt>
            <dd className="mt-0.5 font-mono text-[11px] font-semibold text-foreground tabular-nums truncate">
              {lastAmended}
            </dd>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Frequency</dt>
            <dd className="mt-0.5 font-mono text-[11px] font-semibold text-foreground tabular-nums">
              {entry.amendment_count}&times; Hist.
            </dd>
          </div>
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
            <dt className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Horizon</dt>
            <dd className="mt-0.5 font-mono text-[11px] font-semibold text-[var(--brass)] tabular-nums">
              &le; {entry.window_months} mo
            </dd>
          </div>
        </dl>

        <div className="flex items-center justify-between pt-2 text-xs">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--brass)] font-semibold inline-flex items-center gap-1 group-hover:underline">
            Simulate What-If Amendment
            <span className="group-hover:translate-x-1 transition-transform duration-150">&rarr;</span>
          </span>
          <span className="font-mono text-[9px] text-muted-foreground/60 uppercase">
            Adversarial Test
          </span>
        </div>
      </div>
    </Link>
  );
}
