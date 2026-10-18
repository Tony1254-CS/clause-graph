import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  Radar,
  FlaskConical,
  Network,
  ArrowUpRight,
  ShieldAlert,
  FileText,
  Landmark,
  ListChecks,
  ExternalLink,
  ChevronRight,
  Activity,
  Globe,
  Sparkles,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { AppShell } from "@/components/clausegraph/AppShell";
import { GraphMedallion } from "@/components/clausegraph/GraphMedallion";
import {
  contractsQuery,
  regulationsQuery,
  simulationRunsQuery,
  federalRegisterQuery,
  formatUSD,
} from "@/data/queries";
import { RouteError } from "@/components/clausegraph/RouteError";
import { StaleCitationWidget } from "@/components/clausegraph/stale/StaleCitationWidget";
import { fetchStaleFindings } from "@/lib/stale/fetch.functions";
import { runStaleScan } from "@/lib/stale/scan.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Mission Control — ClauseGraph" },
      {
        name: "description",
        content:
          "Executive portfolio intelligence: live regulatory topology, exposure concentration, federal alert radar, and audit trail.",
      },
      { property: "og:title", content: "Mission Control — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Executive portfolio intelligence: live regulatory topology, exposure concentration, federal alert radar, and audit trail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(contractsQuery),
      context.queryClient.ensureQueryData(regulationsQuery),
      context.queryClient.ensureQueryData(simulationRunsQuery),
      context.queryClient.ensureQueryData(federalRegisterQuery),
    ]),
  component: Dashboard,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Dashboard unavailable" error={error} reset={reset} />
  ),
});

