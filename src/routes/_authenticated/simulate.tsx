import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { 
  Zap, 
  AlertTriangle, 
  Loader2, 
  Sparkles, 
  LayoutList, 
  LayoutGrid, 
  ShieldAlert, 
  Layers, 
  DollarSign, 
  ArrowRight, 
  CheckCircle2, 
  ExternalLink,
  RotateCcw,
  Network,
  Waves,
  Building2,
  Globe2,
  FlaskConical,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { GraphMedallion } from "@/components/clausegraph/GraphMedallion";
import { SupplyChainGraph } from "@/components/clausegraph/SupplyChainGraph";
import { ComplianceCodePanel } from "@/components/clausegraph/ComplianceCodePanel";
import { contractsQuery, regulationsQuery, formatUSD } from "@/data/queries";
import { simulateImpact } from "@/lib/simulate.functions";
import type { ImpactEntry, Severity, SimulationResult } from "@/lib/simulate-types";
import {
  getSupplyChain,
  simulateSupplyChainImpact,
  type CascadeHit,
  type CascadeResult,
  type ChainNode,
} from "@/lib/supply-chain.functions";
import { ActionPlanPanel } from "@/components/clausegraph/ActionPlanPanel";
import { StaleCitationVerificationPanel } from "@/components/clausegraph/StaleCitationVerificationPanel";
import { handlePlanLimitError } from "@/components/PlanLimitDialog";
import { RouteError } from "@/components/clausegraph/RouteError";

const chainQuery = queryOptions({
  queryKey: ["supply-chain"],
  queryFn: () => getSupplyChain(),
});

interface SimulateSearch {
  text?: string;
  regId?: string;
  agency?: string;
  tab?: "portfolio" | "supply-chain" | "what-if";
}

export const Route = createFileRoute("/_authenticated/simulate")({
  validateSearch: (search: Record<string, unknown>): SimulateSearch => ({
    text: typeof search.text === "string" ? search.text : undefined,
    regId: typeof search.regId === "string" ? search.regId : undefined,
    agency: typeof search.agency === "string" ? search.agency : undefined,
    tab:
      search.tab === "supply-chain"
        ? "supply-chain"
        : search.tab === "what-if"
        ? "what-if"
        : "portfolio",
  }),
  head: () => ({
    meta: [
      { title: "Impact & Propagation Simulator — ClauseGraph" },
      {
        name: "description",
        content:
          "Cross-reference proposed draft legislation against your direct contracts and upstream supply chain dependencies.",
      },
      { property: "og:title", content: "Impact & Propagation Simulator — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Cross-reference proposed draft legislation against your direct contracts and upstream supply chain dependencies.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(contractsQuery),
      context.queryClient.ensureQueryData(regulationsQuery),
      context.queryClient.ensureQueryData(chainQuery),
    ]),
  component: SimulatePage,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Simulator unavailable" error={error} reset={reset} />
  ),
});

const SEV_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
const SEV_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };
const SEV_DOT: Record<Severity, string> = {
  high: "bg-[var(--risk)] shadow-[0_0_8px_var(--risk)]",
  medium: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]",
  low: "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]",
};
const SEV_BADGE: Record<Severity, string> = {
  high: "text-[var(--risk)] border-[var(--risk)]/30 bg-[var(--risk)]/10",
  medium: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  low: "text-blue-400 border-blue-500/30 bg-blue-500/10",
};

interface PresetScenario {
  id: string;
  title: string;
  sector: string;
  tag: string;
  text: string;
  scope: "portfolio" | "supply-chain" | "what-if";
}

const PRESET_SCENARIOS: PresetScenario[] = [
  {
    id: "basel-iv",
    title: "Basel IV Capital Accord",
    sector: "Banking & Derivatives",
    tag: "Prudential Risk",
    scope: "portfolio",
    text: `Effective January 1, all covered financial institutions must maintain a minimum common equity tier 1 capital ratio of 11.5% and apply revised risk-weight schedules to unsecured credit facilities and long-dated derivatives exposures. Counterparties must be notified within 30 days of any material change to internal risk models.`,
  },
  {
    id: "eu-ai-act",
    title: "EU AI Act High-Risk Mandate",
    sector: "AI & Technology Governance",
    tag: "High-Risk AI",
    scope: "portfolio",
    text: `All algorithmic systems deployed for credit scoring, employment qualification, or systemic risk assessment must maintain human-in-the-loop audit logs, continuous bias mitigation protocols, and real-time incident reporting to national supervisory authorities within 72 hours of material deviation.`,
  },
  {
    id: "synthetic-ai-tightening",
    title: "Aggressive AI Act Tightening",
    sector: "AI Governance & Data Subject",
    tag: "What-If Lab",
    scope: "what-if",
    text: `All AI-assisted financial decisioning is reclassified as high-risk. Providers must publish real-time model performance drift metrics and obtain explicit renewed consent from every affected data subject within 90 days of any material model retraining.`,
  },
  {
    id: "cross-border-escrow",
    title: "Cross-Border Data Escrow",
    sector: "Data Sovereignty & Privacy",
    tag: "What-If Lab",
    scope: "what-if",
    text: `All personal data of EU residents processed outside the EU must be held in a bonded escrow with EU-resident cryptographic keys. Extraterritorial requests trigger mandatory 30-day notification to the data subject before any disclosure.`,
  },
  {
    id: "instant-payment-reversibility",
    title: "Instant Payment Reversibility",
    sector: "Payment Fintech & Settlement",
    tag: "What-If Lab",
    scope: "what-if",
    text: `Any consumer-initiated payment above €500 becomes reversible for 72 hours without cause. Merchants must maintain a segregated liquidity reserve equal to 5% of the trailing 30-day gross volume to cover reversal exposure.`,
  },
  {
    id: "eu-datacenter",
    title: "EU Data Center Energy Directive",
    sector: "Data Hosting & Colocation",
    tag: "Tier-3 Upstream",
    scope: "supply-chain",
    text: `Directive 2026/xx on Energy Efficiency for Data Centres: All colocation and hosting facilities operating within the EU with an installed IT power capacity exceeding 100 kW must maintain a rolling 12-month Power Usage Effectiveness (PUE) below 1.3 and source at least 60% of consumed electricity from renewable sources by January 1. Facilities in breach lose their operating permit and any downstream service contracts relying on them are deemed frustrated at law.`,
  },
  {
    id: "dora-cloud",
    title: "DORA Critical Cloud Resilience",
    sector: "Cloud & Multi-Tenant Infra",
    tag: "Tier-2 Multi-Hop",
    scope: "supply-chain",
    text: `Digital Operational Resilience Act (DORA) Technical Standard 2026/04: All financial institutions must mandate that cloud infrastructure providers (IaaS/PaaS) demonstrate automated multi-region replication with zero data loss (RPO = 0) and tested failover times under 60 minutes. Failure to provide quarterly audit certificates obligates immediate migration within 90 days.`,
  },
];

