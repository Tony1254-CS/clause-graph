import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Zap, AlertTriangle, Loader2 } from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { GraphMedallion } from "@/components/clausegraph/GraphMedallion";
import { contractsQuery, regulationsQuery, formatUSD } from "@/data/queries";
import { simulateImpact } from "@/lib/simulate.functions";
import type { ImpactEntry, Severity, SimulationResult } from "@/lib/simulate-types";
import { ActionPlanPanel } from "@/components/clausegraph/ActionPlanPanel";
import { handlePlanLimitError } from "@/components/PlanLimitDialog";
import { RouteError } from "@/components/clausegraph/RouteError";

export const Route = createFileRoute("/_authenticated/simulate")({
  head: () => ({
    meta: [
      { title: "Simulate Impact — ClauseGraph" },
      {
        name: "description",
        content:
          "Paste a proposed regulation and watch the blast radius propagate through the contract portfolio.",
      },
      { property: "og:title", content: "Simulate Impact — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Paste a proposed regulation and watch the blast radius propagate through the contract portfolio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(contractsQuery),
      context.queryClient.ensureQueryData(regulationsQuery),
    ]),
  component: SimulatePage,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Simulator unavailable" error={error} reset={reset} />
  ),
});

const SEV_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const SEV_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };
const SEV_DOT: Record<Severity, string> = {
  high: "bg-[var(--risk)]",
  medium: "bg-[rgba(225,82,75,0.75)]",
  low: "bg-[rgba(225,82,75,0.45)]",
};

const DEMO_TEXT = `Effective January 1, all covered financial institutions must maintain a minimum common equity tier 1 capital ratio of 11.5% and apply revised risk-weight schedules to unsecured credit facilities and long-dated derivatives exposures. Counterparties must be notified within 30 days of any material change to internal risk models.`;

