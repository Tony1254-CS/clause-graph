import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, Loader2, Zap, AlertTriangle, Sparkles, FileText, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { GraphMedallion } from "@/components/clausegraph/GraphMedallion";
import { ActionPlanPanel } from "@/components/clausegraph/ActionPlanPanel";
import { contractsQuery, regulationsQuery, formatUSD } from "@/data/queries";
import { simulateImpact } from "@/lib/simulate.functions";
import type { ImpactEntry, Severity, SimulationResult } from "@/lib/simulate-types";
import { handlePlanLimitError } from "@/components/PlanLimitDialog";
import { RouteError } from "@/components/clausegraph/RouteError";

export const Route = createFileRoute("/_authenticated/what-if")({
  head: () => ({
    meta: [
      { title: "What-If Sandbox — ClauseGraph" },
      {
        name: "description",
        content: "Paste any hypothetical regulation and simulate its blast radius across your live contract portfolio.",
      },
      { property: "og:title", content: "What-If Sandbox — ClauseGraph" },
      {
        property: "og:description",
        content: "Paste any hypothetical regulation and simulate its blast radius.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(contractsQuery),
      context.queryClient.ensureQueryData(regulationsQuery),
    ]).then(() => null),
  component: WhatIfSandbox,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Sandbox unavailable" error={error} reset={reset} />
  ),
});

const SEV_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const SEV_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };
const SEV_DOT: Record<Severity, string> = {
  high: "bg-[var(--risk)]",
  medium: "bg-[rgba(225,82,75,0.75)]",
  low: "bg-[rgba(225,82,75,0.45)]",
};

const PRESETS = [
  {
    label: "Aggressive AI Act tightening",
    tag: "AI Governance",
    text: "All AI-assisted financial decisioning is reclassified as high-risk. Providers must publish real-time model performance drift metrics and obtain explicit renewed consent from every affected data subject within 90 days of any material model retraining.",
  },
  {
    label: "Cross-border data escrow",
    tag: "Data Sovereignty",
    text: "All personal data of EU residents processed outside the EU must be held in a bonded escrow with EU-resident cryptographic keys. Extraterritorial requests trigger mandatory 30-day notification to the data subject before any disclosure.",
  },
  {
    label: "Instant payment reversibility",
    tag: "Payment Fintech",
    text: "Any consumer-initiated payment above €500 becomes reversible for 72 hours without cause. Merchants must maintain a segregated liquidity reserve equal to 5% of the trailing 30-day gross volume to cover reversal exposure.",
  },
];

