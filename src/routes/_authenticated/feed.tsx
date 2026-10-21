import { useState, useMemo, Suspense } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Globe,
  Landmark,
  Search,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ArrowUpRight,
  Zap,
  Table as TableIcon,
  LayoutGrid,
  Sparkles,
  BookOpen,
  Scale,
  FileText,
  SlidersHorizontal,
  ArrowRight,
  Filter,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { JurisdictionChip } from "@/components/clausegraph/JurisdictionChip";
import { federalRegisterQuery, regulationsQuery } from "@/data/queries";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Regulatory Feed & Intake — ClauseGraph" },
      {
        name: "description",
        content:
          "Dual-stream regulatory intelligence: indexed cross-border statutory ontology alongside live filings from the U.S. Federal Register.",
      },
      { property: "og:title", content: "Regulatory Feed & Intake — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Dual-stream regulatory intelligence: indexed cross-border statutory ontology alongside live filings from the U.S. Federal Register.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    return Promise.all([
      context.queryClient.ensureQueryData(regulationsQuery),
      context.queryClient.ensureQueryData(federalRegisterQuery),
    ]);
  },
  component: FeedPage,
  errorComponent: FeedError,
});

function FeedPage() {
  const { data: regs } = useSuspenseQuery(regulationsQuery);
  const { data: fedData } = useSuspenseQuery(federalRegisterQuery);

  // Active Stream Tab: Curated Ontology vs Live Federal Register
  const [activeStream, setActiveStream] = useState<"curated" | "federal">("curated");

  // Curated ontology controls
  const [searchQuery, setSearchQuery] = useState("");
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Federal Register controls
  const [fedTypeFilter, setFedTypeFilter] = useState<string>("ALL");
  const [fedSearch, setFedSearch] = useState("");
  const [fedViewMode, setFedViewMode] = useState<"table" | "grid">("table");

  // Calculate Metrics
  const totalObligations = useMemo(() => {
    return regs.reduce((sum, r) => sum + (r.obligations?.length ?? 0), 0);
  }, [regs]);

  const uniqueJurisdictions = useMemo(() => {
    return Array.from(new Set(regs.map((r) => r.jurisdiction)));
  }, [regs]);

  // Filter curated ontology
  const filteredRegs = useMemo(() => {
    return regs.filter((r) => {
      const matchesJurisdiction =
        jurisdictionFilter === "ALL" || r.jurisdiction === jurisdictionFilter;
      if (!matchesJurisdiction) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchTitle = (r.title || "").toLowerCase().includes(q);
      const matchSummary = (r.summary || "").toLowerCase().includes(q);
      const matchId = (r.id || "").toLowerCase().includes(q);
      return matchTitle || matchSummary || matchId;
    });
  }, [regs, jurisdictionFilter, searchQuery]);

  // Filter Federal Register docs
  const filteredFedDocs = useMemo(() => {
    return fedData.results.filter((doc) => {
      const matchesType =
        fedTypeFilter === "ALL" || (doc.type || "").toUpperCase() === fedTypeFilter;
      if (!matchesType) return false;

      if (!fedSearch.trim()) return true;
      const q = fedSearch.toLowerCase();
      const matchTitle = (doc.title || "").toLowerCase().includes(q);
      const matchAgency = (doc.agencies || []).some((a) =>
        (a.name || "").toLowerCase().includes(q)
      );
      const matchNumber = (doc.document_number || "").toLowerCase().includes(q);
      return matchTitle || matchAgency || matchNumber;
    });
  }, [fedData.results, fedTypeFilter, fedSearch]);

  return (
    <AppShell>
      <div className="w-full max-w-[1440px] mx-auto space-y-6 pb-16">
        {/* ── Top Executive Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Statutory Ingestion &middot; Real-time Intake
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Regulatory Feed &amp; Horizon Radar
            </h1>
            <p className="mt-1 text-xs sm:text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Cross-border indexed statutory mandates paired with real-time intake from the U.S. Federal Register.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/simulate"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brass)] to-[#c59a3f] px-4 py-2 text-xs font-semibold text-[var(--ink-base)] shadow-lg shadow-[var(--brass)]/15 transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <Zap className="h-3.5 w-3.5" />
              Stress Test Feed on Portfolio
            </Link>
          </div>
        </div>

        {/* ── Executive Metric Ribbon ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-[var(--brass)]/50 hover:shadow-[0_20px_40px_-15px_rgba(201,166,107,0.18)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Indexed Frameworks
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--brass)] transition-colors group-hover:border-[var(--brass)]/30 group-hover:bg-[var(--brass)]/10">
                <Landmark className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {regs.length} Active
              </span>
              <span className="text-[10px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Core Ontology
              </span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-cyan-500/50 hover:shadow-[0_20px_40px_-15px_rgba(6,182,212,0.2)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Tracked Obligations
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-cyan-400 transition-colors group-hover:border-cyan-500/30 group-hover:bg-cyan-500/10">
                <Scale className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {totalObligations} Rules
              </span>
              <span className="text-[10px] font-mono text-cyan-400 border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                Semantic Graph
              </span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-[0_20px_40px_-15px_rgba(16,185,129,0.2)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Live Federal Filings
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-emerald-400 transition-colors group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10">
                <Globe className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {fedData.results.length} Documents
              </span>
              <span className="text-[10px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Live Stream
              </span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-purple-500/50 hover:shadow-[0_20px_40px_-15px_rgba(168,85,247,0.2)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">
                Active Jurisdictions
              </span>
              <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-purple-400 transition-colors group-hover:border-purple-500/30 group-hover:bg-purple-500/10">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {uniqueJurisdictions.length} Regions
              </span>
              <span className="text-[10px] font-mono text-purple-400 border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 rounded-full">
                EU &middot; US &middot; UK
              </span>
            </div>
          </div>
        </div>

        {/* ── Main Stream Switcher (Curated Ontology ⟷ Live Federal Register) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl">
          <div className="flex items-center gap-1.5 p-1.5 switcher-track rounded-xl">
            <button
              type="button"
              onClick={() => setActiveStream("curated")}
              className={`group flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-sans font-medium transition-all duration-200 cursor-pointer ${
                activeStream === "curated"
                  ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
              }`}
            >
              <Landmark className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${activeStream === "curated" ? "text-[var(--primary-foreground)]" : "text-[var(--brass)]"}`} />
              <span>Curated Ontology Stream</span>
              <span className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                activeStream === "curated"
                  ? "bg-black/20 text-[var(--primary-foreground)] border-black/20"
                  : "bg-black/5 dark:bg-white/[0.05] text-foreground border-[var(--hairline)] dark:border-white/10"
              }`}>
                {regs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveStream("federal")}
              className={`group flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-sans font-medium transition-all duration-200 cursor-pointer ${
                activeStream === "federal"
                  ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-black font-semibold shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
              }`}
            >
              <Globe className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${activeStream === "federal" ? "text-white dark:text-black" : "text-emerald-600 dark:text-emerald-400"}`} />
              <span>U.S. Federal Register Live</span>
              <span className={`ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                activeStream === "federal"
                  ? "bg-black/20 text-white dark:text-black border-black/20"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
              }`}>
                LIVE
              </span>
            </button>
          </div>

          <div className="px-3 text-xs font-mono text-muted-foreground hidden lg:block">
            {activeStream === "curated"
              ? "Statutory obligations indexed against contract portfolio"
              : "Real-time government register intake with automated stress-testing"}
          </div>
        </div>

        {/* ── STREAM 1: CURATED REGULATORY ONTOLOGY ── */}
        {activeStream === "curated" && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 backdrop-blur-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground mr-1 flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5 text-[var(--brass)]" />
                  Jurisdiction:
                </span>
                {["ALL", ...uniqueJurisdictions].map((jur) => {
                  const isActive = jurisdictionFilter === jur;
                  return (
                    <button
                      key={jur}
                      type="button"
                      onClick={() => setJurisdictionFilter(jur)}
                      className={`px-3 py-1.5 rounded-xl font-mono text-xs transition-all cursor-pointer ${
                        isActive
                          ? "bg-[var(--brass)] text-[var(--ink-base)] font-bold shadow-md shadow-[var(--brass)]/20"
                          : "border border-[var(--hairline)] bg-white/[0.03] text-muted-foreground hover:text-foreground hover:border-white/20"
                      }`}
                    >
                      {jur === "ALL" ? "All Jurisdictions" : jur}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search regulation or mandate..."
                    className="w-52 sm:w-64 rounded-xl border search-input-theme pl-8 pr-3 py-1.5 text-xs font-sans text-foreground placeholder:text-muted-foreground focus:border-[var(--brass)] focus:outline-none transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      &times;
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 rounded-xl switcher-track p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans transition-all duration-200 cursor-pointer ${
                      viewMode === "table"
                        ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
                    }`}
                    title="Dense Table View"
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                    Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans transition-all duration-200 cursor-pointer ${
                      viewMode === "grid"
                        ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-sm ring-1 ring-black/10 dark:ring-white/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
                    }`}
                    title="Grid Card View"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Grid
                  </button>
                </div>
              </div>
            </div>

            {/* View Rendering: Table vs Grid */}
            {viewMode === "table" ? (
              <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl shadow-[var(--shadow-lift)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] bg-white/[0.03] font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        <th className="px-6 py-4">Jurisdiction</th>
                        <th className="px-4 py-4">Statutory Act &amp; Title</th>
                        <th className="px-4 py-4">Ontology Summary</th>
                        <th className="px-4 py-4">Obligations</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)] text-xs">
                      {filteredRegs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-muted-foreground">
                            <Landmark className="mx-auto h-8 w-8 text-muted-foreground opacity-40 mb-2" />
                            <span className="font-semibold block text-foreground">No Matching Regulations Found</span>
                            <span className="text-[11px] block mt-1">Adjust search keywords or jurisdiction filter.</span>
                          </td>
                        </tr>
                      ) : (
                        filteredRegs.map((r) => (
                          <tr
                            key={r.id}
                            className="group hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <JurisdictionChip jurisdiction={r.jurisdiction} />
                                <span className="font-mono text-[10px] text-muted-foreground uppercase">
                                  {r.id}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-4 max-w-xs">
                              <Link
                                to="/regulations/$regId"
                                params={{ regId: r.id }}
                                className="font-semibold text-foreground group-hover:text-[var(--brass)] transition-colors block truncate"
                              >
                                {r.title}
                              </Link>
                            </td>

                            <td className="px-4 py-4 max-w-md">
                              <p className="text-muted-foreground line-clamp-2 leading-relaxed text-xs">
                                {r.summary}
                              </p>
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap font-mono">
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--brass)]/30 bg-[var(--brass)]/10 px-2.5 py-0.5 text-xs text-[var(--brass)] font-bold">
                                <Scale className="h-3 w-3" />
                                {r.obligations?.length ?? 0} Mandates
                              </span>
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <Link
                                to="/regulations/$regId"
                                params={{ regId: r.id }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] font-semibold text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] transition-all cursor-pointer shadow-sm"
                              >
                                Inspect
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-3 border-t border-[var(--hairline)] bg-white/[0.02] flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>
                    Showing <strong className="text-foreground">{filteredRegs.length}</strong> of {regs.length} statutory frameworks
                  </span>
                  <Link to="/simulate" className="text-[var(--brass)] hover:underline flex items-center gap-1">
                    Launch Multi-Regulation Stress Test <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ) : (
              /* Grid Card View */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRegs.map((r) => (
                  <Link
                    key={r.id}
                    to="/regulations/$regId"
                    params={{ regId: r.id }}
                    className="group rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-5 backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-[var(--brass)]/50 hover:shadow-xl flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <JurisdictionChip jurisdiction={r.jurisdiction} />
                          <span className="font-mono text-[10px] text-muted-foreground">{r.id}</span>
                        </div>
                        <span className="font-mono text-[10px] uppercase font-bold text-[var(--brass)] bg-[var(--brass)]/10 border border-[var(--brass)]/20 px-2 py-0.5 rounded-full">
                          {r.obligations?.length ?? 0} Obligations
                        </span>
                      </div>

                      <h3 className="text-base font-display font-semibold text-foreground group-hover:text-[var(--brass)] transition-colors">
                        {r.title}
                      </h3>

                      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
                        {r.summary}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/5 text-xs font-mono text-muted-foreground">
                      <span>Indexed against portfolio</span>
                      <span className="text-[var(--brass)] group-hover:translate-x-1 transition-transform flex items-center gap-1 font-semibold">
                        Inspect Mandates <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STREAM 2: LIVE U.S. FEDERAL REGISTER FILINGS ── */}
        {activeStream === "federal" && (
          <div className="space-y-4">
            {/* Filter & Search Bar for Federal Register */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 backdrop-blur-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground mr-1 flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5 text-emerald-400" />
                  Document Type:
                </span>
                {["ALL", "RULE", "PROPOSED RULE", "NOTICE", "PRESIDENTIAL DOCUMENT"].map((type) => {
                  const isActive = fedTypeFilter === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFedTypeFilter(type)}
                      className={`px-3 py-1.5 rounded-xl font-mono text-xs transition-all cursor-pointer ${
                        isActive
                          ? "bg-emerald-500 text-[var(--ink-base)] font-bold shadow-md shadow-emerald-500/20"
                          : "border border-[var(--hairline)] bg-white/[0.03] text-muted-foreground hover:text-foreground hover:border-white/20"
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={fedSearch}
                    onChange={(e) => setFedSearch(e.target.value)}
                    placeholder="Search filing or agency..."
                    className="w-52 sm:w-64 rounded-xl border search-input-theme pl-8 pr-3 py-1.5 text-xs font-sans text-foreground placeholder:text-muted-foreground focus:border-emerald-500 focus:outline-none transition-all"
                  />
                  {fedSearch && (
                    <button
                      type="button"
                      onClick={() => setFedSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                    >
                      &times;
                    </button>
                  )}
                </div>

                <div className="flex items-center rounded-xl border border-[var(--hairline)] bg-white/[0.03] p-1">
                  <button
                    type="button"
                    onClick={() => setFedViewMode("table")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                      fedViewMode === "table"
                        ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-semibold shadow-sm"
                        : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                    title="Dense Table View"
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                    Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setFedViewMode("grid")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                      fedViewMode === "grid"
                        ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-semibold shadow-sm"
                        : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                    title="Grid Card View"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Grid
                  </button>
                </div>
              </div>
            </div>

            {/* Federal Register View Rendering: Table vs Grid */}
            {fedViewMode === "table" ? (
              <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl shadow-[var(--shadow-lift)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--hairline)] bg-white/[0.03] font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        <th className="px-6 py-4">Filing Title &amp; Doc Number</th>
                        <th className="px-4 py-4">Issuing Agency</th>
                        <th className="px-4 py-4">Doc Type</th>
                        <th className="px-4 py-4">Publication Date</th>
                        <th className="px-6 py-4 text-right">Portfolio Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--hairline)] text-xs">
                      {filteredFedDocs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-muted-foreground">
                            <Globe className="mx-auto h-8 w-8 text-muted-foreground opacity-40 mb-2" />
                            <span className="font-semibold block text-foreground">No Matching Filings Found</span>
                            <span className="text-[11px] block mt-1">Adjust search keywords or document type.</span>
                          </td>
                        </tr>
                      ) : (
                        filteredFedDocs.map((doc) => (
                          <tr
                            key={doc.document_number}
                            className="group hover:bg-white/[0.03] transition-colors"
                          >
                            <td className="px-6 py-4 max-w-md">
                              <a
                                href={doc.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-foreground group-hover:text-emerald-400 transition-colors block line-clamp-2 leading-relaxed"
                              >
                                {doc.title}
                              </a>
                              <span className="mt-1 font-mono text-[10px] text-muted-foreground block">
                                Doc #{doc.document_number}
                              </span>
                            </td>

                            <td className="px-4 py-4 max-w-xs">
                              <span className="text-foreground/90 font-mono text-[11px] block truncate">
                                {doc.agencies?.[0]?.name ?? "Federal Agency"}
                              </span>
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md font-mono text-[9.5px] uppercase font-bold border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                                {doc.type ?? "RULE"}
                              </span>
                            </td>

                            <td className="px-4 py-4 whitespace-nowrap font-mono text-muted-foreground text-[11px]">
                              {doc.publication_date}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                              <Link
                                to="/simulate"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-sm"
                              >
                                Stress Test
                                <Zap className="h-3 w-3" />
                              </Link>

                              <a
                                href={doc.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-3 border-t border-[var(--hairline)] bg-white/[0.02] flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>
                    Federal Register API v1 &middot; Active filings: {filteredFedDocs.length}
                  </span>
                  <a
                    href="https://www.federalregister.gov"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    Official Portal <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : (
              /* Grid Card View for Federal Register */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredFedDocs.map((doc) => (
                  <div
                    key={doc.document_number}
                    className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-5 backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-xl flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[9.5px] uppercase font-bold border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">
                          {doc.type ?? "RULE"}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {doc.publication_date}
                        </span>
                      </div>

                      <a
                        href={doc.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-foreground hover:text-emerald-400 transition-colors line-clamp-2 leading-relaxed block"
                      >
                        {doc.title}
                      </a>

                      <p className="font-mono text-[11px] text-muted-foreground truncate">
                        {doc.agencies?.[0]?.name ?? "Federal Agency"} &middot; #{doc.document_number}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <a
                        href={doc.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        View Gazette <ExternalLink className="h-3 w-3" />
                      </a>

                      <Link
                        to="/simulate"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-mono text-emerald-400 font-semibold hover:bg-emerald-500/25 transition-all"
                      >
                        Stress Test <Zap className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FeedError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <AppShell>
      <div className="rounded-3xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-8 max-w-md mx-auto text-center backdrop-blur-xl space-y-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--risk)] font-bold">
          Feed Stream Interrupted
        </p>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Regulatory intake stream unavailable
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {error.message || "An unexpected error occurred while connecting to regulatory services."}
        </p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="rounded-xl bg-[var(--brass)] px-4 py-2 text-xs font-mono font-bold text-[var(--ink-base)] hover:brightness-110 transition-all cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    </AppShell>
  );
}

