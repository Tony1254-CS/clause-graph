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
  loader: async ({ context, params }) => {
    const [, , forecasts] = await Promise.all([
      context.queryClient.ensureQueryData(contractsQuery),
      context.queryClient.ensureQueryData(regulationsQuery),
      context.queryClient.ensureQueryData(forecastsQuery()),
    ]);
    const id = params.regulationId;
    const decodedId = decodeURIComponent(id);
    if (!forecasts.some((f) => f.regulation_id === id || f.regulation_id === decodedId)) {
      throw notFound();
    }
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
  const { regulationId } = Route.useParams();
  const { data: forecasts } = useSuspenseQuery(forecastsQuery());
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: regulations } = useSuspenseQuery(regulationsQuery);
  const decodedId = decodeURIComponent(regulationId);
  const entry = forecasts.find((f) => f.regulation_id === regulationId || f.regulation_id === decodedId);
  if (!entry) throw notFound();

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
    contracts.forEach((c) => {
      m.set(c.id, c);
      m.set(c.id.toLowerCase(), c);
    });
    return m;
  }, [contracts]);

  // Fallback index-based resolver for legacy demo IDs (CTR-001 -> contracts[0], CTR-003 -> contracts[2], etc.)
  const resolveContract = useMemo(() => {
    return (contractId: string) => {
      const direct = contractsById.get(contractId) || contractsById.get(contractId.toLowerCase());
      if (direct) return direct;

      const numMatch = contractId.match(/\d+/);
      if (numMatch && contracts.length > 0) {
        const num = parseInt(numMatch[0], 10);
        // CTR-001 is 1-based index 0
        const idx = Math.max(0, Math.min(contracts.length - 1, num - 1));
        return contracts[idx];
      }
      return contracts[0] ?? undefined;
    };
  }, [contractsById, contracts]);

  const totalExposure = useMemo(() => {
    if (!result) return 0;
    return result.impacts.reduce(
      (sum, i) => sum + (resolveContract(i.contract_id)?.value ?? 0),
      0,
    );
  }, [result, resolveContract]);

  const sortedImpacts: ImpactEntry[] = useMemo(() => {
    if (!result) return [];
    return [...result.impacts].sort((a, b) => {
      const s = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
      if (s !== 0) return s;
      const av = resolveContract(a.contract_id)?.value ?? 0;
      const bv = resolveContract(b.contract_id)?.value ?? 0;
      return bv - av;
    });
  }, [result, resolveContract]);

  async function onDraft() {
    if (hypoStatus === "loading") return;
    setHypoStatus("loading");
    setError(null);
    try {
      const h = await runHypothetical({ data: { regulationId } });
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
          regulationId,
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
      <div className="w-full max-w-[1400px] mx-auto space-y-8 pb-16">
        {/* ── Top Navigation & Breadcrumbs ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/predictive"
            className="group inline-flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 px-3.5 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur-md transition-all duration-200 hover:border-[var(--brass)]/50 hover:bg-white/[0.04] hover:text-[var(--brass)]"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-1" strokeWidth={1.8} />
            Back to Radar
          </Link>

          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-[11px] text-muted-foreground/80 tracking-wide uppercase">
              Predictive Intelligence Engine · Active
            </span>
          </div>
        </div>

        {/* ── Executive Threat Hero Banner ── */}
        <section className="relative overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-gradient-to-br from-[var(--surface-raised)]/90 via-[var(--surface-raised)]/60 to-[var(--surface-sunken)]/70 p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)]">
          {/* Subtle glowing ambient background */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[var(--brass)]/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-[var(--risk)]/5 blur-3xl" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brass)]/30 bg-[var(--brass)]/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--brass)]">
                  <Radar className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Jurisdiction: {entry.jurisdiction}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-muted-foreground">
                  Band: <span className="text-foreground uppercase font-semibold">{entry.band}</span>
                </span>
              </div>

              <h1 className="font-display text-[26px] md:text-[34px] font-bold leading-[1.15] tracking-tight text-foreground">
                {entry.title}
              </h1>
              <p className="text-[13.5px] md:text-[14px] leading-relaxed text-muted-foreground max-w-2xl">
                {entry.summary}
              </p>
            </div>

            {/* Metric Gauge Card */}
            <div className="shrink-0 rounded-[20px] border border-[var(--hairline)] bg-white/[0.02] p-5 backdrop-blur-xl min-w-[260px] space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Amendment Probability
                </span>
                <span className="h-2 w-2 rounded-full bg-[var(--brass)] animate-pulse" />
              </div>
              
              <div className="flex items-baseline gap-2">
                <span className="font-display text-[38px] font-bold leading-none tracking-tight text-[var(--brass)] tabular-nums">
                  {Math.round(entry.probability * 100)}%
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">heuristic likelihood</span>
              </div>

              {/* Visual meter bar */}
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--brass)] to-emerald-400"
                  style={{ width: `${Math.round(entry.probability * 100)}%` }}
                />
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between font-mono text-[10.5px] text-muted-foreground">
                <span>Estimated Window:</span>
                <span className="font-semibold text-foreground">&le; {entry.window_months} months</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Main 50/50 Dual Card Workbench (Matching Simulate & Supply-Chain Style) ── */}
        <div className="grid gap-6 lg:grid-cols-2 items-stretch">
          {/* Left Card: Legislative History & Amendment Trajectory */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-[var(--hairline-strong)] hover:shadow-[0_24px_60px_-16px_rgba(94,234,212,0.12)]">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--brass)]/5 blur-2xl transition-opacity group-hover:opacity-100" />
            
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--hairline)]">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--brass)] shadow-inner">
                    <Radar className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="font-display text-[17px] font-semibold tracking-tight text-foreground">
                      Amendment History & Cadence
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Historical legislative cycles from public record
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-muted-foreground">
                    Avg Interval: ~{entry.window_months} mo
                  </span>
                </div>
              </div>

              {/* Timeline Stepper */}
              <div className="relative space-y-4 pl-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-gradient-to-b before:from-[var(--brass)] before:via-white/15 before:to-transparent max-h-[460px] overflow-y-auto custom-scrollbar pr-2">
                {entry.amendments.map((a: import("@/lib/predict.functions").Amendment, i: number) => (
                  <div key={i} className="relative group/step">
                    {/* Glowing timeline node dot */}
                    <div className="absolute -left-[30px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--brass)] bg-[var(--surface-sunken)] shadow-[0_0_8px_var(--brass)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)] group-hover/step:scale-125 transition-transform" />
                    </div>

                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.04]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-semibold text-[var(--brass)] tabular-nums">
                          {a.amended_on}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider font-semibold ${
                            a.direction === "tightened"
                              ? "bg-[var(--risk)]/15 text-[var(--risk)] border border-[var(--risk)]/30"
                              : a.direction === "expanded"
                                ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                : "bg-white/[0.05] text-muted-foreground border border-white/10"
                          }`}
                        >
                          {a.direction}
                        </span>
                      </div>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground group-hover/step:text-foreground/90 transition-colors">
                        {a.summary}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom summary footer */}
            <div className="mt-6 pt-4 border-t border-[var(--hairline)] flex items-center justify-between text-xs text-muted-foreground font-mono">
              <span>{entry.amendments.length} total recorded amendments</span>
              <span className="text-[var(--brass)]">Trajectory: {entry.band.toUpperCase()} RISK</span>
            </div>
          </div>

          {/* Right Card: Adversarial AI Studio & Synthesis */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-[var(--hairline-strong)] hover:shadow-[0_24px_60px_-16px_rgba(94,234,212,0.12)]">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/5 blur-2xl transition-opacity group-hover:opacity-100" />

            <div className="space-y-5">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--hairline)]">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--brass)] shadow-inner">
                    <Zap className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="font-display text-[17px] font-semibold tracking-tight text-foreground">
                      Adversarial "What-If" Studio
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Synthesize near-future statutory amendments
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brass)]/30 bg-[var(--brass)]/10 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--brass)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)] animate-pulse" />
                  AI Synthesis
                </span>
              </div>

              {!hypo ? (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center space-y-4 my-auto">
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-[var(--brass)]">
                    <Zap className="h-6 w-6" strokeWidth={1.8} />
                  </div>
                  <div className="max-w-md mx-auto space-y-2">
                    <h3 className="font-display text-[16px] font-semibold text-foreground">
                      No draft generated yet
                    </h3>
                    <p className="text-[13px] leading-relaxed text-muted-foreground">
                      Generate a plausible near-future amendment based on {entry.title}'s historical cadence and regulatory signals.
                    </p>
                  </div>
                  <button
                    onClick={onDraft}
                    disabled={hypoStatus === "loading"}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--brass)] to-emerald-400 px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-950 shadow-[0_10px_30px_-10px_rgba(94,234,212,0.5)] hover:opacity-95 active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer"
                  >
                    {hypoStatus === "loading" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Synthesizing Draft…
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 fill-slate-950" /> Draft Adversarial Amendment
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Generated Amendment Code/Text Area */}
                  <div className="relative rounded-xl border border-[var(--hairline)] bg-black/40 p-4 font-mono text-[12px] leading-[1.65] text-emerald-300/90 max-h-[220px] overflow-y-auto custom-scrollbar">
                    <pre className="whitespace-pre-wrap">{hypo.amendment_text}</pre>
                  </div>

                  {hypo.rationale && (
                    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[12px] leading-relaxed text-muted-foreground">
                      <span className="font-semibold text-foreground font-mono text-[9.5px] uppercase tracking-wider block mb-0.5">
                        Legal Rationale:
                      </span>
                      {hypo.rationale}
                    </div>
                  )}

                  {/* If Simulation Result is available: Blast Radius Overview */}
                  {result && (
                    <div className="rounded-xl border border-[var(--risk)]/30 bg-[var(--risk)]/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--risk)] font-semibold flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk)] animate-ping" />
                          Blast Radius Shockwave
                        </span>
                        <span className="font-display text-[18px] font-bold text-[var(--risk)] tabular-nums">
                          {formatUSD(totalExposure)} At Risk
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-black/30 p-2 border border-white/5">
                          <span className="text-[10px] text-muted-foreground block font-mono">Exposed Contracts</span>
                          <span className="font-semibold text-foreground text-sm">{sortedImpacts.length} contracts</span>
                        </div>
                        <div className="rounded-lg bg-black/30 p-2 border border-white/5">
                          <span className="text-[10px] text-muted-foreground block font-mono">Primary Severity</span>
                          <span className="font-semibold text-[var(--brass)] text-sm">{sortedImpacts[0] ? SEV_LABEL[sortedImpacts[0].severity] : "None"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Action Bar */}
            {hypo && (
              <div className="mt-5 pt-4 border-t border-[var(--hairline)] flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={onDraft}
                  disabled={hypoStatus === "loading" || simStatus === "loading"}
                  className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  &larr; Re-synthesize
                </button>

                <button
                  onClick={onSimulate}
                  disabled={simStatus === "loading"}
                  className="relative inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brass)] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--primary-foreground)] shadow-[0_10px_30px_-10px_rgba(94,234,212,0.45)] hover:bg-[var(--brass-strong)] active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer"
                >
                  {simStatus === "loading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Propagating Blast Radius…</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 fill-current" />
                      <span>Simulate Portfolio Blast Radius</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--risk)]/20 bg-[var(--risk)]/10 px-3 py-2 text-xs text-[var(--risk)] font-mono">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Full Width Interactive Medallion Graph ── */}
        <section className="relative overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-[var(--hairline)]">
            <div>
              <h2 className="font-display text-[18px] font-semibold text-foreground">
                Interactive Medallion & Blast Network
              </h2>
              <p className="font-mono text-[11px] text-muted-foreground tracking-wide">
                Live topological map connecting {entry.title} to contracts and dependent nodes.
              </p>
            </div>
            {impactMap.size > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--risk)]/40 bg-[var(--risk)]/15 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--risk)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk)] animate-ping" />
                {impactMap.size} Contracts In Blast Radius
              </span>
            )}
          </div>

          <div className="w-full overflow-hidden rounded-[18px]">
            <GraphMedallion
              contracts={contracts}
              regulations={regulations}
              impacts={impactMap.size > 0 ? impactMap : undefined}
              pulsing={simStatus === "loading"}
            />
          </div>
        </section>

        {/* ── Action Plan & Ranked Contract Exposure Table ── */}
        {result && (
          <section className="space-y-6">
            <ActionPlanPanel
              regulationText={hypo?.amendment_text ?? ""}
              summary={result.summary}
              impacts={result.impacts.map((i) => {
                const c = resolveContract(i.contract_id);
                return {
                  contract_id: c?.id ?? i.contract_id,
                  contract_name: c?.name ?? i.contract_id,
                  severity: i.severity,
                  suggested_amendment: i.suggested_amendment,
                };
              })}
              variant="forecast"
            />

            {/* Ranked Exposures List */}
            <div className="rounded-[24px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)]">
              <h3 className="font-display text-[17px] font-semibold text-foreground pb-4 border-b border-[var(--hairline)]">
                Ranked Contract Exposures ({sortedImpacts.length})
              </h3>
              <div className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedImpacts.map((i) => {
                  const c = resolveContract(i.contract_id);
                  const targetId = c?.id ?? i.contract_id;
                  return (
                    <div
                      key={i.contract_id}
                      className="rounded-xl border border-white/5 bg-white/[0.02] p-4 flex flex-col justify-between space-y-3 transition-colors hover:border-white/10 hover:bg-white/[0.04]"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {c ? formatUSD(c.value) : "—"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold ${
                              i.severity === "high"
                                ? "bg-[var(--risk)]/20 text-[var(--risk)] border border-[var(--risk)]/40"
                                : i.severity === "medium"
                                  ? "bg-[var(--brass)]/20 text-[var(--brass)] border border-[var(--brass)]/40"
                                  : "bg-white/10 text-muted-foreground"
                            }`}
                          >
                            {SEV_LABEL[i.severity]}
                          </span>
                        </div>
                        <h4 className="mt-2 font-display text-[14px] font-semibold text-foreground truncate">
                          {c?.name ?? i.contract_id}
                        </h4>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground line-clamp-3">
                          {i.suggested_amendment}
                        </p>
                      </div>

                      <Link
                        to="/contracts/$contractId"
                        params={{ contractId: targetId }}
                        className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-[var(--brass)] hover:underline pt-2 border-t border-white/5"
                      >
                        Inspect Contract &rarr;
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
