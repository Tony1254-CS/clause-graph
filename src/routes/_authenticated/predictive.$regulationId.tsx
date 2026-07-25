import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Radar, Zap, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { GraphMedallion } from "@/components/clausegraph/GraphMedallion";
import { ActionPlanPanel } from "@/components/clausegraph/ActionPlanPanel";
import { contractsQuery, regulationsQuery, formatUSD } from "@/data/queries";
import { simulateImpact } from "@/lib/simulate.functions";
import {
  generateHypotheticalAmendment,
  type HypotheticalAmendment,
} from "@/lib/predict.functions";
import type { ImpactEntry, Severity, SimulationResult } from "@/lib/simulate-types";
import { handlePlanLimitError } from "@/components/PlanLimitDialog";
import { forecastsQuery } from "./predictive";

export const Route = createFileRoute("/_authenticated/predictive/$regulationId")({
  head: ({ params }) => ({
    meta: [
      { title: `Forecast: ${params.regulationId} — ClauseGraph` },
      {
        name: "description",
        content: "Adversarial what-if amendment simulated against the live contract portfolio.",
      },
      { property: "og:title", content: `Forecast: ${params.regulationId} — ClauseGraph` },
      {
        property: "og:description",
        content: "Adversarial what-if amendment simulated against the live contract portfolio.",
      },
    ],
  }),
  loader: ({ context, params }) => {
    return Promise.all([
      context.queryClient.ensureQueryData(contractsQuery),
      context.queryClient.ensureQueryData(regulationsQuery),
      context.queryClient.ensureQueryData(forecastsQuery()),
    ]).then(([, , forecasts]) => {
      const entry = forecasts.find((f) => f.regulation_id === params.regulationId);
      if (!entry) throw notFound();
      return { entry };
    });
  },
  component: ForecastDetail,
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <div className="glass-panel p-6 max-w-lg">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--risk)]">Error</p>
        <p className="mt-2 text-[13px] text-foreground">{error.message}</p>
        <button onClick={reset} className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-brass">
          Retry →
        </button>
      </div>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <div className="glass-panel p-6">Regulation not found.</div>
    </AppShell>
  ),
});

const SEV_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const SEV_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };
const SEV_DOT: Record<Severity, string> = {
  high: "bg-[var(--risk)]",
  medium: "bg-[rgba(225,82,75,0.75)]",
  low: "bg-[rgba(225,82,75,0.45)]",
};

