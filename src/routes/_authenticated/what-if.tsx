import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FlaskConical, Loader2, Zap, AlertTriangle } from "lucide-react";
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
    text: "All AI-assisted financial decisioning is reclassified as high-risk. Providers must publish real-time model performance drift metrics and obtain explicit renewed consent from every affected data subject within 90 days of any material model retraining.",
  },
  {
    label: "Cross-border data escrow",
    text: "All personal data of EU residents processed outside the EU must be held in a bonded escrow with EU-resident cryptographic keys. Extraterritorial requests trigger mandatory 30-day notification to the data subject before any disclosure.",
  },
  {
    label: "Instant payment reversibility",
    text: "Any consumer-initiated payment above €500 becomes reversible for 72 hours without cause. Merchants must maintain a segregated liquidity reserve equal to 5% of the trailing 30-day gross volume to cover reversal exposure.",
  },
];

export function WhatIfSandbox() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: regulations } = useSuspenseQuery(regulationsQuery);
  const runSimulate = useServerFn(simulateImpact);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contractsById = useMemo(() => {
    const m = new Map<string, (typeof contracts)[number]>();
    contracts.forEach((c) => m.set(c.id, c));
    return m;
  }, [contracts]);

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
      const av = contractsById.get(a.contract_id)?.value ?? 0;
      const bv = contractsById.get(b.contract_id)?.value ?? 0;
      return bv - av;
    });
  }, [result, contractsById]);

  const totalExposure = useMemo(() => {
    if (!result) return 0;
    return result.impacts.reduce(
      (sum, i) => sum + (contractsById.get(i.contract_id)?.value ?? 0),
      0,
    );
  }, [result, contractsById]);

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
      <div className="w-full max-w-[1280px] mx-auto">
        <header className="max-w-2xl mb-8">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-brass" strokeWidth={1.6} />
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
              What-If Sandbox
            </p>
          </div>
          <h1 className="mt-3 font-display text-[32px] leading-[1.1] tracking-tight text-foreground">
            Stress-test any rule you can imagine.
          </h1>
          <p className="mt-3 text-[13.5px] leading-[1.65] text-muted-foreground">
            Paste an entirely hypothetical regulation — one that doesn't exist and may never exist —
            and run it through the same blast-radius pipeline as a real filing. Nothing is stored
            as a real regulation; runs are tagged{" "}
            <span className="font-mono text-[11.5px] text-brass">what_if</span>.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
          <div className="min-w-0 flex flex-col gap-6">
            <div className="glass-panel p-6">
              <label className="block font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
                Hypothetical regulation text
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste or write the rule you want to stress-test…"
                rows={9}
                className="mt-3 w-full resize-y rounded-[12px] border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] p-4 font-mono text-[12.5px] leading-[1.6] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-brass/60 focus:ring-2 focus:ring-brass/30 duration-150 ease-out transition-colors"
              />
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground mr-1">
                  Presets:
                </span>
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setText(p.text)}
                    className="rounded-full border border-[var(--hairline)] px-3 py-1 font-mono text-[10.5px] text-muted-foreground hover:text-brass hover:border-brass/50 duration-150 ease-out transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 pt-4 border-t border-[var(--hairline)]">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Adversarial scenario · not a legal claim
                </p>
                <button
                  onClick={onSimulate}
                  disabled={status === "loading" || !text.trim()}
                  className="inline-flex items-center gap-2 rounded-[12px] bg-[var(--brass)] px-4 py-2.5 text-[13px] font-medium text-[var(--primary-foreground)] shadow-[var(--glow-brass)] hover:bg-[var(--brass-strong)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed duration-150 ease-out transition-all"
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Simulating…
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5" strokeWidth={2} /> Simulate impact
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

            <GraphMedallion
              contracts={contracts}
              regulations={regulations}
              impacts={impactMap.size > 0 ? impactMap : undefined}
              pulsing={status === "loading"}
            />

            {result && (
              <ActionPlanPanel
                regulationText={text}
                summary={result.summary}
                impacts={result.impacts.map((i) => ({
                  contract_id: i.contract_id,
                  contract_name: contractsById.get(i.contract_id)?.name ?? i.contract_id,
                  severity: i.severity,
                  suggested_amendment: i.suggested_amendment,
                }))}
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
                    What-if exposure
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
                  across {sortedImpacts.length} contract{sortedImpacts.length === 1 ? "" : "s"}
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