function SimulatePage() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: regulations } = useSuspenseQuery(regulationsQuery);
  const runSimulate = useServerFn(simulateImpact);

  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
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

  const totalExposure = useMemo(() => {
    if (!result) return 0;
    return result.impacts.reduce((sum, i) => sum + (resolveContract(i.contract_id)?.value ?? 0), 0);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || status === "loading") return;
    setStatus("loading");
    setError(null);
    setResult(null);
    const startedAt = Date.now();
    try {
      const res = await runSimulate({ data: { regulationText: trimmed } });
      // Hold the pulse for at least ~1.5s so the "stamping" moment reads.
      const elapsed = Date.now() - startedAt;
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
      <div className="w-full max-w-[1400px] mx-auto space-y-8">
        {/* Top Header & Context Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Regulatory Impact Engine &middot; Real-Time Simulation
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Simulate Regulatory Propagation
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Cross-reference proposed draft legislation, executive directives, or compliance updates against your active contract ontology to compute exposure blast radii.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] px-4 py-2 backdrop-blur-md">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Portfolio Scope</span>
              <span className="font-mono text-sm font-semibold text-foreground">{contracts.length} Contracts</span>
            </div>
            <div className="rounded-xl border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] px-4 py-2 backdrop-blur-md">
              <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Regulations</span>
              <span className="font-mono text-sm font-semibold text-foreground">{regulations.length} Indexed</span>
            </div>
          </div>
        </div>

        {/* Top 2 Cards: Left = Regulation Draft, Right = Blast Radius Results / Idle State */}
        <div className="grid gap-6 lg:grid-cols-12 items-stretch">
          
          {/* Top Left (6 cols): Regulation Input Card */}
          <div className="lg:col-span-6 flex flex-col">
            <form
              onSubmit={onSubmit}
              className="group relative flex flex-col justify-between h-full overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 sm:p-7 backdrop-blur-xl transition-all duration-300 ease-out hover:border-[color-mix(in_oklab,var(--brass)_45%,transparent)] hover:shadow-[0_20px_50px_-18px_rgba(94,234,212,0.22)]"
            >
              {/* Top glowing hairline accent on hover (same as ContractCard) */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              {/* Corner soft glow */}
              <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-[var(--brass)]/10 blur-3xl" />

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--brass)] transition-all duration-300 group-hover:border-[var(--hairline-strong)] group-hover:bg-[color-mix(in_oklab,var(--brass)_15%,transparent)]">
                      <Zap className="h-4 w-4" strokeWidth={2} />
                    </div>
                    <div>
                      <h2 className="font-display text-[17px] font-semibold tracking-tight text-foreground">
                        Proposed Regulation Draft
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Input statutory amendment or statutory text
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setText(DEMO_TEXT)}
                    disabled={status === "loading"}
                    className="group/btn inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--brass)_30%,transparent)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] px-3 py-1 font-mono text-[11px] font-medium text-[var(--brass)] transition-all duration-200 hover:bg-[color-mix(in_oklab,var(--brass)_18%,transparent)] active:scale-[0.98] disabled:opacity-40 cursor-pointer"
                  >
                    <span>&bull;</span>
                    Load Sample Basel IV
                    <span className="text-[10px] opacity-70 group-hover/btn:translate-x-0.5 transition-transform duration-150">&rarr;</span>
                  </button>
                </div>

                {/* Textarea Area */}
                <div className="relative mt-5">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste statutory or regulatory text here — e.g. 'Effective January 1, all covered institutions must maintain a minimum capital ratio of 11.5% and apply revised risk-weight schedules to unsecured credit facilities…'"
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
                    <span>Real-time semantic vector mapping</span>
                  </div>

                  <button
                    type="submit"
                    disabled={!text.trim() || status === "loading"}
                    className="relative inline-flex items-center justify-center gap-2.5 rounded-full bg-[var(--brass)] px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--primary-foreground)] shadow-[0_10px_30px_-10px_rgba(94,234,212,0.45)] hover:bg-[var(--brass-strong)] hover:shadow-[0_14px_36px_-8px_rgba(94,234,212,0.6)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                        <span>Propagating Blast Radius&hellip;</span>
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
                  <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[var(--risk)]/20 bg-[var(--risk)]/10 px-4 py-3 text-xs text-[var(--risk)] animate-in fade-in duration-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Top Right (6 cols): Dynamic Blast Radius / Results / Idle State */}
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
                      Blast Radius Assessment
                    </p>
                  </div>
                  {result.fallback && (
                    <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground border border-[var(--hairline)] rounded-full px-2.5 py-0.5 bg-white/[0.03]">
                      Evaluation Seed
                    </span>
                  )}
                </div>

                {/* Exposure KPI Hero Box */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-[16px] border border-[var(--risk)]/25 bg-gradient-to-br from-[var(--risk)]/15 via-[var(--risk)]/5 to-transparent p-5 backdrop-blur-md">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
                      Total Estimated Exposure
                    </p>
                    <p className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[var(--risk)] tabular-nums">
                      {formatUSD(totalExposure)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="font-mono text-sm font-semibold text-foreground">{sortedImpacts.length} contracts</span>
                    <p className="text-xs text-muted-foreground">affected in portfolio</p>
                  </div>
                </div>

                {/* Executive Summary */}
                {result.summary && (
                  <div className="rounded-[14px] border border-white/5 bg-white/[0.02] p-3.5">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--brass)] font-semibold mb-1">
                      Executive Finding
                    </p>
                    <p className="text-xs sm:text-[13px] leading-relaxed text-muted-foreground line-clamp-3">
                      {result.summary}
                    </p>
                  </div>
                )}

                {/* Affected Contracts List */}
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                      Affected Agreements ({sortedImpacts.length})
                    </p>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Ranked by Severity
                    </span>
                  </div>

                  <ul className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {sortedImpacts.map((i) => {
                      const c = contractsById.get(i.contract_id);
                      if (!c) return null;
                      return (
                        <li
                          key={i.contract_id}
                          className="group/item rounded-xl border border-white/5 bg-white/[0.02] p-3 transition-all duration-200 hover:border-[var(--hairline-strong)] hover:bg-[color-mix(in_oklab,var(--brass)_8%,transparent)]"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Link
                              to="/contracts/$contractId"
                              params={{ contractId: c.id }}
                              className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brass)] hover:underline inline-flex items-center gap-1"
                            >
                              {c.id}
                              <span className="opacity-0 group-hover/item:opacity-100 transition-opacity">&rarr;</span>
                            </Link>
                            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded-full border border-white/5 bg-white/[0.03]">
                              <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[i.severity]}`} />
                              {SEV_LABEL[i.severity]}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center justify-between text-xs">
                            <p className="font-medium text-foreground truncate max-w-[240px]">
                              {c.name}
                            </p>
                            <span className="font-mono text-muted-foreground tabular-nums shrink-0">
                              {formatUSD(c.value)}
                            </span>
                          </div>

                          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground/80 line-clamp-2">
                            {i.suggested_amendment}
                          </p>
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
                  <Zap className="h-6 w-6" strokeWidth={1.5} />
                </div>
                <h3 className="font-display text-base font-semibold text-foreground">
                  No Active Simulation
                </h3>
                <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  Paste or load proposed statutory regulation text on the left and click <span className="text-[var(--brass)] font-semibold">&ldquo;Simulate Impact&rdquo;</span> to compute exposure radius and affected contract lines.
                </p>
                <button
                  type="button"
                  onClick={() => setText(DEMO_TEXT)}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--brass)_30%,transparent)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] px-4 py-1.5 font-mono text-xs text-[var(--brass)] hover:bg-[color-mix(in_oklab,var(--brass)_20%,transparent)] transition-all duration-200 cursor-pointer"
                >
                  Try demo scenario &rarr;
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Full-Width Card: Interactive Portfolio Topology Medallion */}
        <div className="group relative flex flex-col items-center justify-center rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 sm:p-10 backdrop-blur-xl shadow-[var(--shadow-soft)] overflow-hidden transition-all duration-300 ease-out hover:border-[color-mix(in_oklab,var(--brass)_45%,transparent)] hover:shadow-[0_24px_60px_-18px_rgba(94,234,212,0.20)]">
          {/* Top glowing hairline accent on hover */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Header Row */}
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--hairline)] pb-4 mb-4">
            <div>
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--brass)] font-semibold">
                Portfolio Topology &middot; Dynamic Graph Medallion
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Full-spectrum mapping of active agreements, regulatory nodes, and propagated blast radius
              </p>
            </div>
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--brass)] shadow-[0_0_8px_var(--brass)]" /> Contract Node
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Regulation
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--risk)] shadow-[0_0_8px_var(--risk)]" /> In Blast Radius
              </span>
            </div>
          </div>

          {/* Interactive Medallion Canvas Container */}
          <div className="relative flex items-center justify-center w-full py-4">
            <GraphMedallion
              contracts={contracts}
              regulations={regulations}
              impacts={impactMap.size > 0 ? impactMap : undefined}
              pulsing={status === "loading"}
            />
          </div>

          <p className="mt-2 text-center text-xs text-muted-foreground/70">
            Hover over rings and nodes to inspect entity ties and severity blast levels.
          </p>
        </div>

        {/* Action Plan Panel (shown on completed run) */}
        {status === "done" && result && (
          <div className="pt-4 border-t border-[var(--hairline)]">
            <ActionPlanPanel
              regulationText={text}
              summary={result.summary}
              impacts={sortedImpacts.map((i) => {
                const c = resolveContract(i.contract_id);
                return {
                  contract_id: c?.id ?? i.contract_id,
                  contract_name: c?.name ?? i.contract_id,
                  severity: i.severity,
                  suggested_amendment: i.suggested_amendment,
                };
              })}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