function ForecastDetail() {
  const { entry } = Route.useLoaderData();
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: regulations } = useSuspenseQuery(regulationsQuery);
  const runHypothetical = useServerFn(generateHypotheticalAmendment);
  const runSimulate = useServerFn(simulateImpact);

  const [hypo, setHypo] = useState<HypotheticalAmendment | null>(null);
  const [hypoStatus, setHypoStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [simStatus, setSimStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const impactMap = useMemo(() => {
    const m = new Map<string, Severity>();
    result?.impacts.forEach((i) => m.set(i.contract_id, i.severity));
    return m;
  }, [result]);

  const contractsById = useMemo(() => {
    const m = new Map<string, (typeof contracts)[number]>();
    contracts.forEach((c) => m.set(c.id, c));
    return m;
  }, [contracts]);

  const totalExposure = useMemo(() => {
    if (!result) return 0;
    return result.impacts.reduce(
      (sum, i) => sum + (contractsById.get(i.contract_id)?.value ?? 0),
      0,
    );
  }, [result, contractsById]);

  const sortedImpacts: ImpactEntry[] = useMemo(() => {
    if (!result) return [];
    return [...result.impacts].sort((a, b) => {
      const s = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
      if (s !== 0) return s;
      const av = contractsById.get(a.contract_id)?.value ?? 0;
      const bv = contractsById.get(b.contract_id)?.value ?? 0;
      return bv - av;
    });
  }, [result, contractsById]);

  async function onDraft() {
    if (hypoStatus === "loading") return;
    setHypoStatus("loading");
    setError(null);
    try {
      const h = await runHypothetical({ data: { regulationId: entry.regulation_id } });
      setHypo(h);
      setHypoStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft failed");
      setHypoStatus("error");
    }
  }

  async function onSimulate() {
    if (!hypo || simStatus === "loading") return;
    setSimStatus("loading");
    setError(null);
    setResult(null);
    const started = Date.now();
    try {
      const res = await runSimulate({
        data: {
          regulationText: hypo.amendment_text,
          runType: "forecast",
          regulationId: entry.regulation_id,
        },
      });
      const elapsed = Date.now() - started;
      if (elapsed < 1500) await new Promise((r) => setTimeout(r, 1500 - elapsed));
      setResult(res);
      setSimStatus("done");
    } catch (err) {
      if (handlePlanLimitError(err, "simulations")) {
        setSimStatus("idle");
        return;
      }
      setError(err instanceof Error ? err.message : "Simulation failed");
      setSimStatus("error");
    }
  }

  return (
    <AppShell>
      <div className="w-full max-w-[1280px] mx-auto">
        <Link
          to="/predictive"
          className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-brass duration-150 ease-out transition-colors"
        >
          <ArrowLeft className="h-3 w-3" strokeWidth={1.6} /> Predictive Radar
        </Link>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-brass" strokeWidth={1.6} />
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
                Forecast · {entry.jurisdiction}
              </p>
            </div>
            <h1 className="mt-2 font-display text-[28px] leading-[1.15] tracking-tight text-foreground">
              {entry.title}
            </h1>
            <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">{entry.summary}</p>
          </div>
          <div className="glass-panel px-4 py-3 min-w-[210px]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Change probability
            </p>
            <p className="mt-1 font-display text-[28px] leading-[1] tracking-tight text-brass tabular-nums">
              {Math.round(entry.probability * 100)}%
            </p>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
              Est. window ≤ {entry.window_months} months
            </p>
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
          <div className="min-w-0 flex flex-col gap-6">
            <div className="glass-panel p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
                Amendment history
              </p>
              <ol className="mt-4 space-y-3">
                {entry.amendments.map((a: import("@/lib/predict.functions").Amendment, i: number) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-brass shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] text-brass tabular-nums">
                        {a.amended_on} · {a.direction}
                      </p>
                      <p className="mt-0.5 text-[12.5px] leading-[1.55] text-foreground">
                        {a.summary}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {!hypo && (
              <div className="glass-panel p-6 flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
                    Adversarial what-if
                  </p>
                  <p className="mt-1 text-[13px] text-foreground">
                    Draft a plausible near-future amendment from the historical pattern.
                  </p>
                </div>
                <button
                  onClick={onDraft}
                  disabled={hypoStatus === "loading"}
                  className="inline-flex items-center gap-2 rounded-[12px] bg-[var(--brass)] px-4 py-2.5 text-[13px] font-medium text-[var(--primary-foreground)] shadow-[var(--glow-brass)] hover:bg-[var(--brass-strong)] active:scale-[0.98] disabled:opacity-40 duration-150 ease-out transition-all"
                >
                  {hypoStatus === "loading" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting…
                    </>
                  ) : (
                    "Draft amendment"
                  )}
                </button>
              </div>
            )}

            {hypo && (
              <div className="glass-panel p-6">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
                    Hypothetical amendment text
                  </p>
                  <span className="rounded-full border border-brass/60 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-brass">
                    Generated
                  </span>
                </div>
                <pre className="mt-4 whitespace-pre-wrap rounded-[12px] border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] p-4 font-mono text-[12px] leading-[1.6] text-foreground">
                  {hypo.amendment_text}
                </pre>
                {hypo.rationale && (
                  <p className="mt-3 text-[12.5px] leading-[1.6] text-muted-foreground">
                    {hypo.rationale}
                  </p>
                )}
                {hypo.based_on_patterns.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {hypo.based_on_patterns.map((p, i) => (
                      <li
                        key={i}
                        className="font-mono text-[10.5px] text-muted-foreground/90 tabular-nums"
                      >
                        — {p}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-[var(--hairline)]">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Adversarial what-if · not an actual proposal
                  </p>
                  <button
                    onClick={onSimulate}
                    disabled={simStatus === "loading"}
                    className="inline-flex items-center gap-2 rounded-[12px] bg-[var(--brass)] px-4 py-2.5 text-[13px] font-medium text-[var(--primary-foreground)] shadow-[var(--glow-brass)] hover:bg-[var(--brass-strong)] active:scale-[0.98] disabled:opacity-40 duration-150 ease-out transition-all"
                  >
                    {simStatus === "loading" ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Simulating…
                      </>
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5" strokeWidth={2} /> Simulate this forecast
                      </>
                    )}
                  </button>
                </div>
                {error && (
                  <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.6} /> {error}
                  </p>
                )}
              </div>
            )}

            <GraphMedallion
              contracts={contracts}
              regulations={regulations}
              impacts={impactMap.size > 0 ? impactMap : undefined}
              pulsing={simStatus === "loading"}
            />

            {result && (
              <ActionPlanPanel
                regulationText={hypo?.amendment_text ?? ""}
                summary={result.summary}
                impacts={result.impacts}
                variant="forecast"
              />
            )}
          </div>

          <aside
            className={`glass-panel p-6 lg:sticky lg:top-6 transition-opacity duration-500 ${
              result ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-hidden={!result}
          >
            {result && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
                    Forecast blast radius
                  </p>
                  {result.fallback && (
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground border border-[var(--hairline)] rounded-full px-2 py-0.5">
                      Demo fallback
                    </span>
                  )}
                </div>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Exposure if enacted
                </p>
                <p className="mt-1 font-display text-[36px] leading-[1] tracking-tight text-[var(--risk)] tabular-nums">
                  {formatUSD(totalExposure)}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  across {sortedImpacts.length} contract{sortedImpacts.length === 1 ? "" : "s"} on day one
                </p>
                {result.summary && (
                  <p className="mt-5 text-[12.5px] leading-[1.6] text-muted-foreground border-t border-[var(--hairline)] pt-4">
                    {result.summary}
                  </p>
                )}
                <div className="mt-5 border-t border-[var(--hairline)] pt-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Ranked exposures
                  </p>
                  <ol className="mt-3 space-y-3">
                    {sortedImpacts.map((i) => {
                      const c = contractsById.get(i.contract_id);
                      return (
                        <li key={i.contract_id}>
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 min-w-0">
                              <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[i.severity]}`} />
                              <span className="text-[12.5px] text-foreground truncate">
                                {c?.name ?? i.contract_id}
                              </span>
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                              {SEV_LABEL[i.severity]}
                            </span>
                          </div>
                          <p className="mt-1 pl-3.5 text-[11.5px] leading-[1.55] text-muted-foreground">
                            {i.suggested_amendment}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </>
            )}
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
