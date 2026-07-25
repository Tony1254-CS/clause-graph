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
    contracts.forEach((c) => m.set(c.id, c));
    return m;
  }, [contracts]);

  const totalExposure = useMemo(() => {
    if (!result) return 0;
    return result.impacts.reduce((sum, i) => sum + (contractsById.get(i.contract_id)?.value ?? 0), 0);
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
      <div className="w-full max-w-[1280px] mx-auto grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="flex flex-col items-center gap-8 min-w-0">
          <form onSubmit={onSubmit} className="glass-panel w-full max-w-2xl p-6">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-brass" strokeWidth={1.6} />
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
                Simulate Impact
              </p>
            </div>
            <h2 className="mt-3 font-display text-[22px] leading-[1.15] tracking-tight text-foreground">
              Paste a proposed regulation
            </h2>
            <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
              The model cross-references it against the full ontology and contract corpus,
              then lights up affected agreements.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the full regulation text here — e.g. a proposed amendment to capital adequacy rules, a new disclosure requirement, or a draft executive order…"
              rows={7}
              disabled={status === "loading"}
              className="mt-4 w-full resize-y rounded-[12px] border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] p-4 text-[13.5px] leading-[1.6] text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--hairline-strong)] duration-150 ease-out transition-colors font-sans"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setText(DEMO_TEXT)}
                disabled={status === "loading"}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-brass duration-150 ease-out transition-colors"
              >
                Load demo regulation →
              </button>
              <button
                type="submit"
                disabled={!text.trim() || status === "loading"}
                className="inline-flex items-center gap-2 rounded-[12px] bg-[var(--brass)] px-5 py-2.5 text-[13px] font-medium text-[var(--primary-foreground)] shadow-[var(--glow-brass)] hover:bg-[var(--brass-strong)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed duration-150 ease-out transition-all"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    Simulating…
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5" strokeWidth={2} />
                    Simulate Impact
                  </>
                )}
              </button>
            </div>
            {error && (
              <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk)]" />
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
                {error}
              </p>
            )}
          </form>


          <GraphMedallion
            contracts={contracts}
            regulations={regulations}
            impacts={impactMap.size > 0 ? impactMap : undefined}
            pulsing={status === "loading"}
          />
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
                  Blast Radius
                </p>
                {result.fallback && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground border border-[var(--hairline)] rounded-full px-2 py-0.5">
                    Demo fallback
                  </span>
                )}
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Total estimated exposure
              </p>
              <p className="mt-1 font-display text-[40px] leading-[1] tracking-tight text-[var(--risk)] tabular-nums">
                {formatUSD(totalExposure)}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                across {sortedImpacts.length} contract{sortedImpacts.length === 1 ? "" : "s"}
              </p>

              {result.summary && (
                <p className="mt-5 text-[12.5px] leading-[1.6] text-muted-foreground border-t border-[var(--hairline)] pt-4">
                  {result.summary}
                </p>
              )}

              <div className="mt-5 border-t border-[var(--hairline)] pt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
                  Affected contracts
                </p>
                <ul className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1 -mr-1">
                  {sortedImpacts.map((i) => {
                    const c = contractsById.get(i.contract_id);
                    if (!c) return null;
                    return (
                      <li
                        key={i.contract_id}
                        className="rounded-[12px] border border-[var(--hairline)] p-3 hover:border-[var(--hairline-strong)] duration-150 ease-out transition-colors"
                      >

                        <div className="flex items-center justify-between gap-2">
                          <Link
                            to="/contracts/$contractId"
                            params={{ contractId: c.id }}
                            className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass hover:underline"
                          >
                            {c.id}
                          </Link>
                          <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
                            <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[i.severity]}`} />
                            {SEV_LABEL[i.severity]}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] leading-tight text-foreground">
                          {c.name}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground tabular-nums">
                          {formatUSD(c.value)}
                        </p>
                        <p className="mt-2 text-[12px] leading-[1.55] text-muted-foreground">
                          {i.suggested_amendment}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </aside>

        {status === "done" && result && (
          <div className="lg:col-span-2">
            <ActionPlanPanel
              regulationText={text}
              summary={result.summary}
              impacts={sortedImpacts.map((i) => {
                const c = contractsById.get(i.contract_id);
                return {
                  contract_id: i.contract_id,
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