function WhatIfSandbox() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: regulations } = useSuspenseQuery(regulationsQuery);
  const runSimulate = useServerFn(simulateImpact);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        const idx = Math.max(0, Math.min(contracts.length - 1, num - 1));
        return contracts[idx];
      }
      return contracts[0] ?? undefined;
    };
  }, [contractsById, contracts]);

  const impactMap = useMemo(() => {
    const m = new Map<string, Severity>();
    result?.impacts.forEach((i) => m.set(i.contract_id, i.severity));
    return m;
  }, [result]);

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

  const totalExposure = useMemo(() => {
    if (!result) return 0;
    return result.impacts.reduce(
      (sum, i) => sum + (resolveContract(i.contract_id)?.value ?? 0),
      0,
    );
  }, [result, resolveContract]);

  async function onSimulate() {
    if (status === "loading") return;
    const trimmed = text.trim();
    if (!trimmed) return;
    setStatus("loading");
    setError(null);
    setResult(null);
    const started = Date.now();
    try {
      const res = await runSimulate({
        data: { regulationText: trimmed, runType: "what_if" },
      });
      const elapsed = Date.now() - started;
      if (elapsed < 1500) await new Promise((r) => setTimeout(r, 1500 - elapsed));
      setResult(res);
      setStatus("done");
    } catch (err) {
      if (handlePlanLimitError(err, "simulations")) {
        setStatus("idle");
        return;
      }
      setError(err instanceof Error ? err.message : "Simulation failed");
      setStatus("error");
    }
  }

  return (
    <AppShell>
      <div className="w-full max-w-[1400px] mx-auto space-y-8 pb-16">
        {/* ── Top Header & Context Banner ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Adversarial Compliance Lab · What-If Sandbox
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Stress-Test Any Rule You Imagine
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Formulate hypothetical regulations or adversarial directives to stress-test your live contract ontology.
              Runs are tagged <span className="font-mono text-[11px] text-[var(--brass)]">what_if</span> and do not modify legal filings.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-muted-foreground">
              Live Corpus: <strong className="text-foreground">{contracts.length} Contracts</strong>
            </span>
            <span className="rounded-full border border-[var(--brass)]/30 bg-[var(--brass)]/10 px-3 py-1 font-mono text-[11px] font-semibold text-[var(--brass)]">
              Isolated Sandbox Mode
            </span>
          </div>
        </div>

        {/* ── 50/50 Dual Card Workbench ── */}
        <div className="grid gap-6 lg:grid-cols-2 items-stretch">
          {/* Left Card: Rule Formulation Studio & Presets */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-[var(--hairline-strong)] hover:shadow-[0_24px_60px_-16px_rgba(94,234,212,0.12)]">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[var(--brass)]/5 blur-2xl transition-opacity group-hover:opacity-100" />

            <div className="space-y-5">
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--hairline)]">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--brass)] shadow-inner">
                    <FlaskConical className="h-4 w-4" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 className="font-display text-[17px] font-semibold tracking-tight text-foreground">
                      Synthetic Rule Formulation
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Input proposed statute, decree, or strict compliance clauses
                    </p>
                  </div>
                </div>

                <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  Drafting Canvas
                </span>
              </div>

              {/* Preset Scenario Pills */}
              <div className="space-y-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Quick Load Test Scenarios:
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((p) => {
                    const isSelected = text === p.text;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setText(p.text)}
                        className={`rounded-xl px-3 py-1.5 font-mono text-[11px] transition-all duration-200 cursor-pointer text-left flex items-center gap-2 border ${
                          isSelected
                            ? "border-[var(--brass)]/50 bg-[var(--brass)]/15 text-[var(--brass)] font-semibold shadow-sm"
                            : "border-white/5 bg-white/[0.02] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)]" />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Textarea Area */}
              <div className="relative mt-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste or formulate any hypothetical statutory rule here — e.g. 'Effective Q3, all automated biometric processing is subject to weekly third-party audit and mandatory insurance reserve…'"
                  rows={8}
                  disabled={status === "loading"}
                  className="w-full resize-none rounded-xl border border-white/5 bg-white/[0.03] p-4 text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-[var(--hairline-strong)] focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-[var(--brass)] duration-200 transition-all font-sans"
                />
                {text && (
                  <span className="absolute bottom-3 right-3 font-mono text-[10px] text-muted-foreground/60 select-none bg-[rgba(0,0,0,0.5)] px-2 py-0.5 rounded border border-white/5">
                    {text.length} chars
                  </span>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-5 pt-4 border-t border-[var(--hairline)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brass)] shadow-[0_0_8px_var(--brass)]" />
                  <span>Real-time semantic vector mapping</span>
                </div>

                <button
                  type="button"
                  onClick={onSimulate}
                  disabled={!text.trim() || status === "loading"}
                  className="relative inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brass)] px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--primary-foreground)] shadow-[0_10px_30px_-10px_rgba(94,234,212,0.45)] hover:bg-[var(--brass-strong)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                      <span>Simulating Blast Shockwave…</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 fill-current" strokeWidth={2} />
                      <span>Simulate Impact</span>
                    </>
                  )}
                </button>
              </div>

              {error && (
                <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-[var(--risk)]/20 bg-[var(--risk)]/10 px-4 py-3 text-xs text-[var(--risk)] font-mono">
                  <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Card: Dynamic Portfolio Exposure & Results */}
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-[var(--hairline-strong)] hover:shadow-[0_24px_60px_-16px_rgba(94,234,212,0.12)]">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/5 blur-2xl transition-opacity group-hover:opacity-100" />

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--hairline)]">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-[var(--brass)] shadow-inner">
                  <Zap className="h-4 w-4" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="font-display text-[17px] font-semibold tracking-tight text-foreground">
                    Shockwave Blast Radius
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Impact propagation across monitored portfolio
                  </p>
                </div>
              </div>

              {result && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--risk)]/35 bg-[var(--risk)]/15 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--risk)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk)] animate-ping" />
                  {sortedImpacts.length} Impacted
                </span>
              )}
            </div>

            {/* Body: Idle State vs Simulation Output */}
            {!result ? (
              <div className="my-auto flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-[var(--brass)] shadow-inner">
                  <FlaskConical className="h-7 w-7 opacity-80" strokeWidth={1.6} />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="font-display text-[16px] font-semibold text-foreground">
                    Awaiting Stress-Test Formulation
                  </h3>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    Select one of the preset scenarios or type a custom rule on the left. 
                    The engine will model contract vulnerability, clause divergence, and financial exposure.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)]" />
                  <span>Ready for execution</span>
                </div>
              </div>
            ) : (
              <div className="space-y-5 my-auto">
                {/* 3 Executive Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 text-center">
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground block">
                      Total At-Risk Exposure
                    </span>
                    <span className="font-display text-[24px] font-bold text-[var(--risk)] tabular-nums mt-1 block">
                      {formatUSD(totalExposure)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 text-center">
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground block">
                      Breached Agreements
                    </span>
                    <span className="font-display text-[24px] font-bold text-foreground tabular-nums mt-1 block">
                      {sortedImpacts.length}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 text-center col-span-2 md:col-span-1">
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground block">
                      Max Severity Tier
                    </span>
                    <span className="font-display text-[24px] font-bold text-[var(--brass)] tabular-nums mt-1 block">
                      {sortedImpacts[0] ? SEV_LABEL[sortedImpacts[0].severity] : "None"}
                    </span>
                  </div>
                </div>

                {/* AI Executive Briefing */}
                {result.summary && (
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-[13px] leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground font-mono text-[10px] uppercase tracking-wider block mb-1">
                      Executive Impact Assessment:
                    </span>
                    {result.summary}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-5 pt-4 border-t border-[var(--hairline)] flex items-center justify-between font-mono text-[10.5px] text-muted-foreground">
              <span>Simulation Status: {status === "loading" ? "Processing…" : status === "done" ? "Complete" : "Idle"}</span>
              <span className="text-[var(--brass)]">Portfolio: {contracts.length} Instruments</span>
            </div>
          </div>
        </div>

        {/* ── Full Width Interactive Medallion Graph ── */}
        <section className="relative overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-[var(--hairline)]">
            <div>
              <h2 className="font-display text-[18px] font-semibold text-foreground">
                Interactive Medallion & Topological Blast Network
              </h2>
              <p className="font-mono text-[11px] text-muted-foreground tracking-wide">
                Live topological map connecting synthetic what-if rule to contract nodes and dependencies.
              </p>
            </div>
            {impactMap.size > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--risk)]/40 bg-[var(--risk)]/15 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-wider text-[var(--risk)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk)] animate-ping" />
                {impactMap.size} Active Impact Nodes
              </span>
            )}
          </div>

          <div className="w-full overflow-hidden rounded-[18px]">
            <GraphMedallion
              contracts={contracts}
              regulations={regulations}
              impacts={impactMap.size > 0 ? impactMap : undefined}
              pulsing={status === "loading"}
            />
          </div>
        </section>

        {/* ── Action Plan & Ranked Contract Exposure Table ── */}
        {result && (
          <section className="space-y-6">
            <ActionPlanPanel
              regulationText={text}
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