function Dashboard() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: regulations } = useSuspenseQuery(regulationsQuery);
  const { data: runs } = useSuspenseQuery(simulationRunsQuery);
  const { data: fedData } = useSuspenseQuery(federalRegisterQuery);

  const queryClient = useQueryClient();

  const { data: staleData, isLoading: isStaleLoading } = useQuery({
    queryKey: ["stale-findings-stats"],
    queryFn: () => fetchStaleFindings({ data: {} }),
  });

  const handleRunScan = async () => {
    await runStaleScan({ data: { triggerSource: "manual" } });
    await queryClient.invalidateQueries({ queryKey: ["stale-findings-stats"] });
  };

  // Interactive Hover States for Analytics
  const [activeDonutIdx, setActiveDonutIdx] = useState<number | null>(null);
  const [activeRiskTier, setActiveRiskTier] = useState<"high" | "medium" | "compliant" | null>(null);

  // Financial & Risk Metrics
  const totalPortfolioValue = useMemo(
    () => contracts.reduce((acc, c) => acc + (Number(c.value) || 0), 0),
    [contracts]
  );

  const contractsById = useMemo(() => {
    const m = new Map<string, (typeof contracts)[number]>();
    contracts.forEach((c) => m.set(c.id, c));
    return m;
  }, [contracts]);

  const totalExposureSurfaced = useMemo(() => {
    let sum = 0;
    runs.forEach((r) => {
      if (r.run_type === "supply_chain") {
        sum += r.result.total_indirect_exposure ?? 0;
      } else {
        (r.result.impacts ?? []).forEach((i) => {
          sum += contractsById.get(i.contract_id)?.value ?? 0;
        });
      }
    });
    return sum;
  }, [runs, contractsById]);

  // Sort contracts by valuation for high-priority watchlist
  const topValuedContracts = useMemo(
    () => [...contracts].sort((a, b) => b.value - a.value).slice(0, 5),
    [contracts]
  );

  // Recent 3 forensic runs
  const recentRuns = useMemo(() => runs.slice(0, 3), [runs]);

  const frameworkSegments = [
    {
      id: "gdpr",
      name: "GDPR / EU Data Protection",
      code: "GDPR",
      pct: "38%",
      value: 38,
      color: "#06b6d4",
      bgClass: "bg-cyan-400",
      val: "$56.4M",
      contracts: 6,
      strokeOffset: "150",
    },
    {
      id: "sec",
      name: "SEC Cyber & Disclosure (US)",
      code: "SEC",
      pct: "28%",
      value: 28,
      color: "#c59a3f",
      bgClass: "bg-[var(--brass)]",
      val: "$41.5M",
      contracts: 4,
      strokeOffset: "280",
    },
    {
      id: "dora",
      name: "DORA Financial Resilience (EU)",
      code: "DORA",
      pct: "20%",
      value: 20,
      color: "#a855f7",
      bgClass: "bg-purple-400",
      val: "$29.7M",
      contracts: 3,
      strokeOffset: "330",
    },
    {
      id: "ccpa",
      name: "CCPA & Basel Prudential",
      code: "CCPA",
      pct: "14%",
      value: 14,
      color: "#10b981",
      bgClass: "bg-emerald-400",
      val: "$20.9M",
      contracts: 2,
      strokeOffset: "360",
    },
  ];

  return (
    <AppShell>
      <div className="w-full max-w-[1440px] mx-auto space-y-8 pb-16">
        {/* ── Top Executive Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Enterprise Command Center · Live Governance
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Portfolio Intelligence &amp; Exposure Radar
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Cross-jurisdictional contract topology, predictive compliance telemetry, and automated remediation pipelines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/simulate"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brass)] to-[#c59a3f] px-4 py-2 text-xs font-semibold text-[var(--ink-base)] shadow-lg shadow-[var(--brass)]/15 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Zap className="h-3.5 w-3.5" />
              Launch Neural Simulation
            </Link>
          </div>
        </div>

        {/* ── Executive KPI Ribbon ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[var(--brass)]/50 hover:shadow-[0_20px_40px_-15px_rgba(201,166,107,0.18)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Total Portfolio Valuation
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--brass)] transition-colors group-hover:border-[var(--brass)]/30 group-hover:bg-[var(--brass)]/10">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {formatUSD(totalPortfolioValue)}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {contracts.length} Active Contracts
              </span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[var(--risk)]/50 hover:shadow-[0_20px_40px_-15px_rgba(225,82,75,0.22)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--risk)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Total Exposure Surfaced
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--risk)] transition-colors group-hover:border-[var(--risk)]/30 group-hover:bg-[var(--risk)]/10">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-[var(--risk)] font-mono">
                {formatUSD(totalExposureSurfaced)}
              </span>
              <span className="text-[10px] font-mono text-[var(--risk)] border border-[var(--risk)]/20 bg-[var(--risk)]/10 px-2 py-0.5 rounded-full">
                Stress Tested
              </span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-[0_20px_40px_-15px_rgba(6,182,212,0.2)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Monitored Regulations
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-cyan-400 transition-colors group-hover:border-cyan-500/30 group-hover:bg-cyan-500/10">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {regulations.length} Frameworks
              </span>
              <span className="text-[10px] font-mono text-cyan-400 border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                US · EU · UK
              </span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-purple-500/50 hover:shadow-[0_20px_40px_-15px_rgba(168,85,247,0.2)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Audited Executions
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-purple-400 transition-colors group-hover:border-purple-500/30 group-hover:bg-purple-500/10">
                <ListChecks className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {runs.length} Runs Logged
              </span>
              <span className="text-[10px] font-mono text-purple-400 border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 rounded-full">
                Immutable Ledger
              </span>
            </div>
          </div>
        </div>

        {/* ── Main Dual Workbench: Topology Graph (Left) & Risk Watchlist (Right) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Interactive Topological Graph Medallion */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-[var(--hairline)] bg-gradient-to-br from-[var(--surface-raised)]/80 via-black/40 to-white/[0.02] p-6 backdrop-blur-2xl shadow-xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[var(--brass)]" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Regulatory-Contract Portfolio Topology
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Live citation linkages between indexed contracts (inner ring) and statutory frameworks (outer ring).
                </p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--brass)] border border-[var(--brass)]/20 bg-[var(--brass)]/10 px-2.5 py-1 rounded-full">
                <Sparkles className="h-3 w-3" /> Live Dynamic Graph
              </span>
            </div>

            <div className="py-4 flex items-center justify-center min-h-[460px]">
              <GraphMedallion contracts={contracts} regulations={regulations} />
            </div>

            <div className="pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground font-mono">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--brass)]" /> Contracts ({contracts.length})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" /> Regulations ({regulations.length})
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Hover any node to inspect semantic cross-references
              </span>
            </div>
          </div>

          {/* Right: Portfolio Exposure Watchlist */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-[var(--hairline)] bg-gradient-to-br from-[var(--surface-raised)]/80 via-black/40 to-white/[0.02] p-6 backdrop-blur-2xl shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[var(--risk)]" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Top High-Valuation Watchlist
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Key commercial agreements requiring regulatory surveillance.
                </p>
              </div>
              <Link
                to="/contracts"
                className="text-xs font-mono uppercase tracking-wider text-[var(--brass)] hover:underline flex items-center gap-1"
              >
                All ({contracts.length}) <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-3 flex-1">
              {topValuedContracts.map((c) => {
                const uniqueRegs = Array.from(
                  new Set((c.clauses || []).flatMap((cl) => cl.linked_regs || []))
                );
                return (
                  <Link
                    key={c.id}
                    to="/contracts/$contractId"
                    params={{ contractId: c.id }}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[var(--brass)]/40 hover:bg-white/[0.04] hover:shadow-[0_16px_36px_-12px_rgba(201,166,107,0.16)] space-y-3"
                  >
                    {/* Glowing Top Hairline on hover */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground border border-white/5 bg-white/[0.04] px-1.5 py-0.5 rounded">
                            {c.id.slice(0, 8)}
                          </span>
                          <span className="text-sm font-semibold text-foreground group-hover:text-[var(--brass)] flex items-center gap-1.5 truncate transition-colors">
                            <span className="truncate">{c.name}</span>
                            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          Counterparty: <strong className="text-foreground/90 font-medium">{c.counterparty}</strong>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-bold text-[var(--brass)] block">
                          {formatUSD(c.value)}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {c.clauses?.length ?? 0} Clauses
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px] font-mono text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <span>Ready</span>
                        {uniqueRegs.length > 0 && (
                          <span className="ml-1 rounded-full border border-[var(--brass)]/20 bg-[var(--brass)]/10 px-2 py-0.2 text-[9.5px] text-[var(--brass)] font-semibold">
                            {uniqueRegs.length} Regs Mapped
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground group-hover:text-[var(--brass)] flex items-center gap-1 transition-colors">
                        Inspect <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="p-3.5 rounded-xl border border-white/10 bg-black/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total Indexed Capital:</span>
              <strong className="font-mono text-foreground font-semibold">
                {formatUSD(totalPortfolioValue)}
              </strong>
            </div>
          </div>
        </div>

        {/* ── Stale Citation Surveillance Engine Widget ── */}
        <StaleCitationWidget
          stats={staleData?.stats ?? null}
          isLoading={isStaleLoading}
          onRunScan={handleRunScan}
        />

        {/* ── Interactive Risk Analytics & Exposure Charts (shadcn / recharts) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Chart: Jurisdiction & Framework Exposure Breakdown (shadcn Pie/Donut Chart) */}
          <div className="lg:col-span-6 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 backdrop-blur-xl space-y-5 transition-all hover:border-[var(--hairline-strong)] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-cyan-400" />
                  Regulatory Framework Exposure Breakdown
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Portfolio capital distribution across monitored compliance jurisdictions.
                </p>
              </div>
              <span className="font-mono text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-0.5 rounded-full font-semibold">
                Framework Capital
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center flex-1">
              {/* shadcn Recharts Pie Chart with callout style */}
              <div className="sm:col-span-6 h-52 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      wrapperStyle={{ zIndex: 100, pointerEvents: "none" }}
                      content={({ active, payload }: any) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-white/20 bg-[#090e15] p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-xs font-mono select-none">
                              <p className="font-semibold text-foreground text-[12px]">{data.name}</p>
                              <p className="text-[var(--brass)] mt-1 font-bold">
                                Value: {data.val} ({data.pct})
                              </p>
                              <p className="text-muted-foreground text-[10px]">
                                {data.contracts} Linked Contracts
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Pie
                      data={frameworkSegments}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={46}
                      outerRadius={78}
                      paddingAngle={4}
                      stroke="rgba(0,0,0,0.4)"
                      strokeWidth={2}
                      onMouseEnter={(_, index) => setActiveDonutIdx(index)}
                      onMouseLeave={() => setActiveDonutIdx(null)}
                    >
                      {frameworkSegments.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                <div className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center transition-opacity duration-200 ${activeDonutIdx !== null ? "opacity-0" : "opacity-100"}`}>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    Monitored
                  </span>
                  <span className="font-mono text-xl font-bold text-foreground">
                    {regulations.length}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    Frameworks
                  </span>
                </div>
              </div>

              {/* Legend Callout Breakdown */}
              <div className="sm:col-span-6 space-y-2">
                {frameworkSegments.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-2 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-foreground font-medium truncate">
                        {item.name}
                      </span>
                    </div>
                    <div className="font-mono text-right shrink-0 pl-2">
                      <span className="text-xs text-foreground font-semibold block">
                        {item.val}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {item.pct}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl border border-white/5 bg-black/30 flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Jurisdictions covered:</span>
              <span className="text-foreground font-semibold">European Union · United States · UK</span>
            </div>
          </div>

          {/* Right Chart: Severity Risk Exposure & Provision Health (shadcn Bar + Line Composed Chart) */}
          <div className="lg:col-span-6 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 backdrop-blur-xl space-y-5 transition-all hover:border-[var(--hairline-strong)] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[var(--risk)]" />
                  Portfolio Risk Concentration &amp; Health Trend
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Severity tier distribution across all stress-tested provisions with trend trajectory.
                </p>
              </div>
              <span className="font-mono text-[10px] text-[var(--risk)] bg-[var(--risk)]/10 border border-[var(--risk)]/20 px-2.5 py-0.5 rounded-full font-semibold">
                Risk Distribution
              </span>
            </div>

            {/* shadcn Recharts Composed Bar + Line Graph (Matching user sample) */}
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={[
                    { name: "Tier-3 Vendor", risk: 8, target: 12, fill: "#10b981" },
                    { name: "SaaS Licenses", risk: 16, target: 18, fill: "#10b981" },
                    { name: "Procurement", risk: 28, target: 24, fill: "#c59a3f" },
                    { name: "Data Processing", risk: 24, target: 20, fill: "#c59a3f" },
                    { name: "Cloud Infra", risk: 20, target: 26, fill: "#c59a3f" },
                    { name: "Cross-Border", risk: 36, target: 44, fill: "#e1524b" },
                    { name: "Core Banking", risk: 42, target: 50, fill: "#e1524b" },
                  ]}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number | string) => `${v}%`}
                  />
                  <Tooltip
                    wrapperStyle={{ zIndex: 100, pointerEvents: "none" }}
                    content={({ active, payload, label }: any) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-xl border border-white/20 bg-[#090e15] p-3 shadow-xl backdrop-blur-xl text-xs font-mono">
                            <p className="font-semibold text-foreground text-[12px]">{label}</p>
                            <p className="text-[var(--risk)] mt-1">
                              Exposure: {payload[0]?.value}%
                            </p>
                            <p className="text-cyan-400">
                              Stress Benchmark: {payload[1]?.value}%
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="risk" radius={[6, 6, 0, 0]}>
                    {[
                      "#10b981",
                      "#10b981",
                      "#c59a3f",
                      "#c59a3f",
                      "#c59a3f",
                      "#e1524b",
                      "#e1524b",
                    ].map((entry, index) => (
                      <Cell key={`bar-${index}`} fill={entry} />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="target"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#38bdf8" }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Bottom Key Metric Indicators */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-xl border border-[var(--risk)]/30 bg-[var(--risk)]/10 p-3 space-y-1">
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground block">
                  High Risk Exposure
                </span>
                <span className="font-mono text-base font-bold text-[var(--risk)]">
                  {formatUSD(totalExposureSurfaced * 0.42)}
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  4 priority contracts flagged
                </span>
              </div>

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground block">
                  Autonomous Remediation
                </span>
                <span className="font-mono text-base font-bold text-emerald-400">
                  94.2% Success
                </span>
                <span className="text-[10px] text-muted-foreground block">
                  Neural clause diff pass rate
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Quick-Launch Command Palette ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Mission Control Intelligence Engines
            </span>
            <span className="font-mono text-[10.5px] text-[var(--brass)]">
              Direct Pipeline Execution
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/simulate"
              className="group rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-emerald-500/40 hover:shadow-[0_12px_30px_-10px_rgba(16,185,129,0.15)] flex flex-col justify-between space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <Zap className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-emerald-400 transition-colors">
                  Impact Blast-Radius
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Stress-test draft regulatory mandates against all contracts with automated clause diffing.
                </p>
              </div>
            </Link>

            <Link
              to="/predictive"
              className="group rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-cyan-500/40 hover:shadow-[0_12px_30px_-10px_rgba(6,182,212,0.15)] flex flex-col justify-between space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 grid place-items-center text-cyan-400 group-hover:scale-105 transition-transform">
                  <Radar className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-cyan-400 transition-colors" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-cyan-400 transition-colors">
                  Predictive Horizon Radar
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Forensic timeline forecasting upcoming compliance obligations and amendment deadlines.
                </p>
              </div>
            </Link>

            <Link
              to="/what-if"
              className="group rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-amber-500/40 hover:shadow-[0_12px_30px_-10px_rgba(245,158,11,0.15)] flex flex-col justify-between space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 grid place-items-center text-amber-400 group-hover:scale-105 transition-transform">
                  <FlaskConical className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-400 transition-colors" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-amber-400 transition-colors">
                  What-If Sandbox Lab
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Synthesize zero-consequence regulatory amendments and inspect downstream balance-sheet exposure.
                </p>
              </div>
            </Link>

            <Link
              to="/supply-chain"
              className="group rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-purple-500/40 hover:shadow-[0_12px_30px_-10px_rgba(168,85,247,0.15)] flex flex-col justify-between space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 grid place-items-center text-purple-400 group-hover:scale-105 transition-transform">
                  <Network className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-400 transition-colors" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground group-hover:text-purple-400 transition-colors">
                  Supply Chain Contagion
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Multi-hop cascading breach analysis across Tier-1 and Tier-2 vendor sub-processors.
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* ── Twin Columns: Federal Register Live Radar (Left) & Audit Trail Ledger (Right) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left: Federal Register Live Feed */}
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-foreground">
                  Federal Register Live Regulatory Feed
                </h3>
              </div>
              <Link
                to="/feed"
                className="text-xs font-mono uppercase tracking-wider text-[var(--brass)] hover:underline flex items-center gap-1"
              >
                View Full Feed <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-3">
              {fedData.results.slice(0, 4).map((doc) => (
                <div
                  key={doc.document_number}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {doc.type ?? "RULE"}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {doc.publication_date}
                    </span>
                  </div>
                  <h4 className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed">
                    {doc.title}
                  </h4>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                      {doc.agencies?.[0]?.name ?? "Federal Agency"}
                    </span>
                    <Link
                      to="/simulate"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--brass)] hover:underline"
                    >
                      Test On Portfolio <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Recent Forensic Audit Runs */}
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-[var(--brass)]" />
                <h3 className="text-sm font-semibold text-foreground">
                  Recent Forensic Action Plans &amp; Audits
                </h3>
              </div>
              <Link
                to="/actions"
                className="text-xs font-mono uppercase tracking-wider text-[var(--brass)] hover:underline flex items-center gap-1"
              >
                Full Audit Trail <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-3">
              {recentRuns.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No simulations executed yet. Run your first simulation to generate an immutable forensic record.
                </div>
              ) : (
                recentRuns.map((r) => {
                  const impactCount = (r.result.impacts ?? []).length;
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-2 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--brass)] border border-[var(--brass)]/30 bg-[var(--brass)]/10 px-2 py-0.5 rounded-full">
                          {r.run_type.toUpperCase()}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/90 font-medium line-clamp-2 leading-relaxed">
                        {r.result.summary || r.input_regulation_text || "Simulation execution"}
                      </p>
                      <div className="flex items-center justify-between pt-1 text-[11px] font-mono text-muted-foreground">
                        <span className="text-[var(--risk)] font-semibold">
                          {impactCount} Contracts Impacted
                        </span>
                        <Link
                          to="/actions"
                          className="text-[var(--brass)] hover:underline"
                        >
                          Inspect Artifacts →
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

