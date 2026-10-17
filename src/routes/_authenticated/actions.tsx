import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ListChecks,
  ChevronDown,
  Copy,
  Check,
  Terminal,
  Zap,
  Radar,
  FlaskConical,
  Network,
  Search,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  FileCode,
  SlidersHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { RouteError } from "@/components/clausegraph/RouteError";
import {
  contractsQuery,
  simulationRunsQuery,
  complianceArtifactsQuery,
  formatUSD,
  type SimulationRunRow,
} from "@/data/queries";

export const Route = createFileRoute("/_authenticated/actions")({
  head: () => ({
    meta: [
      { title: "Action Plans & Audit Trail — ClauseGraph" },
      {
        name: "description",
        content:
          "Every simulation your workspace has run, the exposure it found, and the executable compliance artifacts generated from it.",
      },
      { property: "og:title", content: "Action Plans & Audit Trail — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Every simulation your workspace has run, the exposure it found, and the executable compliance artifacts generated from it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(contractsQuery),
      context.queryClient.ensureQueryData(simulationRunsQuery),
      context.queryClient.ensureQueryData(complianceArtifactsQuery),
    ]),
  component: ActionsPage,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Action plans unavailable" error={error} reset={reset} />
  ),
});

const RUN_META: Record<
  string,
  { label: string; icon: typeof Zap; to: string; badgeClass: string }
> = {
  reactive: { 
    label: "Simulate Impact", 
    icon: Zap, 
    to: "/simulate",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
  },
  forecast: { 
    label: "Predictive Forecast", 
    icon: Radar, 
    to: "/predictive",
    badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" 
  },
  what_if: { 
    label: "What-If Sandbox", 
    icon: FlaskConical, 
    to: "/what-if",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30" 
  },
  supply_chain: { 
    label: "Supply Chain Cascade", 
    icon: Network, 
    to: "/supply-chain",
    badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30" 
  },
};

const SEV_BADGE: Record<string, string> = {
  high: "bg-[var(--risk)]/20 text-[var(--risk)] border-[var(--risk)]/40",
  medium: "bg-[var(--brass)]/20 text-[var(--brass)] border-[var(--brass)]/40",
  low: "bg-white/10 text-muted-foreground border-white/20",
};

const FILTERS = [
  { id: "all", label: "All Runs" },
  { id: "reactive", label: "Reactive" },
  { id: "forecast", label: "Forecast" },
  { id: "what_if", label: "What-If" },
  { id: "supply_chain", label: "Supply Chain" },
] as const;

function ts(iso: string): string {
  const d = new Date(iso);
  return d
    .toISOString()
    .replace("T", " ")
    .slice(0, 16)
    .concat(" UTC");
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-all hover:border-[var(--brass)] hover:text-[var(--brass)] hover:bg-[var(--brass)]/5"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function ActionsPage() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: runs } = useSuspenseQuery(simulationRunsQuery);
  const { data: artifacts } = useSuspenseQuery(complianceArtifactsQuery);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const contractsById = useMemo(() => {
    const m = new Map<string, (typeof contracts)[number]>();
    contracts.forEach((c) => m.set(c.id, c));
    return m;
  }, [contracts]);

  const exposureOf = (run: SimulationRunRow): number => {
    if (run.run_type === "supply_chain") return run.result.total_indirect_exposure ?? 0;
    return (run.result.impacts ?? []).reduce(
      (s, i) => s + (contractsById.get(i.contract_id)?.value ?? 0),
      0,
    );
  };

  const impactCountOf = (run: SimulationRunRow): number =>
    run.run_type === "supply_chain"
      ? (run.result.hits ?? []).filter((h) => h.hop > 0).length
      : (run.result.impacts ?? []).length;

  const totals = useMemo(() => {
    const flagged = new Set<string>();
    let exposure = 0;
    let highRiskCount = 0;
    runs.forEach((r) => {
      exposure += exposureOf(r);
      (r.result.impacts ?? []).forEach((i) => {
        flagged.add(i.contract_id);
        if (i.severity === "high") highRiskCount++;
      });
    });
    return { runs: runs.length, flagged: flagged.size, exposure, highRiskCount };
  }, [runs, contractsById]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleRuns = useMemo(() => {
    return runs.filter((r) => {
      const matchesType = filter === "all" || r.run_type === filter;
      if (!matchesType) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchText = (r.input_regulation_text || "").toLowerCase();
      const matchSummary = (r.result.summary || "").toLowerCase();
      const matchContract = (r.result.impacts || []).some((i) => {
        const c = contractsById.get(i.contract_id);
        return (
          i.contract_id.toLowerCase().includes(q) ||
          (c?.name && c.name.toLowerCase().includes(q))
        );
      });
      return matchText.includes(q) || matchSummary.includes(q) || matchContract;
    });
  }, [runs, filter, searchQuery, contractsById]);

  return (
    <AppShell>
      <div className="w-full max-w-[1400px] mx-auto space-y-8 pb-16">
        {/* ── Top Header & Context Banner ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[var(--brass)] animate-pulse" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Audit Trail · Executable Governance
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Every Run, On The Record
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Immutable ledger of all simulations, predictive stress tests, and automated remediation plans. 
              Drill into any historical execution to verify flagged provisions or export audit-ready compliance scripts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/simulate"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brass)] to-[#c59a3f] px-4 py-2 text-xs font-semibold text-[var(--ink-base)] shadow-lg shadow-[var(--brass)]/15 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Zap className="h-3.5 w-3.5" />
              Launch New Simulation
            </Link>
          </div>
        </div>

        {/* ── Executive KPI Ribbon ── */}
        {runs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Total Runs Logged
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                  {totals.runs.toLocaleString()}
                </span>
                <span className="text-[10.5px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  100% Verified
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Unique Contracts Flagged
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                  {totals.flagged.toLocaleString()}
                </span>
                <span className="text-[10.5px] font-mono text-[var(--brass)] border border-[var(--brass)]/30 bg-[var(--brass)]/10 px-2 py-0.5 rounded-full">
                  Portfolio Scope
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Total Exposure Surfaced
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-[var(--risk)] font-mono">
                  {formatUSD(totals.exposure)}
                </span>
                <span className="text-[10.5px] font-mono text-[var(--risk)] border border-[var(--risk)]/30 bg-[var(--risk)]/10 px-2 py-0.5 rounded-full">
                  At Risk
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                High-Severity Provisions
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                  {totals.highRiskCount}
                </span>
                <span className="text-[10.5px] font-mono text-amber-400 border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  Action Required
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Toolbar: Search & Type Pills ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl border border-[var(--hairline)] bg-black/20">
            {FILTERS.map((f) => {
              const count =
                f.id === "all" ? runs.length : runs.filter((r) => r.run_type === f.id).length;
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`rounded-lg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider font-semibold transition-all ${
                    active
                      ? "bg-[var(--brass)] text-[var(--ink-base)] shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                  }`}
                >
                  {f.label} ({count})
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search regulation, contract, keyword..."
              className="w-full rounded-xl border border-[var(--hairline)] bg-black/30 pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--brass)]"
            />
          </div>
        </div>

        {/* ── Runs List ── */}
        {runs.length === 0 ? (
          <div className="rounded-[24px] border border-[var(--hairline)] bg-[var(--surface-raised)]/40 p-12 text-center max-w-lg mx-auto">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[var(--brass)]/30 bg-[var(--brass)]/10 text-[var(--brass)]">
              <ListChecks className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <h2 className="mt-5 text-xl font-display font-semibold tracking-tight text-foreground">
              No Simulation Runs Yet
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Run your first regulatory stress test or sandbox experiment and its complete forensic trace will appear here.
            </p>
            <Link
              to="/simulate"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--brass)] px-4 py-2 text-xs font-semibold text-[var(--ink-base)] transition-all hover:brightness-110"
            >
              <Zap className="h-3.5 w-3.5" />
              Launch First Simulation
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleRuns.map((run) => {
              const meta = RUN_META[run.run_type] ?? RUN_META.reactive;
              const Icon = meta.icon;
              const open = openId === run.id;
              const impactCount = impactCountOf(run);
              const runExposure = exposureOf(run);

              return (
                <div
                  key={run.id}
                  className={`overflow-hidden rounded-2xl border transition-all duration-300 ${
                    open
                      ? "border-[var(--brass)]/50 bg-[var(--surface-raised)] shadow-[0_12px_32px_-10px_rgba(0,0,0,0.5)]"
                      : "border-[var(--hairline)] bg-[var(--surface-raised)]/60 hover:border-white/20"
                  }`}
                >
                  {/* Card Header Accordion Trigger */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(open ? null : run.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenId(open ? null : run.id);
                      }
                    }}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
                        <Icon className="h-4 w-4 text-[var(--brass)]" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-md border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider font-semibold ${meta.badgeClass}`}>
                            {meta.label}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {ts(run.created_at)}
                          </span>
                          {run.result.fallback && (
                            <span className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                              Demo Fallback
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-foreground truncate max-w-xl">
                          {run.result.summary || run.input_regulation_text.slice(0, 100) || "Simulation Execution"}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                      <div className="text-left sm:text-right">
                        <div className="font-mono text-[11px] font-semibold text-foreground">
                          {impactCount} {impactCount === 1 ? "Contract" : "Contracts"} Impacted
                        </div>
                        <div className="font-mono text-[12px] font-bold text-[var(--risk)]">
                          {formatUSD(runExposure)} Exposure
                        </div>
                      </div>
                      <div className="h-8 w-8 rounded-full border border-white/10 grid place-items-center text-muted-foreground">
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180 text-[var(--brass)]" : ""}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Tray */}
                  {open && (
                    <div className="border-t border-[var(--hairline)] p-5 sm:p-7 space-y-6 bg-black/20">
                      {/* Grid: Left Prompt, Right Remediation Roadmap */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        {/* Left: Input Regulation & Quick Actions */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                              Input Regulatory Mandate
                            </span>
                            <div className="flex items-center gap-2">
                              <CopyButton text={run.input_regulation_text} label="Copy Text" />
                              <Link
                                to={meta.to}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--brass)]/30 bg-[var(--brass)]/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider font-semibold text-[var(--brass)] transition-all hover:brightness-125"
                              >
                                Re-run Scenario <ArrowRight className="h-3 w-3" />
                              </Link>
                            </div>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/40 p-4 max-h-56 overflow-y-auto">
                            <p className="font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
                              {run.input_regulation_text || "(No regulation input recorded for this run)"}
                            </p>
                          </div>
                        </div>

                        {/* Right: Remediation Checklist */}
                        <div className="space-y-4">
                          <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold block">
                            Strategic Remediation Steps
                          </span>
                          {(run.result.remediation ?? []).length > 0 ? (
                            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4">
                              {(run.result.remediation ?? []).map((step, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-xs leading-relaxed text-foreground/90">
                                  <span className="font-mono text-[11px] font-bold text-[var(--brass)] bg-[var(--brass)]/10 px-1.5 py-0.5 rounded border border-[var(--brass)]/20 shrink-0">
                                    {String(idx + 1).padStart(2, "0")}
                                  </span>
                                  <span>{step}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-muted-foreground">
                              No specific procedural remediation steps generated for this run.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Flagged Contracts & Clause Amendments */}
                      {(run.result.impacts ?? []).length > 0 && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--brass)] font-semibold flex items-center gap-2">
                              <ShieldAlert className="h-4 w-4" />
                              Flagged Provisions & Proposed Amendments ({(run.result.impacts ?? []).length})
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(run.result.impacts ?? []).map((imp, idx) => {
                              const contract = contractsById.get(imp.contract_id);
                              return (
                                <div
                                  key={`${imp.contract_id}-${idx}`}
                                  className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      {contract ? (
                                        <Link
                                          to="/contracts/$contractId"
                                          params={{ contractId: contract.id }}
                                          className="text-xs font-semibold text-foreground hover:text-[var(--brass)] flex items-center gap-1.5 truncate group"
                                        >
                                          <span className="truncate">{contract.name}</span>
                                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
                                        </Link>
                                      ) : (
                                        <span className="text-xs font-mono text-muted-foreground">
                                          Contract ID: {imp.contract_id}
                                        </span>
                                      )}
                                      {contract && (
                                        <span className="font-mono text-[10px] text-muted-foreground block mt-0.5">
                                          Portfolio Valuation: <strong className="text-foreground">{formatUSD(contract.value)}</strong>
                                        </span>
                                      )}
                                    </div>
                                    <span
                                      className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold border ${
                                        SEV_BADGE[imp.severity] ?? SEV_BADGE.low
                                      }`}
                                    >
                                      {imp.severity}
                                    </span>
                                  </div>

                                  <div className="rounded-lg bg-black/40 p-3 border-l-2 border-[var(--brass)] space-y-1">
                                    <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--brass)] block">
                                      ClauseGraph Recommended Fix:
                                    </span>
                                    <p className="text-xs leading-relaxed text-foreground/90">
                                      {imp.suggested_amendment}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {visibleRuns.length === 0 && (
              <div className="rounded-2xl border border-[var(--hairline)] p-8 text-center text-sm text-muted-foreground bg-[var(--surface-raised)]/40">
                No matching runs found for &quot;{searchQuery}&quot; under &quot;{filter}&quot;.
              </div>
            )}
          </div>
        )}

        {/* ── Compliance-as-Code Terminal Console ── */}
        {artifacts.length > 0 && (
          <section className="space-y-4 pt-6">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Compliance-As-Code · Executable Audits
              </p>
            </div>
            <div>
              <h2 className="text-xl font-display font-semibold tracking-tight text-foreground">
                Automated Verification Scripts & Runbooks
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Programmatic compliance checks and cloud remediation scripts generated for immediate engineering execution.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {artifacts.map((art) => (
                <div
                  key={art.id}
                  className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-5 space-y-4 backdrop-blur-xl"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-[var(--brass)]" strokeWidth={1.8} />
                      <span className="font-mono text-[11px] uppercase tracking-wider font-semibold text-foreground">
                        {art.stack ?? "Cloud Infrastructure"}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {ts(art.created_at)}
                    </span>
                  </div>

                  {art.gap && (
                    <div className="rounded-lg bg-black/30 p-3 text-xs leading-relaxed text-foreground/90 border border-white/5">
                      <strong className="text-[var(--risk)] font-mono text-[10px] uppercase block mb-1">
                        Compliance Gap Detected:
                      </strong>
                      {art.gap}
                    </div>
                  )}

                  {/* Terminal Code Snippet Block */}
                  {art.audit_script?.code && (
                    <div className="rounded-xl border border-white/10 bg-black/60 overflow-hidden">
                      <div className="flex items-center justify-between bg-white/[0.03] px-3 py-1.5 border-b border-white/5">
                        <span className="font-mono text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <FileCode className="h-3 w-3 text-[var(--brass)]" />
                          {art.audit_script.filename ?? "audit_verifier.py"}
                        </span>
                        <CopyButton
                          text={art.audit_script.code}
                          label="Copy Script"
                        />
                      </div>
                      <pre className="p-3 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-36 leading-relaxed">
                        <code>{art.audit_script.code}</code>
                      </pre>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {art.remediation?.code && (
                      <CopyButton
                        text={art.remediation.code}
                        label={`Copy Remediation (${art.remediation.filename ?? "fix.sh"})`}
                      />
                    )}
                    {art.runbook && (
                      <CopyButton text={art.runbook} label="Copy Runbook Protocol" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
