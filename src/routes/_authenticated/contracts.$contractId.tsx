import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Layers,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  Sparkles,
  FileText,
  AlertCircle,
} from "lucide-react";
import { ClauseRow } from "@/components/clausegraph/ClauseRow";
import { contractQuery, formatUSD } from "@/data/queries";

export const Route = createFileRoute("/_authenticated/contracts/$contractId")({
  head: ({ loaderData }) => {
    const data = loaderData as { name: string; counterparty: string; clauses: unknown[] } | undefined;
    const name = data?.name ?? "Contract";
    const desc = data
      ? `${data.name} with ${data.counterparty}. ${data.clauses.length} clauses mapped to regulatory obligations.`
      : "Contract detail";
    return {
      meta: [
        { title: `${name} — ClauseGraph` },
        { name: "description", content: desc },
        { property: "og:title", content: `${name} — ClauseGraph` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(contractQuery(params.contractId)),
  component: ContractDetail,
  errorComponent: DetailError,
  notFoundComponent: () => {
    const { contractId } = Route.useParams();
    return (
      <div className="glass-panel mx-auto max-w-md p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/5 bg-white/[0.04] text-muted-foreground">
          <AlertCircle className="h-6 w-6" />
        </div>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Contract unavailable
        </p>
        <p className="mt-2 font-display text-[20px] leading-[1.25] text-foreground">
          This contract no longer exists in your workspace.
        </p>
        <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
          It may have been removed, or the sample corpus was re-seeded and this link is now stale.
        </p>
        <p className="mt-3 font-mono text-[10px] text-muted-foreground break-all">
          {contractId}
        </p>
        <Link
          to="/contracts"
          className="mt-5 inline-block rounded-full border border-[var(--hairline-strong)] bg-white/[0.04] px-5 py-2 text-sm font-semibold text-[var(--brass)] transition-all hover:bg-[color-mix(in_oklab,var(--brass)_12%,transparent)]"
        >
          Back to Contracts Portfolio
        </Link>
      </div>
    );
  },
});

function ContractDetail() {
  const { contractId } = Route.useParams();
  const { data: contract } = useSuspenseQuery(contractQuery(contractId));
  const [idCopied, setIdCopied] = useState(false);

  function handleCopyId() {
    navigator.clipboard.writeText(contract.id);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  }

  // Count unique regulations cited across all clauses
  const uniqueRegs = Array.from(
    new Set(contract.clauses.flatMap((c) => c.linked_regs || []))
  );

  return (
    <div className="w-full max-w-[1080px] pb-12">
      {/* ── Top Navigation & Breadcrumbs ─────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/contracts"
          className="group inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface-raised)]/50 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur-xl transition-all duration-200 hover:-translate-x-0.5 hover:border-[var(--hairline-strong)] hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span>All Contracts</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/simulate"
            className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_oklab,var(--brass)_30%,transparent)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] px-4 py-1.5 font-mono text-[11px] font-semibold text-[var(--brass)] shadow-sm transition-all duration-200 hover:bg-[color-mix(in_oklab,var(--brass)_18%,transparent)]"
          >
            <Zap className="h-3.5 w-3.5" />
            Simulate Blast Radius
          </Link>
        </div>
      </div>

      {/* ── Hero Instrument Header Card ──────────────────────── */}
      <header className="group relative mb-8 overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-7 backdrop-blur-2xl transition-all duration-300 hover:border-[color-mix(in_oklab,var(--brass)_40%,transparent)] sm:p-9">
        {/* Ambient Top Glow Line */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent" />

        {/* Top Badges Row */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/5 bg-white/[0.04] px-2.5 py-1 font-mono text-[10.5px] tracking-wider text-muted-foreground transition-colors hover:border-[var(--hairline-strong)] hover:text-foreground"
              title="Click to copy full contract ID"
            >
              <span>ID: {contract.id}</span>
              {idCopied ? (
                <Check className="h-3 w-3 text-[var(--success)]" />
              ) : (
                <Copy className="h-3 w-3 opacity-60" />
              )}
            </button>

            {contract.is_sample && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--brass)_30%,transparent)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] px-2.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider text-[var(--brass)]">
                <Sparkles className="h-2.5 w-2.5" />
                Sample Instrument
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--success)_25%,transparent)] bg-[color-mix(in_oklab,var(--success)_10%,transparent)] px-2.5 py-1 font-mono text-[10px] font-medium text-[var(--success)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] shadow-[0_0_6px_var(--success)]" />
              Active & Monitored
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white/[0.03] px-3 py-1 font-mono text-[10.5px] text-muted-foreground">
              <Layers className="h-3 w-3 text-[var(--brass)]" />
              {contract.clauses.length} clause{contract.clauses.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Contract Title */}
        <h1 className="font-display text-[28px] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-[34px]">
          {contract.name}
        </h1>

        {/* 3 Executive Metric Tiles */}
        <div className="mt-8 grid grid-cols-1 gap-4 border-t border-[var(--hairline)] pt-6 sm:grid-cols-3">
          {/* Tile 1: Counterparty */}
          <div className="rounded-[16px] border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 text-[var(--brass)]" />
              Counterparty Entity
            </div>
            <div className="mt-2 text-[16px] font-semibold text-foreground">
              {contract.counterparty}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Verified bilateral signatory
            </div>
          </div>

          {/* Tile 2: Notional Exposure */}
          <div className="rounded-[16px] border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5 text-[var(--brass)]" />
              Notional Exposure
            </div>
            <div className="mt-2 font-mono text-[20px] font-bold text-[var(--brass)]">
              {formatUSD(contract.value)}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Aggregate contract face value
            </div>
          </div>

          {/* Tile 3: Regulatory Linkage */}
          <div className="rounded-[16px] border border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--brass)]" />
              Governing Frameworks
            </div>
            <div className="mt-2 text-[16px] font-semibold text-foreground">
              {uniqueRegs.length} Framework{uniqueRegs.length === 1 ? "" : "s"}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Mapped into compliance ontology
            </div>
          </div>
        </div>
      </header>

      {/* ── Regulatory Simulation Callout Banner ──────────────── */}
      <section className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-[color-mix(in_oklab,var(--brass)_25%,transparent)] bg-[radial-gradient(ellipse_at_left,color-mix(in_oklab,var(--brass)_12%,transparent),transparent_80%)] p-5 backdrop-blur-xl">
        <div className="flex items-start gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--hairline-strong)] bg-[color-mix(in_oklab,var(--brass)_15%,transparent)] text-[var(--brass)] shadow-sm">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-[15px] font-semibold text-foreground">
              Simulate Regulatory Shock & Blast Radius
            </h3>
            <p className="mt-0.5 max-w-[60ch] text-[12.5px] leading-relaxed text-muted-foreground">
              Evaluate how amendments in governing frameworks (such as GDPR, DORA, or the EU AI Act)
              cascade financial risk into this contract and generate automated redlines.
            </p>
          </div>
        </div>

        <Link
          to="/simulate"
          className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--brass-strong)]"
        >
          <Zap className="h-3.5 w-3.5" />
          Launch Simulation
        </Link>
      </section>

      {/* ── Clauses & Obligations Section ────────────────────── */}
      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brass)]">
                Contractual Clauses
              </span>
              <span className="rounded-full border border-white/5 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                {contract.clauses.length} Indexed
              </span>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Segmented legal commitments cross-referenced with your regulatory obligations.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {contract.clauses.map((cl, i) => (
            <ClauseRow key={cl.id} clause={cl} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DetailError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="glass-panel mx-auto max-w-md p-8 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[var(--risk)]/30 bg-[color-mix(in_oklab,var(--risk)_10%,transparent)] text-[var(--risk)]">
        <AlertCircle className="h-6 w-6" />
      </div>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--risk)]">
        Couldn't Load Contract
      </p>
      <p className="mt-2 font-display text-[20px] font-semibold leading-[1.2] text-foreground">
        This agreement isn't responding right now.
      </p>
      <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
        {error.message}
      </p>
      <div className="mt-5 flex items-center justify-center gap-3">
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="rounded-full bg-[var(--brass)] px-5 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-all duration-150 hover:bg-[var(--brass-strong)]"
        >
          Retry
        </button>
        <Link
          to="/contracts"
          className="rounded-full border border-[var(--hairline-strong)] px-4 py-2 text-sm font-semibold text-muted-foreground transition-all hover:text-foreground"
        >
          Back to List
        </Link>
      </div>
    </div>
  );
}