function SimulatePage() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: regulations } = useSuspenseQuery(regulationsQuery);
  const { data: chain } = useSuspenseQuery(chainQuery);

  const search = Route.useSearch();
  const runSimulate = useServerFn(simulateImpact);
  const runSupplyChain = useServerFn(simulateSupplyChainImpact);

  const navigate = Route.useNavigate();

  // Active Scope Tab: 'portfolio' (Direct) vs 'supply-chain' (Upstream Cascade) vs 'what-if' (Sandbox)
  const [activeTab, setActiveTab] = useState<"portfolio" | "supply-chain" | "what-if">(
    search.tab === "supply-chain"
      ? "supply-chain"
      : search.tab === "what-if"
      ? "what-if"
      : "portfolio"
  );

  const [text, setText] = useState("");
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  // Direct Portfolio Simulation State
  const [portStatus, setPortStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [portResult, setPortResult] = useState<SimulationResult | null>(null);
  const [portError, setPortError] = useState<string | null>(null);
  const [portViewMode, setPortViewMode] = useState<"table" | "cards">("table");
  const [severityFilter, setSeverityFilter] = useState<"all" | Severity>("all");

  // Supply Chain Cascade Simulation State
  const [chainStatus, setChainStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [chainResult, setChainResult] = useState<CascadeResult | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [chainViewMode, setChainViewMode] = useState<"table" | "cards">("table");
  const [selectedChainNode, setSelectedChainNode] = useState<ChainNode | null>(null);
  const [hopFilter, setHopFilter] = useState<"all" | number>("all");

  // Handler to switch tabs and keep URL in perfect sync
  function handleTabChange(tab: "portfolio" | "supply-chain" | "what-if") {
    setActiveTab(tab);
    navigate({
      search: (prev) => ({ ...prev, tab }),
      replace: true,
    });
  }

  // Sync initial URL search text only once or if URL search.text explicitly changes
  useEffect(() => {
    if (search.text && !text) {
      setText(search.text);
    }
  }, [search.text]);

  // Sync search.tab ONLY when search.tab explicitly changes in URL navigation
  useEffect(() => {
    if (search.tab && search.tab !== activeTab) {
      setActiveTab(search.tab);
    }
  }, [search.tab]);

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

  // Direct Portfolio Computations with robust ID mapping
  const impactMap = useMemo(() => {
    const m = new Map<string, Severity>();
    portResult?.impacts.forEach((i) => {
      const resolved = resolveContract(i.contract_id);
      if (resolved?.id) {
        m.set(resolved.id, i.severity);
      } else {
        m.set(i.contract_id, i.severity);
      }
    });
    return m;
  }, [portResult, resolveContract]);

  const totalExposure = useMemo(() => {
    if (!portResult) return 0;
    return portResult.impacts.reduce((sum, i) => sum + (resolveContract(i.contract_id)?.value ?? 0), 0);
  }, [portResult, resolveContract]);

  const portfolioTotalValue = useMemo(() => {
    return contracts.reduce((sum, c) => sum + c.value, 0);
  }, [contracts]);

  const exposurePercentage = useMemo(() => {
    if (!portfolioTotalValue || !totalExposure) return 0;
    return Math.min(100, (totalExposure / portfolioTotalValue) * 100);
  }, [totalExposure, portfolioTotalValue]);

  const sortedImpacts: ImpactEntry[] = useMemo(() => {
    if (!portResult) return [];
    return [...portResult.impacts].sort((a, b) => {
      const s = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
      if (s !== 0) return s;
      const av = resolveContract(a.contract_id)?.value ?? 0;
      const bv = resolveContract(b.contract_id)?.value ?? 0;
      return bv - av;
    });
  }, [portResult, resolveContract]);

  const filteredImpacts = useMemo(() => {
    if (severityFilter === "all") return sortedImpacts;
    return sortedImpacts.filter((i) => i.severity === severityFilter);
  }, [sortedImpacts, severityFilter]);

  const highSeverityCount = useMemo(() => {
    return sortedImpacts.filter((i) => i.severity === "high").length;
  }, [sortedImpacts]);

  const mediumSeverityCount = useMemo(() => {
    return sortedImpacts.filter((i) => i.severity === "medium").length;
  }, [sortedImpacts]);

  const lowSeverityCount = useMemo(() => {
    return sortedImpacts.filter((i) => i.severity === "low").length;
  }, [sortedImpacts]);

  // Supply Chain Computations
  const nodesById = useMemo(() => new Map(chain.nodes.map((n) => [n.id, n])), [chain.nodes]);
  const chainHitMap = useMemo(() => {
    const m = new Map<string, CascadeHit>();
    chainResult?.hits.forEach((h) => m.set(h.node_id, h));
    return m;
  }, [chainResult]);

  const orderedHits = useMemo(
    () => (chainResult ? [...chainResult.hits].sort((a, b) => a.hop - b.hop) : []),
    [chainResult],
  );

  const filteredHits = useMemo(() => {
    if (hopFilter === "all") return orderedHits;
    return orderedHits.filter((h) => h.hop === hopFilter);
  }, [orderedHits, hopFilter]);

  const highSeverityHitsCount = useMemo(() => {
    return orderedHits.filter((h) => h.severity === "high").length;
  }, [orderedHits]);

  const tierCount = useMemo(() => {
    const tiers = new Set(chain.nodes.map((n) => n.tier));
    return tiers.size;
  }, [chain.nodes]);

  // Handler for scenario selection (respects user's active tab without forcing unexpected tab switches)
  function handleSelectPreset(preset: PresetScenario) {
    setText(preset.text);
    setActiveScenarioId(preset.id);
  }

  // Execute Direct Portfolio Simulation
  async function handleSimulatePortfolio(textInput?: string) {
    const targetText = (textInput || text).trim();
    if (!targetText || portStatus === "loading") return;
    setPortStatus("loading");
    setPortError(null);
    setPortResult(null);
    const startedAt = Date.now();
    try {
      const res = await runSimulate({ data: { regulationText: targetText } });
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1200) await new Promise((r) => setTimeout(r, 1200 - elapsed));
      setPortResult(res);
      setPortStatus("done");
    } catch (err) {
      if (handlePlanLimitError(err, "simulations")) {
        setPortStatus("idle");
        return;
      }
      setPortError(err instanceof Error ? err.message : "Simulation failed");
      setPortStatus("error");
    }
  }

  // Execute Upstream Supply Chain Cascade Simulation
  async function handleSimulateSupplyChain(textInput?: string) {
    const targetText = (textInput || text).trim();
    if (!targetText || chainStatus === "loading") return;
    setChainStatus("loading");
    setChainError(null);
    setChainResult(null);
    setSelectedChainNode(null);
    const startedAt = Date.now();
    try {
      const res = await runSupplyChain({ data: { regulationText: targetText } });
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1200) await new Promise((r) => setTimeout(r, 1200 - elapsed));
      setChainResult(res);
      setChainStatus("done");
    } catch (err) {
      if (handlePlanLimitError(err)) {
        setChainStatus("idle");
        return;
      }
      setChainError(err instanceof Error ? err.message : "Cascade simulation failed");
      setChainStatus("error");
    }
  }

  // Run according to active tab
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeTab === "portfolio") {
      await handleSimulatePortfolio();
    } else if (activeTab === "what-if") {
      const targetText = text.trim();
      if (!targetText || portStatus === "loading") return;
      setPortStatus("loading");
      setPortError(null);
      setPortResult(null);
      const startedAt = Date.now();
      try {
        const res = await runSimulate({
          data: { regulationText: targetText, runType: "what_if" },
        });
        const elapsed = Date.now() - startedAt;
        if (elapsed < 1200) await new Promise((r) => setTimeout(r, 1200 - elapsed));
        setPortResult(res);
        setPortStatus("done");
      } catch (err) {
        if (handlePlanLimitError(err, "simulations")) {
          setPortStatus("idle");
          return;
        }
        setPortError(err instanceof Error ? err.message : "Sandbox simulation failed");
        setPortStatus("error");
      }
    } else {
      await handleSimulateSupplyChain();
    }
  }

  function handleReset() {
    setText("");
    setActiveScenarioId(null);
    if (activeTab === "portfolio" || activeTab === "what-if") {
      setPortResult(null);
      setPortStatus("idle");
      setPortError(null);
    } else {
      setChainResult(null);
      setSelectedChainNode(null);
      setChainStatus("idle");
      setChainError(null);
    }
  }

  const currentLoading =
    activeTab === "portfolio" || activeTab === "what-if"
      ? portStatus === "loading"
      : chainStatus === "loading";
  const currentError =
    activeTab === "portfolio" || activeTab === "what-if" ? portError : chainError;

  return (
    <AppShell>
      <div className="w-full max-w-[1400px] mx-auto space-y-8">
        
        {/* Top Header & Context Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Regulatory Impact Engine &middot; Unified Blast Center
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Simulate Regulatory Propagation
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Cross-reference draft legislation, agency rules, or statutory directives against your direct contract agreements and multi-hop upstream supply chain vendors.
            </p>
          </div>

          {/* Quick Metrics Ribbon based on active scope */}
          <div className="flex flex-wrap items-center gap-3">
            {activeTab === "portfolio" ? (
              <>
                <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 px-4 py-2.5 backdrop-blur-md">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Portfolio Base</span>
                  <span className="font-mono text-sm font-semibold text-foreground">{contracts.length} Agreements ({formatUSD(portfolioTotalValue)})</span>
                </div>
                <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 px-4 py-2.5 backdrop-blur-md">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Frameworks</span>
                  <span className="font-mono text-sm font-semibold text-foreground">{regulations.length} Indexed</span>
                </div>
              </>
            ) : activeTab === "supply-chain" ? (
              <>
                <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 px-4 py-2.5 backdrop-blur-md">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Network Depth</span>
                  <span className="font-mono text-sm font-semibold text-foreground">{tierCount} Upstream Tiers</span>
                </div>
                <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 px-4 py-2.5 backdrop-blur-md">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Mapped Entities</span>
                  <span className="font-mono text-sm font-semibold text-foreground">{chain.nodes.length} Nodes ({chain.edges.length} SLA Edges)</span>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 backdrop-blur-md">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-amber-400 font-semibold">Sandbox Execution</span>
                  <span className="font-mono text-sm font-semibold text-foreground">Isolated Run Mode</span>
                </div>
                <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 px-4 py-2.5 backdrop-blur-md">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Target Corpus</span>
                  <span className="font-mono text-sm font-semibold text-foreground">{contracts.length} Active Instruments</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Engine Scope Switcher (Segmented Tab Bar) */}
        <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 p-2 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl shadow-sm">
          <div className="inline-flex items-center rounded-xl switcher-track p-1 gap-1.5 shrink-0">
            {/* Direct Portfolio Tab Button */}
            <button
              type="button"
              onClick={() => handleTabChange("portfolio")}
              className={`group relative inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === "portfolio"
                  ? "bg-[var(--brass)] text-[var(--primary-foreground)] shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
              }`}
            >
              <Zap className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${activeTab === "portfolio" ? "fill-current" : "text-[var(--brass)]"}`} />
              <span>Direct Portfolio</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full border ${
                activeTab === "portfolio"
                  ? "bg-black/20 text-[var(--primary-foreground)] border-black/20 font-bold"
                  : "bg-black/5 dark:bg-white/[0.05] text-foreground border-[var(--hairline)] dark:border-white/10"
              }`}>
                {contracts.length}
              </span>
            </button>

            {/* Upstream Supply Chain Tab Button */}
            <button
              type="button"
              onClick={() => handleTabChange("supply-chain")}
              className={`group relative inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === "supply-chain"
                  ? "bg-[var(--brass)] text-[var(--primary-foreground)] shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
              }`}
            >
              <Network className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${activeTab === "supply-chain" ? "text-[var(--primary-foreground)]" : "text-[var(--brass)]"}`} />
              <span>Supply Chain Cascade</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full border ${
                activeTab === "supply-chain"
                  ? "bg-black/20 text-[var(--primary-foreground)] border-black/20 font-bold"
                  : "bg-black/5 dark:bg-white/[0.05] text-foreground border-[var(--hairline)] dark:border-white/10"
              }`}>
                {chain.nodes.length} nodes
              </span>
            </button>

            {/* What-If Sandbox Tab Button */}
            <button
              type="button"
              onClick={() => handleTabChange("what-if")}
              className={`group relative inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer whitespace-nowrap ${
                activeTab === "what-if"
                  ? "bg-[var(--brass)] text-[var(--primary-foreground)] shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
              }`}
            >
              <FlaskConical className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${activeTab === "what-if" ? "text-[var(--primary-foreground)]" : "text-[var(--brass)]"}`} />
              <span>What-If Sandbox</span>
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full border ${
                activeTab === "what-if"
                  ? "bg-black/20 text-[var(--primary-foreground)] border-black/20 font-bold"
                  : "bg-black/5 dark:bg-white/[0.05] text-foreground border-[var(--hairline)] dark:border-white/10"
              }`}>
                Isolated
              </span>
            </button>
          </div>

          {/* Right Status Capsule */}
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/5 bg-white/[0.02] text-[11px] text-muted-foreground font-mono truncate max-w-sm ml-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)] animate-pulse shrink-0" />
            <span className="truncate">
              {activeTab === "portfolio"
                ? "Direct Contract SLAs & Capital Exposure"
                : activeTab === "supply-chain"
                ? "3-Hop Vendor Dependencies"
                : "Adversarial Compliance Lab"}
            </span>
          </div>
        </div>

        {/* Preset Stress Test Scenarios Bar */}
        <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/40 p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--brass)]" />
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-foreground">
                Pre-Configured Stress Test Scenarios
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              Click any scenario to load into your active simulator
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PRESET_SCENARIOS.map((p) => {
              const isSelected = activeScenarioId === p.id;
              const isRecommendedForCurrentTab = p.scope === activeTab;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  disabled={currentLoading}
                  data-copilot-context={JSON.stringify({
                    type: "simulation_run",
                    id: p.id,
                    title: p.title,
                    content: `Preset Stress Test Scenario '${p.title}' [${p.tag}]. Sector: ${p.sector}, Scope: ${p.scope}. Prompt draft: ${p.text.slice(0, 160)}...`,
                    metadata: { tag: p.tag, sector: p.sector, scope: p.scope },
                  })}
                  className={`group relative text-left rounded-xl border p-3 transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? "scenario-card-selected"
                      : isRecommendedForCurrentTab
                      ? "scenario-card-recommended"
                      : "scenario-card opacity-90 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-mono text-[10px] font-semibold text-[var(--brass)] uppercase tracking-wider truncate">
                      {p.tag}
                    </span>
                    {isSelected ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--brass)] shrink-0" />
                    ) : isRecommendedForCurrentTab ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)]/70 shrink-0" title="Recommended for active mode" />
                    ) : null}
                  </div>
                  <h4 className="font-display text-xs font-semibold text-foreground group-hover:text-[var(--brass)] transition-colors truncate">
                    {p.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {p.sector} &middot; <span className="uppercase text-[9px] font-mono">{p.scope}</span>
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Top 2 Cards: Left = Regulation Input, Right = Dynamic Assessment */}
        <div className="grid gap-6 lg:grid-cols-12 items-stretch">
          
          {/* Top Left (6 cols): Shared Input Card */}
          <div className="lg:col-span-6 flex flex-col">
            <form
              onSubmit={onSubmit}
              className="group relative flex flex-col justify-between h-full overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 sm:p-7 backdrop-blur-xl transition-all duration-300 ease-out hover:border-[color-mix(in_oklab,var(--brass)_45%,transparent)] hover:shadow-[0_20px_50px_-18px_rgba(94,234,212,0.22)]"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-[var(--brass)]/10 blur-3xl" />

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--brass)] transition-all duration-300 group-hover:border-[var(--hairline-strong)] group-hover:bg-[color-mix(in_oklab,var(--brass)_15%,transparent)]">
                      {activeTab === "portfolio" ? (
                        <Zap className="h-4 w-4" />
                      ) : activeTab === "supply-chain" ? (
                        <Network className="h-4 w-4" />
                      ) : (
                        <FlaskConical className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <h2 className="font-display text-[17px] font-semibold tracking-tight text-foreground">
                        {activeTab === "portfolio"
                          ? "Proposed Regulatory Mandate"
                          : activeTab === "supply-chain"
                          ? "Upstream Disruption Directive"
                          : "Adversarial Synthetic Rule Formulation"}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {activeTab === "portfolio" 
                          ? "Input amendment to calculate direct portfolio blast radius" 
                          : activeTab === "supply-chain"
                          ? "Input rule to trace 3-hop supplier breach & frustration risks"
                          : "Input hypothetical statutory decree to test isolated contract fragility"}
                      </p>
                    </div>
                  </div>

                  {text && (
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={currentLoading}
                      className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                {/* Textarea Area */}
                <div className="relative mt-5">
                  <textarea
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setActiveScenarioId(null);
                    }}
                    placeholder={
                      activeTab === "portfolio"
                        ? "Paste statutory amendment or regulatory draft here (e.g. 'Effective January 1, covered institutions must maintain minimum Tier-1 capital of 11.5%…')"
                        : activeTab === "supply-chain"
                        ? "Paste supply chain due diligence directive or data center rule (e.g. 'All colocation hosting facilities must maintain PUE below 1.3…')"
                        : "Formulate or paste any hypothetical rule (e.g. 'All AI-assisted financial decisioning is reclassified as high-risk, triggering mandatory 90-day re-consenting…')"
                    }
                    rows={8}
                    disabled={currentLoading}
                    className="w-full resize-none rounded-xl border search-input-theme p-4 text-[13.5px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--hairline-strong)] focus:outline-none focus:ring-1 focus:ring-[var(--brass)] duration-200 transition-all font-sans"
                  />
                  {text && (
                    <span className="absolute bottom-3 right-3 font-mono text-[10px] select-none px-2 py-0.5 rounded border char-counter-pill">
                      {text.length} chars &middot; ~{Math.ceil(text.split(/\s+/).length)} words
                    </span>
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div className="mt-5 pt-4 border-t border-[var(--hairline)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--brass)] shadow-[0_0_8px_var(--brass)]" />
                    <span>
                      {activeTab === "portfolio"
                        ? "Deterministic semantic vector mapping"
                        : activeTab === "supply-chain"
                        ? "Recursive multi-tier cascade traversal"
                        : "Adversarial isolated sandbox execution (zero filing impact)"}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={!text.trim() || currentLoading}
                    className="relative inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brass)] px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--primary-foreground)] shadow-[0_10px_30px_-10px_rgba(94,234,212,0.45)] hover:bg-[var(--brass-strong)] hover:shadow-[0_14px_36px_-8px_rgba(94,234,212,0.6)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                  >
                    {currentLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                        <span>Propagating Blast Radius&hellip;</span>
                      </>
                    ) : (
                      <>
                        {activeTab === "portfolio" ? (
                          <Zap className="h-4 w-4 fill-current" />
                        ) : activeTab === "supply-chain" ? (
                          <Waves className="h-4 w-4" />
                        ) : (
                          <FlaskConical className="h-4 w-4" />
                        )}
                        <span>
                          {activeTab === "portfolio"
                            ? "Simulate Portfolio Impact"
                            : activeTab === "supply-chain"
                            ? "Simulate Supply Chain Cascade"
                            : "Run What-If Sandbox"}
                        </span>
                      </>
                    )}
                  </button>
                </div>

                {currentError && (
                  <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[var(--risk)]/20 bg-[var(--risk)]/10 px-4 py-3 text-xs text-[var(--risk)] animate-in fade-in duration-200">
                    <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} />
                    <span>{currentError}</span>
                  </div>
                )}
              </div>
            </form>
          </div>

          {/* Top Right (6 cols): Result or Idle based on activeTab */}
          <div className="lg:col-span-6 flex flex-col">
            {activeTab === "portfolio" || activeTab === "what-if" ? (
              portResult ? (
                /* Direct Portfolio / What-If Sandbox Result */
                <aside
                  data-copilot-context={JSON.stringify({
                    type: "simulation_run",
                    id: "active-simulation-result",
                    title: activeTab === "what-if" ? "What-If Shockwave Assessment" : "Direct Portfolio Blast Assessment",
                    content: `Direct Capital Exposure: ${formatUSD(totalExposure)} (${exposurePercentage.toFixed(1)}% of portfolio). Impacted Contracts: ${sortedImpacts.length} (${highSeverityCount} High, ${mediumSeverityCount} Medium). Executive Diagnosis: ${portResult.summary || "Evaluation completed."}`,
                    metadata: { totalExposure, exposurePercentage, highSeverityCount, mediumSeverityCount, impactsCount: sortedImpacts.length },
                  })}
                  className="group relative flex flex-col h-full rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 sm:p-7 backdrop-blur-xl shadow-[var(--shadow-soft)] space-y-5 animate-in fade-in duration-300 transition-all duration-300 hover:border-[color-mix(in_oklab,var(--risk)_40%,transparent)] hover:shadow-[0_20px_50px_-18px_rgba(225,82,75,0.22)]"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--risk)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-[var(--risk)] shadow-[0_0_8px_var(--risk)] animate-pulse" />
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--risk)]">
                        {activeTab === "what-if" ? "What-If Shockwave Assessment" : "Portfolio Blast Assessment"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeTab === "what-if" && (
                        <span className="font-mono text-[9px] uppercase tracking-wider text-amber-400 border border-amber-500/30 rounded-full px-2.5 py-0.5 bg-amber-500/10">
                          Isolated Sandbox
                        </span>
                      )}
                      {portResult.fallback && (
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground border border-[var(--hairline)] rounded-full px-2.5 py-0.5 bg-white/[0.03]">
                          Evaluation Seed
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 bg-emerald-500/10">
                        Evaluated Live
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-[16px] border border-[var(--risk)]/25 bg-gradient-to-br from-[var(--risk)]/15 via-[var(--risk)]/5 to-transparent p-5 backdrop-blur-md">
                    <div className="sm:col-span-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
                        Direct Capital Exposure
                      </p>
                      <p className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[var(--risk)] tabular-nums">
                        {formatUSD(totalExposure)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Represents <span className="font-semibold text-foreground font-mono">{exposurePercentage.toFixed(1)}%</span> of active portfolio value
                      </p>
                    </div>
                    <div className="flex flex-col justify-center sm:items-end border-t sm:border-t-0 sm:border-l border-[var(--hairline)] pt-3 sm:pt-0 sm:pl-4">
                      <span className="font-mono text-xl font-bold text-foreground tabular-nums">
                        {sortedImpacts.length}
                      </span>
                      <span className="text-xs text-muted-foreground">Impacted Contracts</span>
                      <div className="flex items-center gap-1.5 mt-2 font-mono text-[10px]">
                        <span className="text-[var(--risk)] font-semibold">{highSeverityCount} High</span>
                        <span className="text-muted-foreground">&middot;</span>
                        <span className="text-amber-400 font-semibold">{mediumSeverityCount} Med</span>
                      </div>
                    </div>
                  </div>

                  {portResult.summary && (
                    <div className="rounded-[14px] border border-white/5 bg-white/[0.02] p-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--brass)] font-semibold">
                          Executive Diagnosis
                        </p>
                        <span className="text-[10px] font-mono text-muted-foreground">Vector Alignment</span>
                      </div>
                      <p className="text-xs sm:text-[13px] leading-relaxed text-muted-foreground line-clamp-3">
                        {portResult.summary}
                      </p>
                    </div>
                  )}

                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                        Ranked Exposure ({sortedImpacts.length})
                      </p>
                      <a href="#portfolio-table" className="font-mono text-[10px] text-[var(--brass)] hover:underline">
                        View Breakdown &darr;
                      </a>
                    </div>

                    <ul className="flex flex-col gap-2 max-h-[190px] overflow-y-auto pr-1">
                      {sortedImpacts.slice(0, 4).map((i) => {
                        const c = resolveContract(i.contract_id);
                        if (!c) return null;
                        return (
                          <li key={i.contract_id} className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono font-semibold text-[var(--brass)]">{c.id}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono border ${SEV_BADGE[i.severity]}`}>
                                {SEV_LABEL[i.severity]}
                              </span>
                            </div>
                            <p className="text-xs font-medium text-foreground truncate mt-0.5">{c.name}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </aside>
              ) : activeTab === "what-if" ? (
                /* What-If Idle State */
                <div className="group relative flex flex-col items-center justify-center h-full rounded-[20px] border border-[var(--hairline)] border-dashed bg-[var(--surface-raised)]/60 p-8 sm:p-12 text-center text-muted-foreground backdrop-blur-xl transition-all duration-300 min-h-[380px]">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/5 bg-white/[0.04] text-amber-400 mb-4">
                    <FlaskConical className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-display text-base font-semibold text-foreground">
                    What-If Sandbox Lab Ready
                  </h3>
                  <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    Select a synthetic scenario above or formulate your own rule on the left. Runs in an isolated sandbox with zero filings impact.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(PRESET_SCENARIOS[2])}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 font-mono text-xs text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer"
                  >
                    <span>Load AI Act Tightening Scenario &rarr;</span>
                  </button>
                </div>
              ) : (
                /* Portfolio Idle State */
                <div className="group relative flex flex-col items-center justify-center h-full rounded-[20px] border border-[var(--hairline)] border-dashed bg-[var(--surface-raised)]/60 p-8 sm:p-12 text-center text-muted-foreground backdrop-blur-xl transition-all duration-300 min-h-[380px]">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/5 bg-white/[0.04] text-[var(--brass)] mb-4">
                    <Zap className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Direct Portfolio Engine Ready
                  </h3>
                  <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    Click a preset scenario above or paste statutory text to compute direct contractual blast radius.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(PRESET_SCENARIOS[0])}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--brass)_30%,transparent)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] px-4 py-1.5 font-mono text-xs text-[var(--brass)] hover:bg-[color-mix(in_oklab,var(--brass)_20%,transparent)] transition-all cursor-pointer"
                  >
                    <span>Load Basel IV Scenario &rarr;</span>
                  </button>
                </div>
              )
            ) : (
              /* Supply Chain Result or Idle */
              chainResult ? (
                <aside className="group relative flex flex-col h-full rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 sm:p-7 backdrop-blur-xl shadow-[var(--shadow-soft)] space-y-5 animate-in fade-in duration-300 transition-all duration-300 hover:border-[color-mix(in_oklab,var(--risk)_40%,transparent)] hover:shadow-[0_20px_50px_-18px_rgba(225,82,75,0.22)]">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--risk)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-[var(--risk)] shadow-[0_0_8px_var(--risk)] animate-pulse" />
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--risk)]">
                        Upstream Cascade Blast
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 bg-emerald-500/10">
                      Evaluated Live
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-[16px] border border-[var(--risk)]/25 bg-gradient-to-br from-[var(--risk)]/15 via-[var(--risk)]/5 to-transparent p-5 backdrop-blur-md">
                    <div className="sm:col-span-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-medium">
                        Indirect Exposure at Risk
                      </p>
                      <p className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight text-[var(--risk)] tabular-nums">
                        {formatUSD(chainResult.total_indirect_exposure)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Propagating backward across upstream SLAs
                      </p>
                    </div>
                    <div className="flex flex-col justify-center sm:items-end border-t sm:border-t-0 sm:border-l border-[var(--hairline)] pt-3 sm:pt-0 sm:pl-4">
                      <span className="font-mono text-xl font-bold text-foreground tabular-nums">
                        {orderedHits.length}
                      </span>
                      <span className="text-xs text-muted-foreground">Impacted Nodes</span>
                      <div className="flex items-center gap-1.5 mt-2 font-mono text-[10px]">
                        <span className="text-[var(--risk)] font-semibold">{highSeverityHitsCount} High Risk</span>
                      </div>
                    </div>
                  </div>

                  {chainResult.summary && (
                    <div className="rounded-[14px] border border-white/5 bg-white/[0.02] p-3.5">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--brass)] font-semibold">
                          Cascade Diagnostic
                        </p>
                        <span className="text-[10px] font-mono text-muted-foreground">Hop Propagation</span>
                      </div>
                      <p className="text-xs sm:text-[13px] leading-relaxed text-muted-foreground line-clamp-3">
                        {chainResult.summary}
                      </p>
                    </div>
                  )}

                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                        Cascade Trace ({orderedHits.length})
                      </p>
                      <a href="#cascade-table" className="font-mono text-[10px] text-[var(--brass)] hover:underline">
                        View Full Breakdown &darr;
                      </a>
                    </div>

                    <ul className="flex flex-col gap-2 max-h-[190px] overflow-y-auto pr-1">
                      {orderedHits.slice(0, 4).map((h) => {
                        const n = nodesById.get(h.node_id);
                        if (!n) return null;
                        return (
                          <li key={h.node_id} className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-mono text-[10px] text-[var(--brass)] uppercase font-semibold">Hop {h.hop} &middot; Tier {n.tier}</span>
                              <span className="text-[10px] font-mono text-[var(--risk)] uppercase font-semibold">{h.severity}</span>
                            </div>
                            <p className="text-xs font-medium text-foreground truncate mt-0.5">{n.name}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </aside>
              ) : (
                /* Supply Chain Idle State */
                <div className="group relative flex flex-col items-center justify-center h-full rounded-[20px] border border-[var(--hairline)] border-dashed bg-[var(--surface-raised)]/60 p-8 sm:p-12 text-center text-muted-foreground backdrop-blur-xl transition-all duration-300 min-h-[380px]">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border border-white/5 bg-white/[0.04] text-[var(--brass)] mb-4">
                    <Network className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                  <h3 className="font-display text-base font-semibold text-foreground">
                    Supply Chain Cascade Engine Ready
                  </h3>
                  <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    Select an upstream supplier scenario above to trace recursive SLA breaches.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset(PRESET_SCENARIOS[5])}
                    className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--brass)_30%,transparent)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] px-4 py-1.5 font-mono text-xs text-[var(--brass)] hover:bg-[color-mix(in_oklab,var(--brass)_20%,transparent)] transition-all cursor-pointer"
                  >
                    <span>Run EU Data Center Test &rarr;</span>
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {/* SECTION 1: DIRECT PORTFOLIO & WHAT-IF SANDBOX VIEW */}
        {(activeTab === "portfolio" || activeTab === "what-if") && (
          <>
            {/* Detailed Direct Contracts Breakdown (Table ⟷ Cards) */}
            {portResult && sortedImpacts.length > 0 && (
              <div id="portfolio-table" className="space-y-4 pt-4 border-t border-[var(--hairline)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-[var(--risk)]" />
                      Direct Contract Blast Breakdown ({filteredImpacts.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Agreements directly impacted by the simulated regulation, ordered by severity and capital exposure.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Severity Filters */}
                    <div className="inline-flex items-center rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-1 backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => setSeverityFilter("all")}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs transition-all cursor-pointer ${
                          severityFilter === "all"
                            ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All ({sortedImpacts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSeverityFilter("high")}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs transition-all cursor-pointer ${
                          severityFilter === "high"
                            ? "bg-[var(--risk)] text-white font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        High ({highSeverityCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSeverityFilter("medium")}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs transition-all cursor-pointer ${
                          severityFilter === "medium"
                            ? "bg-amber-500 text-black font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Med ({mediumSeverityCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSeverityFilter("low")}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs transition-all cursor-pointer ${
                          severityFilter === "low"
                            ? "bg-blue-500 text-white font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Low ({lowSeverityCount})
                      </button>
                    </div>

                    {/* View Switcher */}
                    <div className="inline-flex items-center rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-1 backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => setPortViewMode("table")}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-xs transition-all cursor-pointer ${
                          portViewMode === "table"
                            ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <LayoutList className="h-3.5 w-3.5" />
                        <span>Table</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPortViewMode("cards")}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-xs transition-all cursor-pointer ${
                          portViewMode === "cards"
                            ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span>Cards</span>
                      </button>
                    </div>
                  </div>
                </div>

                {portViewMode === "table" ? (
                  <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 backdrop-blur-xl shadow-[var(--shadow-soft)]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[var(--hairline)] bg-white/[0.02] font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            <th className="py-3 px-4">Contract ID</th>
                            <th className="py-3 px-4">Title &amp; Type</th>
                            <th className="py-3 px-4">Severity</th>
                            <th className="py-3 px-4 text-right">Exposure Value</th>
                            <th className="py-3 px-4">Suggested Action / Amendment</th>
                            <th className="py-3 px-4 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--hairline)]">
                          {filteredImpacts.map((i) => {
                            const c = resolveContract(i.contract_id);
                            if (!c) return null;
                            return (
                              <tr key={i.contract_id} className="group hover:bg-white/[0.03] transition-colors">
                                <td className="py-3.5 px-4 font-mono font-semibold text-[var(--brass)] whitespace-nowrap">
                                  <Link to="/contracts/$contractId" params={{ contractId: c.id }} className="hover:underline">
                                    {c.id}
                                  </Link>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-medium text-foreground text-[13px]">{c.name}</div>
                                  <div className="font-mono text-[10px] text-muted-foreground uppercase">{c.type || "Commercial Agreement"}</div>
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${SEV_BADGE[i.severity]}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[i.severity]}`} />
                                    {SEV_LABEL[i.severity]}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-semibold text-foreground whitespace-nowrap tabular-nums">
                                  {formatUSD(c.value)}
                                </td>
                                <td className="py-3.5 px-4 max-w-md text-muted-foreground leading-relaxed">
                                  {i.suggested_amendment}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <Link
                                    to="/contracts/$contractId"
                                    params={{ contractId: c.id }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--hairline)] bg-white/[0.02] px-3 py-1 font-mono text-[11px] text-[var(--brass)] hover:bg-[var(--brass)]/10 hover:border-[var(--brass)]/30 transition-all"
                                  >
                                    <span>Inspect</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredImpacts.map((i) => {
                      const c = resolveContract(i.contract_id);
                      if (!c) return null;
                      return (
                        <div key={i.contract_id} className="group relative flex flex-col justify-between rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl">
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <Link
                                to="/contracts/$contractId"
                                params={{ contractId: c.id }}
                                className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--brass)] hover:underline inline-flex items-center gap-1"
                              >
                                {c.id}
                              </Link>
                              <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${SEV_BADGE[i.severity]}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[i.severity]}`} />
                                {SEV_LABEL[i.severity]}
                              </span>
                            </div>
                            <h4 className="font-display text-sm font-semibold text-foreground">{c.name}</h4>
                            <div className="mt-1 flex items-center justify-between font-mono text-xs">
                              <span className="text-muted-foreground">{c.type || "Commercial"}</span>
                              <span className="font-semibold text-foreground">{formatUSD(c.value)}</span>
                            </div>
                            <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-muted-foreground">
                              {i.suggested_amendment}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Interactive Portfolio Topology Medallion - Senior Engineered Simulation Cockpit */}
            <div className="group relative flex flex-col items-center justify-center rounded-[26px] border border-[var(--hairline)] bg-gradient-to-b from-[var(--surface-raised)]/90 via-[var(--shell-bg)] to-black/30 p-6 sm:p-9 backdrop-blur-2xl shadow-xl overflow-hidden transition-all duration-300">
              {/* Ambient Glowing Hairline */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent" />

              {/* Cockpit Status Header */}
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4 mb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[var(--brass)] animate-pulse" />
                    <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brass)]">
                      Simulated Blast Topology
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Live propagation network connecting statutory mandates to affected commercial agreements.
                  </p>
                </div>

                {/* Dynamic State Indicator */}
                <div className="flex items-center gap-2 shrink-0">
                  {portStatus === "loading" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brass)]/40 bg-[var(--brass)]/15 px-3 py-1 font-mono text-[11px] font-semibold text-[var(--brass)] animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Scanning Topology...
                    </span>
                  ) : impactMap.size > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--risk)]/40 bg-[var(--risk)]/15 px-3 py-1 font-mono text-[11px] font-semibold text-[var(--risk)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk)] animate-ping" />
                      {impactMap.size} Contracts In Blast Radius
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[11px] text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Topology Baseline Stable
                    </span>
                  )}
                </div>
              </div>

              {/* Informational Guidance Chips for Clarity */}
              <div className="w-full flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-xl border border-white/5 bg-white/[0.02] text-[11px] font-mono text-muted-foreground mb-4">
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)]" />
                    Inner Ring: <strong>{contracts.length} Contracts</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                    Outer Ring: <strong>{regulations.length} Regulations</strong>
                  </span>
                  <span className="text-muted-foreground/60 hidden md:inline">&middot;</span>
                  <span className="hidden md:inline text-muted-foreground/80">
                    Hover nodes to trace citation paths
                  </span>
                </div>

                <div className="text-[10.5px] text-[var(--brass)]">
                  {impactMap.size > 0 ? `${impactMap.size} agreements require amendment` : "Run simulation above to test exposure"}
                </div>
              </div>

              {/* Graph Medallion with hideHeader=true to eliminate duplicate titles and duplicate legends */}
              <div className="relative flex items-center justify-center w-full py-2">
                <GraphMedallion
                  contracts={contracts}
                  regulations={regulations}
                  impacts={impactMap.size > 0 ? impactMap : undefined}
                  pulsing={portStatus === "loading"}
                  hideHeader={true}
                />
              </div>
            </div>

            {/* Stale Citation Detection & Legal Verification Panel */}
            {portStatus === "done" && portResult?.citation_verification && (
              <StaleCitationVerificationPanel verification={portResult.citation_verification} />
            )}

            {/* Action Plan Panel (shown on completed run) */}
            {portStatus === "done" && portResult && (
              <div className="pt-4 border-t border-[var(--hairline)]">
                <ActionPlanPanel
                  regulationText={text}
                  summary={portResult.summary}
                  variant={activeTab === "what-if" ? "forecast" : undefined}
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
          </>
        )}

        {/* SECTION 2: UPSTREAM SUPPLY CHAIN VIEW */}
        {activeTab === "supply-chain" && (
          <>
            {/* Detailed Vendor Cascade Breakdown Table ⟷ Cards */}
            {chainResult && orderedHits.length > 0 && (
              <div id="cascade-table" className="space-y-4 pt-4 border-t border-[var(--hairline)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
                      <Layers className="h-4 w-4 text-[var(--brass)]" />
                      Upstream Disruption &amp; SLA Breakdown ({filteredHits.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Comprehensive mapping of vendor nodes, broken clauses, and cascaded financial exposure.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {/* Hop Filters */}
                    <div className="inline-flex items-center rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-1 backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => setHopFilter("all")}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs transition-all cursor-pointer ${
                          hopFilter === "all"
                            ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        All Hops ({orderedHits.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setHopFilter(1)}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs transition-all cursor-pointer ${
                          hopFilter === 1
                            ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Hop 1
                      </button>
                      <button
                        type="button"
                        onClick={() => setHopFilter(2)}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs transition-all cursor-pointer ${
                          hopFilter === 2
                            ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Hop 2
                      </button>
                      <button
                        type="button"
                        onClick={() => setHopFilter(3)}
                        className={`rounded-lg px-2.5 py-1 font-mono text-xs transition-all cursor-pointer ${
                          hopFilter === 3
                            ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Hop 3
                      </button>
                    </div>

                    {/* View Mode Switcher */}
                    <div className="inline-flex items-center rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-1 backdrop-blur-md">
                      <button
                        type="button"
                        onClick={() => setChainViewMode("table")}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-xs transition-all cursor-pointer ${
                          chainViewMode === "table"
                            ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <LayoutList className="h-3.5 w-3.5" />
                        <span>Table</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChainViewMode("cards")}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-xs transition-all cursor-pointer ${
                          chainViewMode === "cards"
                            ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span>Cards</span>
                      </button>
                    </div>
                  </div>
                </div>

                {chainViewMode === "table" ? (
                  <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 backdrop-blur-xl shadow-[var(--shadow-soft)]">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-[var(--hairline)] bg-white/[0.02] font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            <th className="py-3 px-4">Cascade Distance</th>
                            <th className="py-3 px-4">Entity &amp; Tier</th>
                            <th className="py-3 px-4">Vulnerability / Broken Clause</th>
                            <th className="py-3 px-4">Diagnosis &amp; Cause</th>
                            <th className="py-3 px-4 text-right">Exposure at Risk</th>
                            <th className="py-3 px-4 text-right">Inspect Node</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--hairline)]">
                          {filteredHits.map((h) => {
                            const n = nodesById.get(h.node_id);
                            if (!n) return null;
                            const isSelected = selectedChainNode?.id === n.id;
                            return (
                              <tr
                                key={h.node_id}
                                onClick={() => setSelectedChainNode(n)}
                                className={`group cursor-pointer transition-colors ${
                                  isSelected ? "bg-[var(--brass)]/10" : "hover:bg-white/[0.03]"
                                }`}
                              >
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className="font-mono text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md border border-[var(--brass)]/30 bg-[var(--brass)]/10 text-[var(--brass)]">
                                    Hop {h.hop}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-medium text-foreground text-[13px]">{n.name}</div>
                                  <div className="font-mono text-[10px] text-muted-foreground uppercase">
                                    Tier {n.tier} &middot; {n.jurisdiction ?? "Global"}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--risk)]">
                                  {h.broken_clause || "SLA Non-Compliance"}
                                </td>
                                <td className="py-3.5 px-4 max-w-sm text-muted-foreground leading-relaxed">
                                  {h.reason}
                                </td>
                                <td className="py-3.5 px-4 text-right font-mono font-semibold text-foreground whitespace-nowrap tabular-nums">
                                  {h.indirect_exposure_usd > 0 ? formatUSD(h.indirect_exposure_usd) : "—"}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedChainNode(n);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--hairline)] bg-white/[0.02] px-3 py-1 font-mono text-[11px] text-[var(--brass)] hover:bg-[var(--brass)]/10 hover:border-[var(--brass)]/30 transition-all cursor-pointer"
                                  >
                                    <span>Focus</span>
                                    <ArrowRight className="h-3 w-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredHits.map((h) => {
                      const n = nodesById.get(h.node_id);
                      if (!n) return null;
                      const isSelected = selectedChainNode?.id === n.id;
                      return (
                        <div
                          key={h.node_id}
                          onClick={() => setSelectedChainNode(n)}
                          className={`group relative flex flex-col justify-between rounded-2xl border p-5 backdrop-blur-xl transition-all duration-300 cursor-pointer ${
                            isSelected
                              ? "border-[var(--brass)] bg-[var(--brass)]/10 shadow-lg"
                              : "border-[var(--hairline)] bg-[var(--surface-raised)]/60 hover:border-[var(--hairline-strong)] hover:shadow-md"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[var(--brass)] px-2.5 py-0.5 rounded-md bg-[var(--brass)]/10 border border-[var(--brass)]/30">
                                Hop {h.hop} Propagation
                              </span>
                              <span
                                className={`font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border ${
                                  h.severity === "high"
                                    ? "text-[var(--risk)] border-[var(--risk)]/30 bg-[var(--risk)]/10"
                                    : "text-amber-400 border-amber-500/30 bg-amber-500/10"
                                }`}
                              >
                                {h.severity}
                              </span>
                            </div>

                            <h4 className="font-display text-sm font-semibold text-foreground group-hover:text-[var(--brass)] transition-colors">
                              {n.name}
                            </h4>
                            <div className="mt-1 flex items-center justify-between font-mono text-xs">
                              <span className="text-muted-foreground">Tier {n.tier} &middot; {n.jurisdiction ?? "Global"}</span>
                              {h.indirect_exposure_usd > 0 && (
                                <span className="font-semibold text-foreground">{formatUSD(h.indirect_exposure_usd)}</span>
                              )}
                            </div>

                            <div className="mt-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-muted-foreground leading-relaxed">
                              <span className="font-mono text-[10px] uppercase text-[var(--brass)] font-semibold block mb-0.5">
                                Broken Clause: {h.broken_clause}
                              </span>
                              {h.reason}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Interactive Multi-Hop Dependency Graph */}
            <div className="group relative flex flex-col items-center justify-center rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 sm:p-8 backdrop-blur-xl shadow-[var(--shadow-soft)] overflow-hidden transition-all duration-300">
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

              <div className="relative w-full overflow-x-auto py-2">
                <SupplyChainGraph
                  nodes={chain.nodes}
                  edges={chain.edges}
                  hits={chainHitMap}
                  animating={chainStatus === "done"}
                  selectedId={selectedChainNode?.id ?? null}
                  onNodeClick={(n) => setSelectedChainNode(n)}
                />
              </div>

              {selectedChainNode && (
                <div className="mt-4 w-full rounded-2xl border border-[var(--brass)]/40 bg-gradient-to-r from-[var(--brass)]/10 via-[var(--surface-raised)] to-transparent p-5 text-xs backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--brass)]/20 text-[var(--brass)]">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-semibold text-foreground">{selectedChainNode.name}</span>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--brass)] border border-[var(--brass)]/30 rounded-full px-2 py-0.5 bg-[var(--brass)]/10">
                          Tier {selectedChainNode.tier}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 font-mono text-[11px] flex items-center gap-1.5">
                        <Globe2 className="h-3 w-3" /> {selectedChainNode.jurisdiction ?? "Global Jurisdiction"} &middot; Node ID: {selectedChainNode.id}
                      </p>
                    </div>
                  </div>

                  {chainHitMap.get(selectedChainNode.id) ? (
                    <div className="sm:text-right">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[var(--risk)] bg-[var(--risk)]/10 border border-[var(--risk)]/30 px-3 py-1 rounded-full">
                        <span className="h-2 w-2 rounded-full bg-[var(--risk)] animate-pulse" />
                        Cascade Hop {chainHitMap.get(selectedChainNode.id)?.hop} ({chainHitMap.get(selectedChainNode.id)?.severity.toUpperCase()} RISK)
                      </span>
                      <p className="font-mono text-[11px] text-muted-foreground mt-1">
                        At risk: {formatUSD(chainHitMap.get(selectedChainNode.id)?.indirect_exposure_usd ?? 0)}
                      </p>
                    </div>
                  ) : (
                    <div className="sm:text-right">
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Zero Direct Impact Detected
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Remediation Action Panel */}
            {chainResult && chainResult.remediation.length > 0 && (
              <div className="rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 backdrop-blur-xl">
                <p className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brass)]">
                  <ShieldAlert className="h-4 w-4" strokeWidth={1.8} /> Recommended Remediation &amp; SLA Re-Negotiation
                </p>
                <ul className="grid sm:grid-cols-2 gap-3">
                  {chainResult.remediation.map((r, i) => (
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
            {chainResult && orderedHits.length > 0 && (
              <div className="pt-4 border-t border-[var(--hairline)]">
                <ComplianceCodePanel
                  regulationText={text || PRESET_SCENARIOS[2].text}
                  simulationRunId={chainResult.run_id ?? undefined}
                  gap={
                    orderedHits[0]?.broken_clause
                      ? `${orderedHits[0].broken_clause} (${nodesById.get(orderedHits[0].node_id)?.name ?? "upstream provider"})`
                      : "Upstream provider non-compliance"
                  }
                />
              </div>
            )}
          </>
        )}

      </div>
    </AppShell>
  );
}
