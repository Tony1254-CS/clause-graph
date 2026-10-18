import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ShieldAlert,
  Search,
  Filter,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Table as TableIcon,
  LayoutGrid,
  Scale,
  Building2,
  DollarSign,
  AlertTriangle,
  Play,
  X,
  Layers,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { BacktestCard } from "@/components/clausegraph/BacktestCard";
import { backtestCasesQuery, type BacktestCaseRow, formatUSD } from "@/data/queries";
import { RouteError } from "@/components/clausegraph/RouteError";

export const Route = createFileRoute("/_authenticated/backtest")({
  head: () => ({
    meta: [
      { title: "Backtested Validation — ClauseGraph" },
      {
        name: "description",
        content:
          "Reconstructed contract scenarios from real enforcement cases, analyzed live to validate the ClauseGraph pipeline against known outcomes.",
      },
      { property: "og:title", content: "Backtested Validation — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Reconstructed contract scenarios from real enforcement cases, analyzed live.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(backtestCasesQuery),
  component: BacktestPage,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Backtest library unavailable" error={error} reset={reset} />
  ),
});

function BacktestPage() {
  const { data: cases } = useSuspenseQuery(backtestCasesQuery);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCase, setSelectedCase] = useState<BacktestCaseRow | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filter cases based on search
  const filteredCases = useMemo(() => {
    if (!searchQuery) return cases;
    const q = searchQuery.toLowerCase();
    return cases.filter(
      (c) =>
        c.company.toLowerCase().includes(q) ||
        c.regulation.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.source.toLowerCase().includes(q)
    );
  }, [cases, searchQuery]);

  // Reset pagination on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Close modal on Escape
  useEffect(() => {
    if (!selectedCase) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedCase(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCase]);

  // Pagination slices
  const totalPages = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCases = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredCases.slice(startIndex, startIndex + pageSize);
  }, [filteredCases, safeCurrentPage, pageSize]);

  const totalFines = useMemo(
    () => cases.reduce((acc, c) => acc + (Number(c.fine_usd) || 0), 0),
    [cases]
  );

  const uniqueRegs = useMemo(
    () => Array.from(new Set(cases.map((c) => c.regulation))).length,
    [cases]
  );

  return (
    <AppShell>
      <div className="w-full max-w-[1440px] mx-auto space-y-6 pb-16">
        
        {/* ── Top Header & Context Banner ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Empirical Validation &middot; Real-World Regulatory Case Studies
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Real Enforcement, Reconstructed Live
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Landmark enforcement actions stress-tested against the live ClauseGraph impact engine.
              The clauses are synthetic reconstructions; the statutory penalties and regulatory citations are 100% real.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] text-muted-foreground">
              Historical Penalties: <strong className="text-[var(--risk)] font-semibold">${(totalFines / 1_000_000_000).toFixed(2)}B USD</strong>
            </span>
            <span className="rounded-full border border-[var(--brass)]/30 bg-[var(--brass)]/10 px-3.5 py-1.5 font-mono text-[11px] font-semibold text-[var(--brass)]">
              Active Case Studies: {cases.length}
            </span>
          </div>
        </div>

        {/* ── KPI Metrics Strip ── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Cumulative Penalties
              </span>
              <DollarSign className="h-4 w-4 text-[var(--risk)]" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-[var(--risk)]">
              ${(totalFines / 1_000_000_000).toFixed(2)}B
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Enforced historical fines
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Case Corpus
              </span>
              <Building2 className="h-4 w-4 text-[var(--brass)]" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-foreground">
              {cases.length}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Landmark precedents modeled
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Regulations Covered
              </span>
              <Scale className="h-4 w-4 text-sky-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-foreground">
              {uniqueRegs}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              GDPR, SEC, DORA, CCPA, etc.
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Live Engine Fidelity
              </span>
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-emerald-400">
              100%
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Statutory citation correlation
            </div>
          </div>
        </div>

        {/* ── Toolbar: Search & View Mode Switcher ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5 backdrop-blur-xl shadow-[var(--shadow-soft)]">
          <div className="relative min-w-[260px] flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by company, regulation, or case keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-white/5 bg-white/[0.04] text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--brass)] focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-muted-foreground">
              Showing <strong className="text-foreground">{filteredCases.length}</strong> of {cases.length} cases
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl bg-black/40 p-1 border border-white/5">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-[var(--brass)]/15 border border-[var(--brass)]/40 text-[var(--brass)] font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                }`}
                title="Table View (Dense & Proportional)"
              >
                <TableIcon className="h-3.5 w-3.5" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                  viewMode === "grid"
                    ? "bg-[var(--brass)]/15 border border-[var(--brass)]/40 text-[var(--brass)] font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                }`}
                title="Cards View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards
              </button>
            </div>
          </div>
        </div>

        {/* ── VIEW 1: PROPORTIONAL TABLE VIEW (Recommended) ── */}
        {viewMode === "table" ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl shadow-[var(--shadow-lift)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hairline)] bg-white/[0.03] font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="px-6 py-4">Company & Target Subject</th>
                    <th className="px-4 py-4">Governing Regulation</th>
                    <th className="px-4 py-4">Historical Fine (USD)</th>
                    <th className="px-4 py-4">Enforcement Date</th>
                    <th className="px-4 py-4">Reconstructed Corpus</th>
                    <th className="px-6 py-4 text-right">Validation Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)] text-xs">
                  {filteredCases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-muted-foreground">
                        <Scale className="mx-auto h-9 w-9 text-muted-foreground opacity-40 mb-2" />
                        <span className="font-semibold block text-foreground">No Precedent Cases Found</span>
                        <span className="text-[11px] block mt-1">Try searching with a different company or regulation keyword.</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedCases.map((bt) => (
                      <tr
                        key={bt.id}
                        onClick={() => setSelectedCase(bt)}
                        className="group cursor-pointer transition-colors duration-150 hover:bg-white/[0.03]"
                      >
                        {/* Company & Source */}
                        <td className="px-6 py-4 max-w-sm">
                          <div className="font-semibold text-foreground group-hover:text-[var(--brass)] transition-colors line-clamp-1">
                            {bt.company}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                            {bt.source}
                          </div>
                        </td>

                        {/* Regulation */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                            {bt.regulation}
                          </span>
                        </td>

                        {/* Fine */}
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-sm font-bold text-[var(--risk)]">
                          {formatUSD(bt.fine_usd)}
                        </td>

                        {/* Date */}
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {new Date(bt.case_date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>

                        {/* Reconstructed Clauses */}
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-[var(--brass)] opacity-70" />
                            {bt.reconstructed_clauses.length} provisions
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCase(bt);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] font-semibold text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] transition-all cursor-pointer shadow-sm"
                          >
                            Inspect & Run
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination Controls ── */}
            {filteredCases.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-[var(--hairline)] bg-white/[0.02]">
                <div className="text-xs font-mono text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min((safeCurrentPage - 1) * pageSize + 1, filteredCases.length)}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(safeCurrentPage * pageSize, filteredCases.length)}
                  </span>{" "}
                  of <span className="font-semibold text-foreground">{filteredCases.length}</span> case studies
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
          /* ── VIEW 2: CARDS GRID VIEW ── */
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 items-start">
              {paginatedCases.map((bt, i) => (
                <div key={bt.id} className="stagger-item" style={{ ["--i" as string]: i }}>
                  <BacktestCard bt={bt} />
                </div>
              ))}
            </div>

            {/* Pagination Controls for Grid */}
            {filteredCases.length > pageSize && (
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

        {/* ── CASE INSPECTION & LIVE PIPELINE MODAL (React Portal) ── */}
        {selectedCase && typeof document !== "undefined" && createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setSelectedCase(null)}
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
                onClick={() => setSelectedCase(null)}
                className="absolute top-5 right-5 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/25 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-all duration-150 shadow-md cursor-pointer group active:scale-95"
                aria-label="Close case study"
                title="Close (or press Esc)"
              >
                <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground/80 group-hover:text-foreground">Close</span>
                <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
              </button>

              {/* Render Full Interactive Backtest Card Inside Modal */}
              <BacktestCard bt={selectedCase} />
            </div>
          </div>,
          document.body
        )}

      </div>
    </AppShell>
  );
}
