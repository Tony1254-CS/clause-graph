import { useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Network, Loader2, Waves, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { SupplyChainGraph } from "@/components/clausegraph/SupplyChainGraph";
import { ComplianceCodePanel } from "@/components/clausegraph/ComplianceCodePanel";
import {
  getSupplyChain,
  simulateSupplyChainImpact,
  type CascadeHit,
  type CascadeResult,
  type ChainNode,
} from "@/lib/supply-chain.functions";
import { handlePlanLimitError } from "@/components/PlanLimitDialog";
import { Button } from "@/components/ui/button";

const chainQuery = queryOptions({
  queryKey: ["supply-chain"],
  queryFn: () => getSupplyChain(),
});

const DEMO_TEXT = `Directive 2026/xx on Energy Efficiency for Data Centres: All colocation and hosting facilities operating within the EU with an installed IT power capacity exceeding 100 kW must maintain a rolling 12-month Power Usage Effectiveness (PUE) below 1.3 and source at least 60% of consumed electricity from renewable sources by January 1. Facilities in breach lose their operating permit and any downstream service contracts relying on them are deemed frustrated at law.`;

export const Route = createFileRoute("/_authenticated/supply-chain")({
  head: () => ({
    meta: [
      { title: "Supply Chain Blast Radius — ClauseGraph" },
      { name: "description", content: "Trace how a regulation propagates across counterparty contracts three hops upstream." },
      { property: "og:title", content: "Supply Chain Blast Radius — ClauseGraph" },
      { property: "og:description", content: "Trace how a regulation propagates across counterparty contracts three hops upstream." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(chainQuery),
  component: SupplyChainPage,
  errorComponent: SupplyChainError,
  notFoundComponent: SupplyChainNotFound,
});

function SupplyChainError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <AppShell>
      <div className="glass-panel max-w-lg p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--risk)]">
          Supply chain unavailable
        </p>
        <h1 className="mt-2 font-display text-[24px] leading-[1.15] tracking-tight text-foreground">
          The cascade graph did not load.
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

function SupplyChainNotFound() {
  return (
    <AppShell>
      <div className="glass-panel max-w-md p-8 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Not found
        </p>
        <h1 className="mt-2 font-display text-[22px] leading-[1.15] text-foreground">
          Supply chain route unavailable.
        </h1>
      </div>
    </AppShell>
  );
}

function formatUSD(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function SupplyChainPage() {
  const { data: chain } = useSuspenseQuery(chainQuery);
  const run = useServerFn(simulateSupplyChainImpact);

  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<CascadeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ChainNode | null>(null);

  const nodesById = useMemo(() => new Map(chain.nodes.map((n) => [n.id, n])), [chain.nodes]);
  const hitMap = useMemo(() => {
    const m = new Map<string, CascadeHit>();
    result?.hits.forEach((h) => m.set(h.node_id, h));
    return m;
  }, [result]);

  const orderedHits = useMemo(
    () => (result ? [...result.hits].sort((a, b) => a.hop - b.hop) : []),
    [result],
  );

  async function onSimulate(input?: string) {
    const t = (input ?? text).trim();
    if (!t || status === "loading") return;
    setStatus("loading");
    setError(null);
    setResult(null);
    setSelected(null);
    try {
      const res = await run({ data: { regulationText: t } });
      setResult(res);
      setStatus("done");
    } catch (err) {
      if (handlePlanLimitError(err)) {
        setStatus("idle");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to simulate cascade");
      setStatus("error");
    }
  }

  return (
    <AppShell>
      <div className="w-full max-w-[1400px] mx-auto space-y-8">
        {/* Top Header & Context Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Supply Chain Topology &middot; Multi-Hop Propagation
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Cross-Enterprise Cascade Simulator
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Contract dependencies form the edges. When a regulation hits any upstream provider,
              exposure cascades back to your organization through every intervening SLA.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] px-4 py-2 backdrop-blur-md">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Network Depth</span>
              <span className="font-mono text-sm font-semibold text-foreground">3 Tiers</span>
            </div>
            <div className="rounded-xl border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] px-4 py-2 backdrop-blur-md">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Entities</span>
              <span className="font-mono text-sm font-semibold text-foreground">{chain.nodes.length} Nodes</span>
            </div>
          </div>
        </div>

        {/* Top 2 Cards: Left = Regulation Draft, Right = Cascade Assessment / Results */}
        <div className="grid gap-6 lg:grid-cols-12 items-stretch">
          
          {/* Top Left (6 cols): Regulation Input Card */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="group relative flex flex-col justify-between h-full overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 sm:p-7 backdrop-blur-xl transition-all duration-300 ease-out hover:border-[color-mix(in_oklab,var(--brass)_45%,transparent)] hover:shadow-[0_20px_50px_-18px_rgba(94,234,212,0.22)]">
              {/* Top glowing hairline accent on hover */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              {/* Corner soft glow */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-[var(--brass)]/10 blur-3xl" />

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--brass)] transition-all duration-300 group-hover:border-[var(--hairline-strong)] group-hover:bg-[color-mix(in_oklab,var(--brass)_15%,transparent)]">
                      <Network className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div>
                      <h2 className="font-display text-[17px] font-semibold tracking-tight text-foreground">
                        Proposed Regulatory Directive
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Test upstream supplier vulnerabilities &amp; breach risks
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setText(DEMO_TEXT);
                      onSimulate(DEMO_TEXT);
                    }}
                    disabled={status === "loading"}
                    className="group/btn inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--brass)_30%,transparent)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] px-3 py-1 font-mono text-[11px] font-medium text-[var(--brass)] transition-all duration-200 hover:bg-[color-mix(in_oklab,var(--brass)_18%,transparent)] active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                  >
                    <span>&bull;</span>
                    Load EU Data Center Directive
                    <span className="text-[10px] opacity-70 group-hover/btn:translate-x-0.5 transition-transform duration-150">&rarr;</span>
                  </button>
                </div>

                {/* Textarea Area */}
                <div className="relative mt-5">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste a proposed rule, supply chain due diligence directive, or statutory amendment…"
                    rows={7}
                    disabled={status === "loading"}
                    className="w-full resize-none rounded-xl border border-white/5 bg-white/[0.03] p-4 text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-[var(--hairline-strong)] focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-[var(--brass)] duration-200 transition-all font-sans"
                  />
                  {text && (
                    <span className="absolute bottom-3 right-3 font-mono text-[10px] text-muted-foreground/60 select-none bg-[rgba(0,0,0,0.4)] px-2 py-0.5 rounded border border-white/5">
                      {text.length} chars
                    </span>
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div className="mt-5 pt-4 border-t border-[var(--hairline)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brass)] shadow-[0_0_8px_var(--brass)]" />
                    <span>Recursive multi-hop graph analysis</span>
                  </div>

                  <button
                    onClick={() => onSimulate()}
                    disabled={!text.trim() || status === "loading"}
                    className="relative inline-flex items-center justify-center gap-2.5 rounded-full bg-[var(--brass)] px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--primary-foreground)] shadow-[0_10px_30px_-10px_rgba(94,234,212,0.45)] hover:bg-[var(--brass-strong)] hover:shadow-[0_14px_36px_-8px_rgba(94,234,212,0.6)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                        <span>Propagating Cascade&hellip;</span>
                      </>
                    ) : (
                      <>
                        <Waves className="h-4 w-4" strokeWidth={2} />
                        <span>Simulate Cascade</span>
                      </>
                    )}
                  </button>
                </div>

                {error && (
                  <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[var(--risk)]/20 bg-[var(--risk)]/10 px-4 py-3 text-xs text-[var(--risk)] animate-in fade-in duration-200">
                    <span className="h-2 w-2 rounded-full bg-[var(--risk)] shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top Right (6 cols): Cascade Assessment / Findings / Idle State */}
          <div className="lg:col-span-6 flex flex-col">
            {result ? (
              <aside className="group relative flex flex-col h-full rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 sm:p-7 backdrop-blur-xl shadow-[var(--shadow-soft)] space-y-5 animate-in fade-in duration-300 transition-all duration-300 hover:border-[color-mix(in_oklab,var(--risk)_40%,transparent)] hover:shadow-[0_20px_50px_-18px_rgba(225,82,75,0.22)]">
                {/* Top glowing hairline accent on hover */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--risk)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                {/* Header Badge */}
                <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-[var(--risk)] shadow-[0_0_8px_var(--risk)] animate-pulse" />
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--risk)]">
                      Cascade Blast Radius
                    </p>
                  </div>
                  {result.fallback && (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground border border-[var(--hairline)] rounded-full px-2.5 py-0.5 bg-white/[0.03]">
                      Deterministic Model
                    </span>
                  )}
                </div>

                {/* Indirect Exposure KPI Box */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[16px] border border-[var(--risk)]/25 bg-gradient-to-br from-[var(--risk)]/15 via-[var(--risk)]/5 to-transparent p-5 backdrop-blur-md">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
                      Indirect Exposure at Risk
                    </p>
                    <p className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[var(--risk)] tabular-nums">
                      {formatUSD(result.total_indirect_exposure)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="font-mono text-sm font-semibold text-foreground">{orderedHits.length} nodes hit</span>
                    <p className="text-xs text-muted-foreground">across supply chain</p>
                  </div>
                </div>

                {/* Executive Summary */}
                {result.summary && (
                  <div className="rounded-[14px] border border-white/5 bg-white/[0.02] p-3.5">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--brass)] font-semibold mb-1">
                      Cascade Finding
                    </p>
                    <p className="text-xs sm:text-[13px] leading-relaxed text-muted-foreground line-clamp-3">
                      {result.summary}
                    </p>
                  </div>
                )}

                {/* Cascade Trace List */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                      Cascade Trace ({orderedHits.length})
                    </p>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Ranked by Hop Distance
                    </span>
                  </div>

                  <ul className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {orderedHits.map((h) => {
                      const n = nodesById.get(h.node_id);
                      if (!n) return null;
                      return (
                        <li
                          key={h.node_id}
                          className="group/item rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-all duration-200 hover:border-[var(--hairline-strong)] hover:bg-[color-mix(in_oklab,var(--brass)_8%,transparent)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brass)] bg-[color-mix(in_oklab,var(--brass)_15%,transparent)] px-2 py-0.5 rounded-md">
                                Hop {h.hop}
                              </span>
                              <span className="text-xs font-semibold text-foreground">{n.name}</span>
                            </div>
                            <span
                              className="font-mono text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{
                                color: h.severity === "high" ? "var(--risk)" : "var(--brass)",
                                border: `1px solid ${h.severity === "high" ? "var(--risk)" : "var(--brass)"}`,
                                backgroundColor: "rgba(255,255,255,0.03)",
                              }}
                            >
                              {h.severity}
                            </span>
                          </div>

                          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground line-clamp-2">
                            {h.reason}
                          </p>

                          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-muted-foreground/80 pt-1 border-t border-white/5">
                            {h.broken_clause ? (
                              <span className="truncate max-w-[200px]">Clause: {h.broken_clause}</span>
                            ) : <span />}
                            {h.indirect_exposure_usd > 0 && (
                              <span className="text-foreground font-semibold">At risk: {formatUSD(h.indirect_exposure_usd)}</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </aside>
            ) : (
              /* Idle Empty State */
              <div className="group relative flex flex-col items-center justify-center h-full rounded-[20px] border border-[var(--hairline)] border-dashed bg-[var(--surface-raised)]/60 p-8 sm:p-12 text-center text-muted-foreground backdrop-blur-xl transition-all duration-300 hover:border-[color-mix(in_oklab,var(--brass)_45%,transparent)] hover:shadow-[0_20px_50px_-18px_rgba(94,234,212,0.18)] min-h-[380px]">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/5 bg-white/[0.04] text-[var(--brass)] shadow-inner mb-4 transition-transform duration-300 group-hover:scale-105">
                  <Network className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <h3 className="font-display text-base font-semibold text-foreground">
                  Awaiting Cascade Simulation
                </h3>
                <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Paste a proposed regulation or load the EU data-center scenario on the left and click <span className="text-[var(--brass)] font-semibold">&ldquo;Simulate Cascade&rdquo;</span> to trace upstream propagation.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setText(DEMO_TEXT);
                    onSimulate(DEMO_TEXT);
                  }}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--brass)_30%,transparent)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] px-4 py-1.5 font-mono text-xs text-[var(--brass)] hover:bg-[color-mix(in_oklab,var(--brass)_20%,transparent)] transition-all duration-200 cursor-pointer"
                >
                  Try demo scenario &rarr;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Full-Width Card: Interactive Multi-Hop Dependency Graph */}
        <div className="group relative flex flex-col items-center justify-center rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 sm:p-8 backdrop-blur-xl shadow-[var(--shadow-soft)] overflow-hidden transition-all duration-300 ease-out hover:border-[color-mix(in_oklab,var(--brass)_45%,transparent)] hover:shadow-[0_24px_60px_-18px_rgba(94,234,212,0.20)]">
          {/* Top glowing hairline accent on hover */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Header Row */}
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--hairline)] pb-4 mb-4">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--brass)] font-semibold">
                Multi-Hop Supply Chain Dependency Architecture
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upstream Tier-3 suppliers through Tier-1 prime vendors propagating to your organization
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--brass)] shadow-[0_0_8px_var(--brass)]" /> Healthy Node
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--risk)] shadow-[0_0_8px_var(--risk)]" /> Cascade Impact
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Organization (You)
              </span>
            </div>
          </div>

          {/* Interactive Graph Canvas Container */}
          <div className="relative w-full overflow-x-auto py-2">
            <SupplyChainGraph
              nodes={chain.nodes}
              edges={chain.edges}
              hits={hitMap}
              animating={status === "done"}
              selectedId={selected?.id ?? null}
              onNodeClick={(n) => setSelected(n)}
            />
          </div>

          {selected && (
            <div className="mt-4 w-full rounded-xl border border-[var(--hairline-strong)] bg-white/[0.03] p-4 text-xs font-mono flex items-center justify-between">
              <div>
                <span className="text-[var(--brass)] font-semibold">Selected: {selected.name}</span>
                <span className="text-muted-foreground ml-2">(Tier {selected.tier} &middot; {selected.jurisdiction ?? "Global"})</span>
              </div>
              {hitMap.get(selected.id) && (
                <span className="text-[var(--risk)] font-semibold">
                  Cascade Hop: {hitMap.get(selected.id)?.hop} ({hitMap.get(selected.id)?.severity.toUpperCase()} RISK)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Remediation Action Panel */}
        {result && result.remediation.length > 0 && (
          <div className="rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 backdrop-blur-xl">
            <p className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brass)]">
              <ShieldAlert className="h-4 w-4" strokeWidth={1.8} /> Recommended Remediation Steps
            </p>
            <ul className="grid sm:grid-cols-2 gap-3">
              {result.remediation.map((r, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 text-xs leading-relaxed text-foreground/90 flex items-start gap-2.5"
                >
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--brass)]/15 text-[var(--brass)] font-mono text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Compliance Code Panel */}
        {result && orderedHits.length > 0 && (
          <div className="pt-4 border-t border-[var(--hairline)]">
            <ComplianceCodePanel
              regulationText={text || DEMO_TEXT}
              simulationRunId={result.run_id ?? undefined}
              gap={
                orderedHits[0]?.broken_clause
                  ? `${orderedHits[0].broken_clause} (${nodesById.get(orderedHits[0].node_id)?.name ?? "upstream provider"})`
                  : "Upstream provider non-compliance"
              }
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
