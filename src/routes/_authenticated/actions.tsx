import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  Table as TableIcon,
  LayoutList,
  ChevronLeft,
  ChevronRight,
  X,
  Layers,
  Sparkles,
  FileText,
  Code,
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
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-all hover:border-[var(--brass)] hover:text-[var(--brass)] hover:bg-[var(--brass)]/5 cursor-pointer"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function ArtifactConsoleCard({
  art,
  isSingle,
}: {
  art: (typeof complianceArtifactsQuery)["_TData"][number];
  isSingle: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"audit" | "remediation" | "runbook">("audit");

  const stackUpper = (art.stack ?? "CLOUD INFRASTRUCTURE").toUpperCase();
  const stackColor = stackUpper.includes("AZURE")
    ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
    : stackUpper.includes("AWS")
    ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
    : stackUpper.includes("GCP") || stackUpper.includes("GOOGLE")
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
    : "border-[var(--brass)]/30 bg-[var(--brass)]/10 text-[var(--brass)]";

  return (
    <div
      className={`rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl transition-all duration-200 overflow-hidden shadow-[var(--shadow-lift)] ${
        isSingle ? "max-w-4xl mx-auto" : "w-full"
      }`}
    >
      {/* Console Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[var(--hairline)] bg-white/[0.02]">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
            <Terminal className="h-4 w-4 text-[var(--brass)]" strokeWidth={1.8} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-wider border uppercase ${stackColor}`}>
                {stackUpper}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                ID: {art.id.slice(0, 8)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted-foreground hidden sm:inline">
            Logged: {ts(art.created_at)}
          </span>
          {art.audit_script?.code && activeTab === "audit" && (
            <CopyButton text={art.audit_script.code} label="Copy Script" />
          )}
          {art.remediation?.code && activeTab === "remediation" && (
            <CopyButton
              text={art.remediation.code}
              label={`Copy Remediation (${art.remediation.filename ?? "fix.sh"})`}
            />
          )}
          {art.runbook && activeTab === "runbook" && (
            <CopyButton text={art.runbook} label="Copy Runbook" />
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Compliance Gap Alert Banner */}
        {art.gap && (
          <div className="rounded-xl border border-[var(--risk)]/30 bg-[var(--risk)]/[0.07] p-3.5 flex items-start gap-3">
            <ShieldAlert className="h-4 w-4 text-[var(--risk)] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-wider font-bold text-[var(--risk)] block">
                Compliance Gap Detected
              </span>
              <p className="mt-0.5 text-xs font-medium text-foreground/90 leading-relaxed">
                {art.gap}
              </p>
            </div>
          </div>
        )}

        {/* Tabbed Code & Protocol Viewer */}
        <div className="rounded-xl border border-white/10 bg-black/60 overflow-hidden">
          {/* Subheader Tab Switcher */}
          <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-3">
            <div className="flex items-center gap-1">
              {art.audit_script?.code && (
                <button
                  type="button"
                  onClick={() => setActiveTab("audit")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono transition-all border-b-2 cursor-pointer ${
                    activeTab === "audit"
                      ? "border-[var(--brass)] text-[var(--brass)] font-semibold bg-white/[0.03]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileCode className="h-3.5 w-3.5" />
                  <span>{art.audit_script.filename ?? "audit_verifier.py"}</span>
                </button>
              )}

              {art.remediation?.code && (
                <button
                  type="button"
                  onClick={() => setActiveTab("remediation")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono transition-all border-b-2 cursor-pointer ${
                    activeTab === "remediation"
                      ? "border-[var(--brass)] text-[var(--brass)] font-semibold bg-white/[0.03]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Code className="h-3.5 w-3.5" />
                  <span>{art.remediation.filename ?? "remediation_fix.sh"}</span>
                </button>
              )}

              {art.runbook && (
                <button
                  type="button"
                  onClick={() => setActiveTab("runbook")}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono transition-all border-b-2 cursor-pointer ${
                    activeTab === "runbook"
                      ? "border-[var(--brass)] text-[var(--brass)] font-semibold bg-white/[0.03]"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Runbook Protocol</span>
                </button>
              )}
            </div>

            <span className="font-mono text-[10px] text-muted-foreground hidden sm:inline">
              UTF-8 &middot; executable
            </span>
          </div>

          {/* Active Tab Content Area */}
          <div className="p-4">
            {activeTab === "audit" && (
              <pre className="font-mono text-xs text-emerald-400 overflow-x-auto max-h-56 leading-relaxed selection:bg-emerald-400/20">
                <code>{art.audit_script?.code || "# No audit script registered"}</code>
              </pre>
            )}

            {activeTab === "remediation" && (
              <pre className="font-mono text-xs text-sky-400 overflow-x-auto max-h-56 leading-relaxed selection:bg-sky-400/20">
                <code>{art.remediation?.code || "# No remediation script registered"}</code>
              </pre>
            )}

            {activeTab === "runbook" && (
              <div className="font-mono text-xs text-foreground/80 overflow-y-auto max-h-56 whitespace-pre-wrap leading-relaxed selection:bg-[var(--brass)]/20">
                {art.runbook || "No runbook protocol attached"}
              </div>
            )}
          </div>
        </div>

        {/* Test Cases Pill Tags if available */}
        {(art.test_cases ?? []).length > 0 && (
          <div className="pt-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block mb-1.5">
              Automated Assertions ({(art.test_cases ?? []).length})
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(art.test_cases ?? []).map((tc, idx) => (
                <span
                  key={idx}
                  className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10.5px] text-foreground/80"
                >
                  &bull; {tc}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionsPage() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: runs } = useSuspenseQuery(simulationRunsQuery);
  const { data: artifacts } = useSuspenseQuery(complianceArtifactsQuery);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "feed">("table");
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedRunForModal, setSelectedRunForModal] = useState<SimulationRunRow | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Artifacts (Compliance-as-Code) View & Pagination states
  const [artifactSearch, setArtifactSearch] = useState("");
  const [artifactViewMode, setArtifactViewMode] = useState<"table" | "grid">("table");
  const [artifactPage, setArtifactPage] = useState(1);
  const [selectedArtifactForModal, setSelectedArtifactForModal] = useState<
    (typeof complianceArtifactsQuery)["_TData"][number] | null
  >(null);
  const artifactPageSize = 10;

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

  // Reset pagination on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchQuery]);

  // Close modal on Escape
  useEffect(() => {
    if (!selectedRunForModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedRunForModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRunForModal]);

  // Artifacts filtering & pagination
  const filteredArtifacts = useMemo(() => {
    if (!artifactSearch.trim()) return artifacts;
    const q = artifactSearch.toLowerCase();
    return artifacts.filter((a) => {
      const matchStack = (a.stack || "").toLowerCase().includes(q);
      const matchGap = (a.gap || "").toLowerCase().includes(q);
      const matchId = a.id.toLowerCase().includes(q);
      const matchScript = (a.audit_script?.filename || "").toLowerCase().includes(q);
      return matchStack || matchGap || matchId || matchScript;
    });
  }, [artifacts, artifactSearch]);

  const totalArtifactPages = Math.max(1, Math.ceil(filteredArtifacts.length / artifactPageSize));
  const safeArtifactPage = Math.min(artifactPage, totalArtifactPages);
  const paginatedArtifacts = useMemo(() => {
    const startIndex = (safeArtifactPage - 1) * artifactPageSize;
    return filteredArtifacts.slice(startIndex, startIndex + artifactPageSize);
  }, [filteredArtifacts, safeArtifactPage, artifactPageSize]);

  // Reset artifact pagination on search
  useEffect(() => {
    setArtifactPage(1);
  }, [artifactSearch]);

  // Close artifact modal on Escape
  useEffect(() => {
    if (!selectedArtifactForModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedArtifactForModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedArtifactForModal]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(visibleRuns.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRuns = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return visibleRuns.slice(startIndex, startIndex + pageSize);
  }, [visibleRuns, safeCurrentPage, pageSize]);

  return (
    <AppShell>
      <div className="w-full max-w-[1440px] mx-auto space-y-6 pb-16">
        
        {/* ── Top Header & Context Banner ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[var(--brass)] animate-pulse shadow-[0_0_8px_rgba(94,234,212,0.6)]" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Audit Trail &middot; Executable Governance
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
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brass)] to-[#c59a3f] px-4 py-2 font-mono text-xs font-semibold text-[var(--ink-base)] shadow-lg shadow-[var(--brass)]/15 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Zap className="h-3.5 w-3.5" />
              Launch New Simulation
            </Link>
          </div>
        </div>

        {/* ── Executive KPI Ribbon ── */}
        {runs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
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

            <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
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

            <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
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

            <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
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

        {/* ── Toolbar: Search & Type Pills & View Mode Switcher ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5 backdrop-blur-xl shadow-[var(--shadow-soft)]">
          <div className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[rgba(0,0,0,0.35)] border border-[var(--hairline)]">
            {FILTERS.map((f) => {
              const count =
                f.id === "all" ? runs.length : runs.filter((r) => r.run_type === f.id).length;
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 font-mono text-[11px] uppercase tracking-wider font-semibold transition-all duration-200 cursor-pointer ${
                    active
                      ? "bg-[var(--brass)] text-[var(--primary-foreground)] shadow-md ring-1 ring-white/20"
                      : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:border-[var(--brass)]/40 hover:bg-white/[0.08] hover:text-foreground"
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                      active
                        ? "bg-black/25 text-[var(--primary-foreground)] border-black/20 font-bold"
                        : "bg-white/[0.05] text-foreground border-white/10"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search regulation, contract, keyword..."
                className="w-full rounded-xl border border-white/5 bg-white/[0.04] pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[var(--brass)] transition-colors"
              />
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1.5 rounded-xl bg-[rgba(0,0,0,0.35)] p-1.5 border border-[var(--hairline)]">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer ${
                  viewMode === "table"
                    ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-md ring-1 ring-white/20"
                    : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:border-[var(--brass)]/40 hover:bg-white/[0.08] hover:text-foreground"
                }`}
                title="Table View (Proportional & Dense)"
              >
                <TableIcon className="h-3.5 w-3.5" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("feed")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer ${
                  viewMode === "feed"
                    ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-md ring-1 ring-white/20"
                    : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:border-[var(--brass)]/40 hover:bg-white/[0.08] hover:text-foreground"
                }`}
                title="Accordion Feed View"
              >
                <LayoutList className="h-3.5 w-3.5" />
                Feed
              </button>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT (TABLE VIEW OR FEED ACCORDION) ── */}
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
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--brass)] px-4 py-2 font-mono text-xs font-semibold text-[var(--ink-base)] transition-all hover:brightness-110"
            >
              <Zap className="h-3.5 w-3.5" />
              Launch First Simulation
            </Link>
          </div>
        ) : viewMode === "table" ? (
          /* ── VIEW 1: PROPORTIONAL DENSE TABLE (Default) ── */
          <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl shadow-[var(--shadow-lift)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hairline)] bg-white/[0.03] font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="px-6 py-4">Execution Summary & Trigger</th>
                    <th className="px-4 py-4">Pipeline Mode</th>
                    <th className="px-4 py-4">Contracts Impacted</th>
                    <th className="px-4 py-4">Exposure at Risk</th>
                    <th className="px-4 py-4">Logged Time</th>
                    <th className="px-6 py-4 text-right">Audit Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)] text-xs">
                  {visibleRuns.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-muted-foreground">
                        <ListChecks className="mx-auto h-9 w-9 text-muted-foreground opacity-40 mb-2" />
                        <span className="font-semibold block text-foreground">No Matching Runs Found</span>
                        <span className="text-[11px] block mt-1">Adjust search keywords or filter pills.</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedRuns.map((run) => {
                      const meta = RUN_META[run.run_type] ?? RUN_META.reactive;
                      const impactCount = impactCountOf(run);
                      const runExposure = exposureOf(run);

                      return (
                        <tr
                          key={run.id}
                          onClick={() => setSelectedRunForModal(run)}
                          className="group cursor-pointer transition-colors duration-150 hover:bg-white/[0.03]"
                        >
                          {/* Summary */}
                          <td className="px-6 py-4 max-w-md">
                            <div className="font-semibold text-foreground group-hover:text-[var(--brass)] transition-colors line-clamp-1">
                              {run.result.summary || run.input_regulation_text.slice(0, 90) || "Simulation Execution"}
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground font-mono line-clamp-1">
                              ID: {run.id.slice(0, 8)}... &middot; {run.input_regulation_text ? run.input_regulation_text.slice(0, 60) : "Direct Trigger"}
                            </div>
                          </td>

                          {/* Mode Badge */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider font-semibold ${meta.badgeClass}`}>
                              {meta.label}
                            </span>
                          </td>

                          {/* Impacted Contracts */}
                          <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-foreground">
                            <span className="flex items-center gap-1.5">
                              <Layers className="h-3.5 w-3.5 text-[var(--brass)] opacity-70" />
                              {impactCount} {impactCount === 1 ? "instrument" : "instruments"}
                            </span>
                          </td>

                          {/* Exposure */}
                          <td className="px-4 py-4 whitespace-nowrap font-mono text-sm font-bold text-[var(--risk)]">
                            {formatUSD(runExposure)}
                          </td>

                          {/* Time */}
                          <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                            {ts(run.created_at)}
                          </td>

                          {/* Action */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRunForModal(run);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] font-semibold text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] transition-all cursor-pointer shadow-sm"
                            >
                              Inspect Run
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Table Pagination Controls ── */}
            {visibleRuns.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-[var(--hairline)] bg-white/[0.02]">
                <div className="text-xs font-mono text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min((safeCurrentPage - 1) * pageSize + 1, visibleRuns.length)}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(safeCurrentPage * pageSize, visibleRuns.length)}
                  </span>{" "}
                  of <span className="font-semibold text-foreground">{visibleRuns.length}</span> audit logs
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>

                  <div className="flex items-center gap-1 font-mono text-xs">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
                      const isActive = pg === safeCurrentPage;
                      return (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setCurrentPage(pg)}
                          className={`h-7 w-7 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                            isActive
                              ? "border-[var(--brass)] bg-[var(--brass)]/15 text-[var(--brass)] font-bold shadow-sm"
                              : "border-transparent text-muted-foreground hover:border-[var(--hairline)] hover:text-foreground"
                          }`}
                        >
                          {pg}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── VIEW 2: ACCORDION FEED VIEW (With Pagination) ── */
          <div className="space-y-4">
            {paginatedRuns.map((run) => {
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

            {/* Pagination Controls for Feed */}
            {visibleRuns.length > pageSize && (
              <div className="flex items-center justify-between rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4">
                <div className="text-xs font-mono text-muted-foreground">
                  Page <strong className="text-foreground">{safeCurrentPage}</strong> of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    className="px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] disabled:opacity-40 cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] disabled:opacity-40 cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MODAL INSPECTION DRAWER (via React Portal) ── */}
        {selectedRunForModal && typeof document !== "undefined" && createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setSelectedRunForModal(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--hairline)] bg-[var(--shell-bg)] p-6 sm:p-8 shadow-[var(--shadow-lift)] space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* User-friendly Close Button with clear contrast, border, and Esc hint */}
              <button
                type="button"
                onClick={() => setSelectedRunForModal(null)}
                className="absolute top-5 right-5 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/25 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-all duration-150 shadow-md cursor-pointer group active:scale-95"
                aria-label="Close run inspection"
                title="Close (or press Esc)"
              >
                <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground/80 group-hover:text-foreground">Close</span>
                <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
              </button>

              {/* Modal Header */}
              <div className="border-b border-[var(--hairline)] pb-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded-md border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider font-semibold ${RUN_META[selectedRunForModal.run_type]?.badgeClass || "bg-white/10 text-white"}`}>
                    {RUN_META[selectedRunForModal.run_type]?.label || selectedRunForModal.run_type}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    Logged: {ts(selectedRunForModal.created_at)}
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-display font-semibold text-foreground">
                  {selectedRunForModal.result.summary || "Simulation Impact Report"}
                </h2>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  ID: {selectedRunForModal.id} &middot; <strong className="text-[var(--risk)]">{formatUSD(exposureOf(selectedRunForModal))}</strong> total exposure
                </div>
              </div>

              {/* Modal Body */}
              <div className="space-y-6 text-xs">
                {/* Input Regulation Box */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Trigger Regulation
                    </span>
                    <CopyButton text={selectedRunForModal.input_regulation_text} label="Copy Mandate" />
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-4 max-h-48 overflow-y-auto">
                    <p className="font-mono text-xs leading-relaxed text-foreground/80 whitespace-pre-wrap">
                      {selectedRunForModal.input_regulation_text || "(Direct Trigger)"}
                    </p>
                  </div>
                </div>

                {/* Remediation Steps */}
                {(selectedRunForModal.result.remediation ?? []).length > 0 && (
                  <div>
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--brass)] font-semibold block mb-2">
                      Remediation Plan Protocol
                    </span>
                    <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      {(selectedRunForModal.result.remediation ?? []).map((step, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-xs leading-relaxed text-foreground/90">
                          <span className="font-mono text-[11px] font-bold text-[var(--brass)] bg-[var(--brass)]/10 px-1.5 py-0.5 rounded border border-[var(--brass)]/20 shrink-0">
                            {String(idx + 1).padStart(2, "0")}
                          </span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Flagged Provisions */}
                {(selectedRunForModal.result.impacts ?? []).length > 0 && (
                  <div>
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold block mb-2">
                      Impacted Contracts ({(selectedRunForModal.result.impacts ?? []).length})
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                      {(selectedRunForModal.result.impacts ?? []).map((imp, idx) => {
                        const contract = contractsById.get(imp.contract_id);
                        return (
                          <div key={idx} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-foreground">{contract?.name || imp.contract_id}</span>
                              <span className={`rounded-full px-2 py-0.2 font-mono text-[9px] uppercase border ${SEV_BADGE[imp.severity]}`}>
                                {imp.severity}
                              </span>
                            </div>
                            <div className="rounded-lg bg-black/40 p-2 border-l-2 border-[var(--brass)]">
                              <p className="text-[11px] text-foreground/80">{imp.suggested_amendment}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Compliance-as-Code Terminal Console ── */}
        {artifacts.length > 0 && (
          <section className="space-y-4 pt-6 border-t border-[var(--hairline)]">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                    Compliance-As-Code &middot; Executable Audits
                  </p>
                </div>
                <h2 className="mt-1 text-xl font-display font-semibold tracking-tight text-foreground">
                  Automated Verification Scripts & Runbooks
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Programmatic compliance checks and cloud remediation scripts generated for immediate engineering execution.
                </p>
              </div>

              {/* View Switcher & Search Bar */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={artifactSearch}
                    onChange={(e) => setArtifactSearch(e.target.value)}
                    placeholder="Search stack, gap, script..."
                    className="w-48 sm:w-60 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 pl-8 pr-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:border-[var(--brass)] focus:outline-none transition-all"
                  />
                  {artifactSearch && (
                    <button
                      type="button"
                      onClick={() => setArtifactSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      &times;
                    </button>
                  )}
                </div>

                <div className="flex items-center rounded-xl border border-[var(--hairline)] bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => setArtifactViewMode("table")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                      artifactViewMode === "table"
                        ? "bg-[var(--brass)]/15 border border-[var(--brass)]/40 text-[var(--brass)] font-semibold shadow-sm"
                        : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                    title="Dense Table View"
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                    Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setArtifactViewMode("grid")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                      artifactViewMode === "grid"
                        ? "bg-[var(--brass)]/15 border border-[var(--brass)]/40 text-[var(--brass)] font-semibold shadow-sm"
                        : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                    title="Terminal Console View"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                    Console
                  </button>
                </div>
              </div>
            </div>

            {/* Content Rendering: Table View OR Console Grid */}
            {artifactViewMode === "table" ? (
              <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl shadow-[var(--shadow-lift)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] bg-white/[0.03] font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        <th className="px-6 py-4">Cloud Target & Stack</th>
                        <th className="px-4 py-4">Compliance Gap Detected</th>
                        <th className="px-4 py-4">Executable Artifacts</th>
                        <th className="px-4 py-4">Logged Time</th>
                        <th className="px-6 py-4 text-right">Console Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)] text-xs">
                      {filteredArtifacts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-muted-foreground">
                            <Terminal className="mx-auto h-8 w-8 text-muted-foreground opacity-40 mb-2" />
                            <span className="font-semibold block text-foreground">No Matching Artifacts</span>
                            <span className="text-[11px] block mt-1">Adjust search keywords to locate compliance scripts.</span>
                          </td>
                        </tr>
                      ) : (
                        paginatedArtifacts.map((art) => {
                          const stackUpper = (art.stack ?? "CLOUD").toUpperCase();
                          const stackColor = stackUpper.includes("AZURE")
                            ? "border-sky-500/30 bg-sky-500/10 text-sky-400"
                            : stackUpper.includes("AWS")
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                            : stackUpper.includes("GCP") || stackUpper.includes("GOOGLE")
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "border-[var(--brass)]/30 bg-[var(--brass)]/10 text-[var(--brass)]";

                          return (
                            <tr
                              key={art.id}
                              onClick={() => setSelectedArtifactForModal(art)}
                              className="group cursor-pointer transition-colors duration-150 hover:bg-white/[0.03]"
                            >
                              {/* Cloud Target */}
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-wider border uppercase ${stackColor}`}>
                                    {stackUpper}
                                  </span>
                                  <span className="font-mono text-[11px] text-muted-foreground">
                                    ID: {art.id.slice(0, 8)}
                                  </span>
                                </div>
                              </td>

                              {/* Gap Summary */}
                              <td className="px-4 py-4 max-w-md">
                                <div className="font-medium text-foreground group-hover:text-[var(--brass)] transition-colors line-clamp-1">
                                  {art.gap || "General Infrastructure Compliance Check"}
                                </div>
                              </td>

                              {/* Files Included */}
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                                  {art.audit_script?.code && (
                                    <span className="inline-flex items-center gap-1 rounded bg-white/[0.03] px-2 py-0.5 border border-white/5 text-emerald-400">
                                      <FileCode className="h-3 w-3" />
                                      {art.audit_script.filename ?? "audit.py"}
                                    </span>
                                  )}
                                  {art.remediation?.code && (
                                    <span className="inline-flex items-center gap-1 rounded bg-white/[0.03] px-2 py-0.5 border border-white/5 text-sky-400">
                                      <Code className="h-3 w-3" />
                                      {art.remediation.filename ?? "fix.sh"}
                                    </span>
                                  )}
                                  {art.runbook && (
                                    <span className="inline-flex items-center gap-1 rounded bg-white/[0.03] px-2 py-0.5 border border-white/5 text-[var(--brass)]">
                                      <FileText className="h-3 w-3" />
                                      Runbook
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Time */}
                              <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                                {ts(art.created_at)}
                              </td>

                              {/* Action */}
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedArtifactForModal(art);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] font-semibold text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] transition-all cursor-pointer shadow-sm"
                                >
                                  View Console
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Pagination */}
                {filteredArtifacts.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-[var(--hairline)] bg-white/[0.02]">
                    <div className="text-xs font-mono text-muted-foreground">
                      Showing{" "}
                      <span className="font-semibold text-foreground">
                        {Math.min((safeArtifactPage - 1) * artifactPageSize + 1, filteredArtifacts.length)}
                      </span>{" "}
                      to{" "}
                      <span className="font-semibold text-foreground">
                        {Math.min(safeArtifactPage * artifactPageSize, filteredArtifacts.length)}
                      </span>{" "}
                      of <span className="font-semibold text-foreground">{filteredArtifacts.length}</span> compliance scripts
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setArtifactPage((p) => Math.max(1, p - 1))}
                        disabled={safeArtifactPage === 1}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Previous
                      </button>

                      <div className="flex items-center gap-1 font-mono text-xs">
                        {Array.from({ length: totalArtifactPages }, (_, i) => i + 1).map((pg) => {
                          const isActive = pg === safeArtifactPage;
                          return (
                            <button
                              key={pg}
                              type="button"
                              onClick={() => setArtifactPage(pg)}
                              className={`h-7 w-7 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                                isActive
                                  ? "border-[var(--brass)] bg-[var(--brass)]/15 text-[var(--brass)] font-bold shadow-sm"
                                  : "border-transparent text-muted-foreground hover:border-[var(--hairline)] hover:text-foreground"
                              }`}
                            >
                              {pg}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => setArtifactPage((p) => Math.min(totalArtifactPages, p + 1))}
                        disabled={safeArtifactPage === totalArtifactPages}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                      >
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Console Grid View (With Pagination) */
              <div className="space-y-4">
                <div
                  className={
                    paginatedArtifacts.length === 1
                      ? "w-full"
                      : "grid grid-cols-1 lg:grid-cols-2 gap-5"
                  }
                >
                  {paginatedArtifacts.map((art) => (
                    <ArtifactConsoleCard
                      key={art.id}
                      art={art}
                      isSingle={paginatedArtifacts.length === 1}
                    />
                  ))}
                </div>

                {filteredArtifacts.length > artifactPageSize && (
                  <div className="flex items-center justify-between rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4">
                    <div className="text-xs font-mono text-muted-foreground">
                      Page <strong className="text-foreground">{safeArtifactPage}</strong> of {totalArtifactPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setArtifactPage((p) => Math.max(1, p - 1))}
                        disabled={safeArtifactPage === 1}
                        className="px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] disabled:opacity-40 cursor-pointer"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setArtifactPage((p) => Math.min(totalArtifactPages, p + 1))}
                        disabled={safeArtifactPage === totalArtifactPages}
                        className="px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] disabled:opacity-40 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Artifact Inspection Modal (via React Portal) ── */}
            {selectedArtifactForModal && typeof document !== "undefined" && createPortal(
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
                onClick={() => setSelectedArtifactForModal(null)}
                role="dialog"
                aria-modal="true"
              >
                <div
                  className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--hairline)] bg-[var(--shell-bg)] p-6 sm:p-8 shadow-[var(--shadow-lift)] space-y-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Close button with Esc hint */}
                  <button
                    type="button"
                    onClick={() => setSelectedArtifactForModal(null)}
                    className="absolute top-5 right-5 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/25 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-all duration-150 shadow-md cursor-pointer group active:scale-95"
                    aria-label="Close artifact inspection"
                    title="Close (or press Esc)"
                  >
                    <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground/80 group-hover:text-foreground">Close</span>
                    <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
                  </button>

                  {/* Modal Header */}
                  <div className="border-b border-[var(--hairline)] pb-5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold tracking-wider border uppercase bg-sky-500/10 text-sky-400 border-sky-500/30">
                        {(selectedArtifactForModal.stack ?? "CLOUD INFRASTRUCTURE").toUpperCase()}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        Logged: {ts(selectedArtifactForModal.created_at)}
                      </span>
                    </div>
                    <h2 className="mt-2 text-xl font-display font-semibold text-foreground">
                      {selectedArtifactForModal.gap || "Automated Infrastructure Verification"}
                    </h2>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      ID: {selectedArtifactForModal.id}
                    </div>
                  </div>

                  {/* Render Tabbed Console Card directly in Modal */}
                  <ArtifactConsoleCard
                    art={selectedArtifactForModal}
                    isSingle={true}
                  />
                </div>
              </div>,
              document.body
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
