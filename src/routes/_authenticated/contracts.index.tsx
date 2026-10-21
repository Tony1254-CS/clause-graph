import { useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Upload,
  Search,
  X,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Building2,
  FileText,
  DollarSign,
  Layers,
  TrendingUp,
  Scale,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  ArrowUpDown,
} from "lucide-react";
import { ContractCard } from "@/components/clausegraph/ContractCard";
import { UploadContract } from "@/components/clausegraph/UploadContract";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { contractsQuery, formatUSD } from "@/data/queries";
import type { Contract } from "@/data/types";

export const Route = createFileRoute("/_authenticated/contracts/")({
  head: () => ({
    meta: [
      { title: "Contracts — ClauseGraph" },
      {
        name: "description",
        content: "Active contract portfolio with AI-extracted clauses and regulatory links.",
      },
      { property: "og:title", content: "Contracts — ClauseGraph" },
      {
        property: "og:description",
        content: "Active contract portfolio with AI-extracted clauses and regulatory links.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(contractsQuery),
  component: ContractsIndex,
  errorComponent: ContractsError,
});

type FilterTab = "all" | "high" | "standard" | "multi";
type SortOption = "value-desc" | "value-asc" | "clauses-desc" | "name-asc";
type ViewMode = "grid" | "table";

function ContractsIndex() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [sortBy, setSortBy] = useState<SortOption>("value-desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Portfolio KPI calculations
  const totalNotional = useMemo(() => contracts.reduce((s, c) => s + c.value, 0), [contracts]);
  const totalClauses = useMemo(
    () => contracts.reduce((s, c) => s + c.clauses.length, 0),
    [contracts],
  );
  const avgNotional = useMemo(
    () => (contracts.length > 0 ? totalNotional / contracts.length : 0),
    [contracts, totalNotional],
  );
  const totalUniqueRegs = useMemo(() => {
    const regs = new Set<string>();
    contracts.forEach((c) => {
      c.clauses.forEach((cl) => {
        cl.linked_regs?.forEach((r) => regs.add(r));
      });
    });
    return regs.size;
  }, [contracts]);

  // Filtering & Search
  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    // Search query filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(q);
        const partyMatch = c.counterparty.toLowerCase().includes(q);
        const idMatch = c.id.toLowerCase().includes(q);
        const regMatch = c.clauses.some((cl) =>
          cl.linked_regs?.some((r) => r.toLowerCase().includes(q)),
        );
        return nameMatch || partyMatch || idMatch || regMatch;
      });
    }

    // Category / value tier filter
    if (filterTab === "high") {
      result = result.filter((c) => c.value >= 10_000_000);
    } else if (filterTab === "standard") {
      result = result.filter((c) => c.value < 10_000_000);
    } else if (filterTab === "multi") {
      result = result.filter((c) => c.clauses.length >= 2);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "value-desc") return b.value - a.value;
      if (sortBy === "value-asc") return a.value - b.value;
      if (sortBy === "clauses-desc") return b.clauses.length - a.clauses.length;
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      return 0;
    });

    return result;
  }, [contracts, searchQuery, filterTab, sortBy]);

  return (
    <div className="w-full max-w-[1340px] pb-12">
      {/* ── Top Header & Upload CTA ──────────────────────────── */}
      <header className="mb-7 flex flex-wrap items-end justify-between gap-6 border-b border-[var(--hairline)] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--brass)_25%,transparent)] bg-[color-mix(in_oklab,var(--brass)_8%,transparent)] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--brass)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)] shadow-[0_0_8px_var(--brass)] animate-pulse" />
            Portfolio Intelligence · {contracts.length} Active Instruments
          </div>
          <h1 className="mt-2.5 font-display text-[34px] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[38px]">
            Contracts Portfolio
          </h1>
          <p className="mt-2 max-w-[65ch] text-[13.5px] leading-relaxed text-muted-foreground">
            Monitor enterprise SLAs and bilateral agreements with AI-parsed clauses, direct
            regulatory mapping, and continuous blast-radius simulation.
          </p>
        </div>

        <button
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-2.5 rounded-full bg-[var(--brass)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-[0_10px_30px_-10px_rgba(94,234,212,0.45)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[var(--brass-strong)] hover:shadow-[0_14px_36px_-8px_rgba(94,234,212,0.6)] active:translate-y-0"
        >
          <Upload className="h-4 w-4" strokeWidth={2} />
          Upload New Contract
        </button>
      </header>

      {/* ── 4 Executive KPI Metric Cards ─────────────────────── */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Aggregate Notional */}
        <div className="group relative overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-[var(--hairline-strong)] hover:shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Total Portfolio Value
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--brass)]">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 font-mono text-[24px] font-bold tracking-tight text-foreground">
            {formatUSD(totalNotional)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            Active notional exposure under monitoring
          </div>
        </div>

        {/* Card 2: Instruments */}
        <div className="group relative overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-[var(--hairline-strong)] hover:shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Instruments Indexed
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--brass)]">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 font-mono text-[24px] font-bold tracking-tight text-foreground">
            {contracts.length}{" "}
            <span className="text-[14px] font-normal text-muted-foreground">contracts</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Building2 className="h-3 w-3" />
            Across top-tier counterparties & SLAs
          </div>
        </div>

        {/* Card 3: Mapped Clauses */}
        <div className="group relative overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-[var(--hairline-strong)] hover:shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Indexed Obligations
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--brass)]">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 font-mono text-[24px] font-bold tracking-tight text-foreground">
            {totalClauses}{" "}
            <span className="text-[14px] font-normal text-muted-foreground">clauses</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-brass" />
            Extracted and linked to regulatory rules
          </div>
        </div>

        {/* Card 4: Average Notional */}
        <div className="group relative overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl transition-all duration-300 hover:border-[var(--hairline-strong)] hover:shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Average Instrument
            </span>
            <div className="grid h-8 w-8 place-items-center rounded-xl border border-white/5 bg-white/[0.04] text-[var(--brass)]">
              <Scale className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 font-mono text-[24px] font-bold tracking-tight text-foreground">
            {formatUSD(avgNotional)}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            {totalUniqueRegs} distinct regulations mapped
          </div>
        </div>
      </section>

      {/* ── Interactive Filter & Search Controls Bar ─────────── */}
      <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-[var(--hairline)] bg-[var(--surface-raised)]/40 p-3 backdrop-blur-xl">
        {/* Search Input */}
        <div className="relative min-w-[240px] flex-1 sm:max-w-[400px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by contract name, counterparty, ID, or regulation..."
            className="h-9 w-full rounded-full border search-input-theme pl-9 pr-8 text-[13px] font-sans text-foreground placeholder:text-muted-foreground focus:border-[var(--brass)] focus:outline-none focus:ring-1 focus:ring-[var(--brass)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="inline-flex flex-wrap items-center gap-1.5 p-1 rounded-xl switcher-track">
          <button
            onClick={() => setFilterTab("all")}
            className={`rounded-lg px-3 py-1 font-mono text-[11px] font-medium transition-all duration-200 cursor-pointer ${
              filterTab === "all"
                ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-md ring-1 ring-white/20"
                : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
            }`}
          >
            All ({contracts.length})
          </button>
          <button
            onClick={() => setFilterTab("high")}
            className={`rounded-lg px-3 py-1 font-mono text-[11px] font-medium transition-all duration-200 cursor-pointer ${
              filterTab === "high"
                ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-md ring-1 ring-white/20"
                : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
            }`}
          >
            High Value (&gt;$10M)
          </button>
          <button
            onClick={() => setFilterTab("standard")}
            className={`rounded-lg px-3 py-1 font-mono text-[11px] font-medium transition-all duration-200 cursor-pointer ${
              filterTab === "standard"
                ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-md ring-1 ring-white/20"
                : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
            }`}
          >
            Core (&lt;$10M)
          </button>
          <button
            onClick={() => setFilterTab("multi")}
            className={`rounded-lg px-3 py-1 font-mono text-[11px] font-medium transition-all duration-200 cursor-pointer ${
              filterTab === "multi"
                ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-md ring-1 ring-white/20"
                : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
            }`}
          >
            Multi-Clause (2+)
          </button>
        </div>

        {/* Sort & View Mode Toggles */}
        <div className="flex items-center gap-2">
          {/* Sort selector */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
              <SelectTrigger className="h-9 min-w-[170px] rounded-xl border search-input-theme px-3 font-mono text-xs text-foreground hover:border-[var(--brass)]/40 focus:ring-1 focus:ring-[var(--brass)] cursor-pointer">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent className="border border-[var(--hairline)] bg-[var(--surface-raised)]/95 backdrop-blur-xl text-foreground font-mono text-xs shadow-xl">
                <SelectItem value="value-desc" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">
                  Highest Notional
                </SelectItem>
                <SelectItem value="value-asc" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">
                  Lowest Notional
                </SelectItem>
                <SelectItem value="clauses-desc" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">
                  Most Clauses
                </SelectItem>
                <SelectItem value="name-asc" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">
                  Alphabetical (A–Z)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Grid vs Table Switcher */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl switcher-track">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-mono text-[11px] transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-md ring-1 ring-white/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
              }`}
              title="Grid View"
              aria-label="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-mono text-[11px] transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-md ring-1 ring-white/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/60 dark:hover:bg-white/[0.08]"
              }`}
              title="Table View"
              aria-label="Table View"
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Content View Rendering ───────────────────────────── */}
      {contracts.length === 0 ? (
        /* Empty Portfolio State */
        <div className="glass-panel mx-auto max-w-[680px] p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[var(--hairline-strong)] bg-[color-mix(in_oklab,var(--brass)_14%,transparent)] text-[var(--brass)]">
            <FileText className="h-7 w-7" />
          </div>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--brass)]">
            Portfolio Empty
          </p>
          <h2 className="mt-2 font-display text-[26px] font-semibold tracking-tight text-foreground">
            No contracts in your workspace yet.
          </h2>
          <p className="mx-auto mt-2.5 max-w-[50ch] text-[13.5px] leading-relaxed text-muted-foreground">
            Upload a legal instrument to allow ClauseGraph to automatically extract clauses, link
            them to our 10-regulation ontology, and model potential compliance blast radius.
          </p>
          <button
            onClick={() => setUploadOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--brass-strong)]"
          >
            <Upload className="h-4 w-4" strokeWidth={2} />
            Upload Your First Contract
          </button>
        </div>
      ) : filteredContracts.length === 0 ? (
        /* No Search / Filter Matches */
        <div className="glass-panel mx-auto max-w-[580px] p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/5 bg-white/[0.04] text-muted-foreground">
            <Search className="h-6 w-6" />
          </div>
          <h3 className="mt-4 font-display text-[20px] font-semibold text-foreground">
            No matching contracts found
          </h3>
          <p className="mt-2 text-[13px] text-muted-foreground">
            No instruments matched "{searchQuery || filterTab}". Try adjusting your filters or
            search keywords.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setFilterTab("all");
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-[var(--brass)] transition-all hover:bg-[color-mix(in_oklab,var(--brass)_12%,transparent)]"
          >
            Clear Filters & Search
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* ── Grid View ────────────────────────────────────────── */
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredContracts.map((c, i) => (
            <div key={c.id} className="stagger-item" style={{ ["--i" as string]: i }}>
              <ContractCard contract={c} />
            </div>
          ))}
        </div>
      ) : (
        /* ── Dense Table / List View ──────────────────────────── */
        <div className="overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[var(--hairline)] bg-white/[0.02] font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="px-6 py-3.5">Instrument Name</th>
                  <th className="px-6 py-3.5">Counterparty</th>
                  <th className="px-4 py-3.5">Clauses & Regs</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Notional Value</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hairline)] text-[13px]">
                {filteredContracts.map((c) => {
                  const uniqueRegs = Array.from(
                    new Set(c.clauses.flatMap((cl) => cl.linked_regs || [])),
                  );
                  return (
                    <tr
                      key={c.id}
                      data-copilot-context={JSON.stringify({
                        type: "contract",
                        id: c.id,
                        title: c.name,
                        content: `Contract '${c.name}' with ${c.counterparty}. Value: ${formatUSD(c.value)}. Clauses: ${c.clauses.length}. Applicable statutes: ${uniqueRegs.join(", ") || "None"}.`,
                        metadata: { contract_id: c.id, counterparty: c.counterparty, value: c.value },
                      })}
                      className="group transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--brass)_6%,transparent)]"
                    >
                      <td className="px-6 py-4">
                        <Link
                          to="/contracts/$contractId"
                          params={{ contractId: c.id }}
                          className="font-medium text-foreground transition-colors group-hover:text-[var(--brass)]"
                        >
                          {c.name}
                        </Link>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          ID: {c.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 opacity-70" />
                          <span>{c.counterparty}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full border border-white/5 bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] text-foreground">
                            {c.clauses.length} clause{c.clauses.length === 1 ? "" : "s"}
                          </span>
                          {uniqueRegs.length > 0 && (
                            <span className="rounded-full border border-[color-mix(in_oklab,var(--brass)_20%,transparent)] bg-[color-mix(in_oklab,var(--brass)_8%,transparent)] px-2 py-0.5 font-mono text-[10px] text-[var(--brass)]">
                              {uniqueRegs.length} regs
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {c.extraction_status === "complete" ? (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--success)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[var(--brass)]">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brass)]" />
                            {c.extraction_status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-[var(--brass)]">
                        {formatUSD(c.value)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          to="/contracts/$contractId"
                          params={{ contractId: c.id }}
                          className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-muted-foreground transition-all duration-200 group-hover:border-[var(--hairline-strong)] group-hover:bg-[color-mix(in_oklab,var(--brass)_15%,transparent)] group-hover:text-[var(--brass)]"
                        >
                          Inspect
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Dialog Component */}
      {uploadOpen ? <UploadContract onClose={() => setUploadOpen(false)} /> : null}
    </div>
  );
}

function ContractsError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="glass-panel mx-auto max-w-md p-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--risk)]">
        Error Loading Contracts
      </p>
      <p className="mt-2 font-display text-[20px] font-semibold leading-[1.2] text-foreground">
        Something got in the way of reading the portfolio.
      </p>
      <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">{error.message}</p>
      <button
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className="mt-5 rounded-full bg-[var(--brass)] px-5 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-all duration-200 hover:bg-[var(--brass-strong)]"
      >
        Retry Loading
      </button>
    </div>
  );
}
