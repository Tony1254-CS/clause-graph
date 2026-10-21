import { useState, useMemo } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Zap,
  Scale,
  DollarSign,
  FileText,
  Search,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Building2,
  Layers,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { JurisdictionChip } from "@/components/clausegraph/JurisdictionChip";
import { contractsQuery, regulationQuery, formatUSD } from "@/data/queries";

export const Route = createFileRoute("/_authenticated/regulations/$regId")({
  head: ({ loaderData }) => {
    const data = loaderData as { title: string; summary: string } | undefined;
    const title = data?.title ?? "Regulation";
    const summary = data?.summary ?? "Regulation detail";
    return {
      meta: [
        { title: `${title} — ClauseGraph` },
        { name: "description", content: summary },
        { property: "og:title", content: `${title} — ClauseGraph` },
        { property: "og:description", content: summary },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  loader: async ({ context, params }) => {
    context.queryClient.ensureQueryData(contractsQuery);
    return context.queryClient.ensureQueryData(regulationQuery(params.regId));
  },
  component: RegulationDetail,
  errorComponent: DetailError,
  notFoundComponent: () => {
    const { regId } = Route.useParams();
    return (
      <AppShell>
        <div className="glass-panel p-8 text-center max-w-md mx-auto">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Not found
          </p>
          <p className="mt-2 text-foreground">No regulation with ID {regId}.</p>
          <Link
            to="/feed"
            className="mt-4 inline-block rounded-full border border-[var(--hairline-strong)] px-4 py-2 text-sm text-[var(--brass)]"
          >
            Back to regulatory feed
          </Link>
        </div>
      </AppShell>
    );
  },
});

function RegulationDetail() {
  const { regId } = Route.useParams();
  const { data: reg } = useSuspenseQuery(regulationQuery(regId));
  const { data: contracts } = useSuspenseQuery(contractsQuery);

  const [idCopied, setIdCopied] = useState(false);
  const [obligationQueryStr, setObligationQueryStr] = useState("");

  const handleCopyId = () => {
    navigator.clipboard.writeText(reg.id);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  };

  const citingContracts = useMemo(() => {
    return contracts.filter((c) =>
      c.clauses.some((cl) => cl.linked_regs.includes(regId))
    );
  }, [contracts, regId]);

  const totalExposure = useMemo(() => {
    return citingContracts.reduce((sum, c) => sum + (Number(c.value) || 0), 0);
  }, [citingContracts]);

  const citingClauses = useMemo(() => {
    return contracts.reduce(
      (acc, c) => acc + c.clauses.filter((cl) => cl.linked_regs.includes(regId)).length,
      0
    );
  }, [contracts, regId]);

  const filteredObligations = useMemo(() => {
    if (!obligationQueryStr.trim()) return reg.obligations;
    const q = obligationQueryStr.toLowerCase();
    return reg.obligations.filter((ob) => ob.text.toLowerCase().includes(q) || ob.id.toLowerCase().includes(q));
  }, [reg.obligations, obligationQueryStr]);

  return (
    <AppShell>
      <div className="w-full max-w-[1080px] pb-14 space-y-7">
        {/* ── Top Navigation & Quick Actions ── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/dashboard"
            className="group inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface-raised)]/60 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-xl transition-all duration-200 hover:-translate-x-0.5 hover:border-[var(--hairline-strong)] hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span>Dashboard Topology</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <Link
              to="/simulate"
              search={{ text: `${reg.title}: ${reg.summary}` }}
              className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--brass)_35%,transparent)] bg-[color-mix(in_oklab,var(--brass)_12%,transparent)] px-4 py-1.5 font-mono text-[11px] font-semibold text-[var(--brass)] shadow-sm backdrop-blur-xl transition-all duration-200 hover:bg-[color-mix(in_oklab,var(--brass)_22%,transparent)]"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Simulate Blast Radius</span>
            </Link>
          </div>
        </div>

        {/* ── Hero Regulation Card ── */}
        <header className="group relative overflow-hidden rounded-[26px] border border-[var(--hairline)] bg-gradient-to-br from-[var(--surface-raised)]/90 via-[var(--shell-bg)] to-white/[0.02] p-7 sm:p-9 backdrop-blur-2xl shadow-xl transition-all duration-300 hover:border-[color-mix(in_oklab,var(--brass)_35%,transparent)]">
          {/* Ambient Top Glow Line */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent" />

          {/* Top Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2.5">
              <JurisdictionChip jurisdiction={reg.jurisdiction} />
              <button
                onClick={handleCopyId}
                className="group/btn inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-all hover:bg-white/[0.08] hover:text-foreground active:scale-95 cursor-pointer"
                title="Click to copy framework ID"
              >
                <span>{reg.id}</span>
                {idCopied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3 opacity-60 group-hover/btn:opacity-100" />
                )}
              </button>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--brass)] border border-[var(--brass)]/20 bg-[var(--brass)]/10 px-3 py-1 rounded-full">
              Statutory Ontology
            </span>
          </div>

          <h1 className="font-display text-[28px] sm:text-[34px] leading-[1.12] tracking-tight text-foreground font-semibold">
            {reg.title}
          </h1>

          <p className="mt-4 text-[14.5px] sm:text-[15.5px] leading-relaxed text-muted-foreground max-w-3xl">
            {reg.summary}
          </p>

          {/* ── Executive KPI Metrics Grid ── */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3.5 border-t border-white/5 pt-6 font-mono">
            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider block">
                Total Valuation Linked
              </span>
              <p className="text-lg sm:text-xl font-bold text-[var(--brass)] tracking-tight">
                {formatUSD(totalExposure)}
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider block">
                Citing Agreements
              </span>
              <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                {citingContracts.length} <span className="text-xs text-muted-foreground font-normal">Contracts</span>
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider block">
                Active Provisions
              </span>
              <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                {citingClauses} <span className="text-xs text-muted-foreground font-normal">Clauses</span>
              </p>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 space-y-1">
              <span className="text-[10px] uppercase text-muted-foreground tracking-wider block">
                Mandated Rules
              </span>
              <p className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
                {reg.obligations.length} <span className="text-xs text-muted-foreground font-normal">Obligations</span>
              </p>
            </div>
          </div>
        </header>

        {/* ── Citing Contracts Section ── */}
        <section className="rounded-[24px] border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-6 sm:p-7 backdrop-blur-2xl shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--brass)]" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                  Downstream Agreements Citing This Framework ({citingContracts.length})
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Commercial agreements in your portfolio whose clauses cite {reg.title}.
              </p>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {citingClauses} citation points mapped
            </span>
          </div>

          {citingContracts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
              <p className="text-xs font-mono text-muted-foreground">
                No active contracts in your indexed portfolio currently cite this statutory framework.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {citingContracts.map((c) => {
                const clauseMatches = c.clauses.filter((cl) => cl.linked_regs.includes(regId)).length;
                return (
                  <Link
                    key={c.id}
                    to="/contracts/$contractId"
                    params={{ contractId: c.id }}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] p-4 backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--brass)]/40 hover:bg-white/[0.04] hover:shadow-lg space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground border border-white/5 bg-white/[0.04] px-1.5 py-0.5 rounded">
                          {c.id.slice(0, 8)}
                        </span>
                        <h3 className="mt-1.5 text-sm font-semibold text-foreground group-hover:text-[var(--brass)] transition-colors line-clamp-1">
                          {c.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Counterparty: <strong className="text-foreground/90 font-medium">{c.counterparty}</strong>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs font-bold text-[var(--brass)] block">
                          {formatUSD(Number(c.value) || 0)}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground mt-0.5 block">
                          {clauseMatches} {clauseMatches === 1 ? "clause" : "clauses"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] font-mono text-muted-foreground group-hover:text-foreground">
                      <span>Inspect Contract Provisions</span>
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1 text-[var(--brass)]" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Statutory Obligations Section with Search ── */}
        <section className="rounded-[24px] border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-6 sm:p-7 backdrop-blur-2xl shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-[var(--brass)]" />
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                  Mandated Obligations ({filteredObligations.length})
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exact statutory requirements parsed from this regulation.
              </p>
            </div>

            {/* Quick Filter */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Filter obligations..."
                value={obligationQueryStr}
                onChange={(e) => setObligationQueryStr(e.target.value)}
                className="w-full rounded-full border search-input-theme pl-8 pr-3 py-1.5 text-xs font-sans text-foreground placeholder:text-muted-foreground focus:border-[var(--brass)] focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {filteredObligations.map((ob, i) => (
              <div
                key={ob.id}
                className="group rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:border-white/10 hover:bg-white/[0.04]"
              >
                <div className="flex items-start gap-3.5">
                  <span className="font-mono text-xs font-bold text-[var(--brass)] bg-[var(--brass)]/10 border border-[var(--brass)]/20 px-2 py-0.5 rounded-lg shrink-0 pt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                        Rule ID: {ob.id}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-400">
                        <ShieldCheck className="h-3 w-3" /> Mandatory
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-foreground/90 font-sans">
                      {ob.text}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function DetailError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <AppShell>
      <div className="glass-panel p-8 max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Couldn't load regulation
        </p>
        <p className="mt-2 font-display text-[20px] leading-[1.2] text-foreground">
          This ontology entry isn't responding right now.
        </p>
        <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk)] mr-2 align-middle" />
          {error.message}
        </p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 rounded-[12px] bg-brass px-4 py-2 text-sm text-[color:var(--primary-foreground)] duration-150 ease-out transition-all hover:bg-[color:var(--brass-strong)]"
        >
          Retry
        </button>
      </div>
    </AppShell>
  );
}

