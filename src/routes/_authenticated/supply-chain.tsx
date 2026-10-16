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
      {
        name: "description",
        content:
          "Trace how a regulation propagates across counterparty contracts three hops upstream.",
      },
      { property: "og:title", content: "Supply Chain Blast Radius — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Trace how a regulation propagates across counterparty contracts three hops upstream.",
      },
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
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
              <Network className="h-3 w-3" strokeWidth={1.8} /> Supply Chain Blast Radius
            </p>
            <h1 className="mt-2 font-display text-[34px] leading-[1.05] tracking-tight text-foreground">
              Cross-enterprise cascade
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-[1.6] text-muted-foreground max-w-xl">
              Contract dependencies form the edges. When a regulation hits any upstream provider,
              exposure flows back to your organization through every intervening SLA.
            </p>
          </div>
        </div>

        <div className="glass-panel p-5 flex flex-col gap-3">
          <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Proposed regulation
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a proposed rule or amendment…"
            rows={4}
            className="w-full resize-y rounded-[12px] border border-[var(--hairline-strong)] bg-[var(--surface-glass)] px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]/60"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                setText(DEMO_TEXT);
                onSimulate(DEMO_TEXT);
              }}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brass)] transition-colors duration-200 hover:underline"
            >
              Load EU Data-Center Energy demo →
            </button>
            <button
              onClick={() => onSimulate()}
              disabled={!text.trim() || status === "loading"}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-5 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 ease-out hover:-translate-y-px hover:bg-[var(--brass-strong)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Simulating…
                </>
              ) : (
                <>
                  <Waves className="h-3.5 w-3.5" strokeWidth={2} /> Simulate cascade
                </>
              )}
            </button>
          </div>
          {error && (
            <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk)]" /> {error}
            </p>
          )}
        </div>

        <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
          <div className="glass-panel p-4">
            <SupplyChainGraph
              nodes={chain.nodes}
              edges={chain.edges}
              hits={hitMap}
              animating={status === "done"}
              selectedId={selected?.id ?? null}
              onNodeClick={(n) => setSelected(n)}
            />
          </div>

          <div className="flex flex-col gap-4">
            {result ? (
              <>
                <div className="glass-panel p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
                    Indirect exposure
                  </p>
                  <p className="mt-2 font-mono text-[30px] text-foreground">
                    {formatUSD(result.total_indirect_exposure)}
                  </p>
                  <p className="mt-1 text-[12.5px] leading-[1.55] text-muted-foreground">
                    {result.summary}
                    {result.fallback && " · deterministic fallback"}
                  </p>
                </div>

                <div className="glass-panel p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
                    Cascade trace
                  </p>
                  <ol className="flex flex-col gap-2.5">
                    {orderedHits.map((h) => {
                      const n = nodesById.get(h.node_id);
                      if (!n) return null;
                      return (
                        <li
                          key={h.node_id}
                          className="rounded-[12px] border border-[var(--hairline)] p-3 transition-colors duration-200 hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-glass)]"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brass)]">
                                Hop {h.hop}
                              </span>
                              <span className="text-[13px] text-foreground">{n.name}</span>
                            </div>
                            <span
                              className="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-0.5 rounded-full"
                              style={{
                                color: h.severity === "high" ? "var(--risk)" : "var(--brass)",
                                borderWidth: 1,
                                borderStyle: "solid",
                                borderColor: "var(--hairline-strong)",
                              }}
                            >
                              {h.severity}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[12.5px] leading-[1.55] text-foreground/85">
                            {h.reason}
                          </p>
                          {h.broken_clause && (
                            <p className="mt-1 text-[11.5px] text-muted-foreground">
                              <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] mr-1.5">
                                Clause
                              </span>
                              {h.broken_clause}
                            </p>
                          )}
                          {h.indirect_exposure_usd > 0 && (
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                              at risk: {formatUSD(h.indirect_exposure_usd)}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>

                <div className="glass-panel p-5">
                  <p className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
                    <ShieldAlert className="h-3 w-3" strokeWidth={1.8} /> Remediation
                  </p>
                  <ul className="flex flex-col gap-2">
                    {result.remediation.map((r, i) => (
                      <li
                        key={i}
                        className="rounded-[12px] border border-[var(--hairline)] px-3 py-2 text-[12.5px] leading-[1.55] text-foreground/90"
                      >
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="glass-panel p-8 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Awaiting simulation
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground leading-[1.6]">
                  Paste a regulation or run the EU data-center demo to see the cascade propagate.
                </p>
              </div>
            )}
          </div>
        </div>

        {result && orderedHits.length > 0 && (
          <ComplianceCodePanel
            regulationText={text || DEMO_TEXT}
            simulationRunId={result.run_id ?? undefined}

            gap={
              orderedHits[0]?.broken_clause
                ? `${orderedHits[0].broken_clause} (${nodesById.get(orderedHits[0].node_id)?.name ?? "upstream provider"})`
                : "Upstream provider non-compliance"
            }
          />
        )}
      </div>
    </AppShell>
  );
}
