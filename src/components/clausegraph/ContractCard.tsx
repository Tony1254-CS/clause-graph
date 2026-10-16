import { Link } from "@tanstack/react-router";
import { FileText, Building2, ChevronRight, Layers, Sparkles } from "lucide-react";
import type { Contract } from "@/data/types";
import { formatUSD } from "@/data/queries";

export function ContractCard({ contract }: { contract: Contract }) {
  // Collect unique regulations linked across all clauses
  const uniqueRegs = Array.from(
    new Set(contract.clauses.flatMap((c) => c.linked_regs || []))
  );

  return (
    <Link
      to="/contracts/$contractId"
      params={{ contractId: contract.id }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-[color-mix(in_oklab,var(--brass)_45%,transparent)] hover:shadow-[0_20px_50px_-18px_rgba(94,234,212,0.22)]"
    >
      {/* Top glowing hairline accent on hover */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div>
        {/* Top Header metadata */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-white/5 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground">
              {contract.id.slice(0, 8)}
            </span>
            {contract.is_sample && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--brass)_30%,transparent)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-[var(--brass)]">
                <Sparkles className="h-2.5 w-2.5" />
                Sample
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors duration-200 group-hover:border-[var(--hairline-strong)] group-hover:text-foreground">
              <Layers className="h-3 w-3 text-[var(--brass)]" />
              {contract.clauses.length} clause{contract.clauses.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Title & Counterparty */}
        <div className="mt-4">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/5 bg-white/[0.03] text-muted-foreground transition-all duration-300 group-hover:border-[var(--hairline-strong)] group-hover:bg-[color-mix(in_oklab,var(--brass)_15%,transparent)] group-hover:text-[var(--brass)]">
              <FileText className="h-4 w-4" strokeWidth={1.7} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-display text-[17px] font-semibold leading-[1.3] tracking-tight text-foreground transition-colors duration-200 group-hover:text-[var(--brass)]">
                {contract.name}
              </h3>
              <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate">{contract.counterparty}</span>
              </p>
            </div>
          </div>

          <StatusBadge contract={contract} />

          {/* Quick Regulatory Coverage Preview */}
          {uniqueRegs.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/80">
                Mapped:
              </span>
              {uniqueRegs.slice(0, 2).map((regId) => (
                <span
                  key={regId}
                  className="rounded border border-white/5 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                >
                  {regId.toUpperCase()}
                </span>
              ))}
              {uniqueRegs.length > 2 && (
                <span className="font-mono text-[9px] text-[var(--brass)]">
                  +{uniqueRegs.length - 2} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="mt-5 flex items-end justify-between border-t border-[var(--hairline)] pt-4">
        <div>
          <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Notional Value
          </span>
          <div className="mt-0.5 font-mono text-[16px] font-bold tracking-tight text-[var(--brass)]">
            {formatUSD(contract.value)}
          </div>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] px-3 py-1 font-mono text-[11px] font-medium text-muted-foreground transition-all duration-200 group-hover:border-[var(--hairline-strong)] group-hover:bg-[color-mix(in_oklab,var(--brass)_15%,transparent)] group-hover:text-[var(--brass)]">
          Inspect
          <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}

function StatusBadge({ contract }: { contract: Contract }) {
  const s = contract.extraction_status;
  if (s === "complete") {
    return (
      <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--success)_25%,transparent)] bg-[color-mix(in_oklab,var(--success)_10%,transparent)] px-2 py-0.5 font-mono text-[9.5px] font-medium text-[var(--success)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] shadow-[0_0_6px_var(--success)]" />
        Active & Indexed
      </div>
    );
  }
  const map = {
    processing: {
      label: "Extracting obligations…",
      color: "text-[var(--brass)] border-[var(--hairline-strong)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)]",
    },
    pending: {
      label: "Pending analysis",
      color: "text-muted-foreground border-[var(--hairline)] bg-white/[0.02]",
    },
    failed: {
      label: "Extraction failed",
      color: "text-[var(--risk)] border-[var(--risk)]/40 bg-[color-mix(in_oklab,var(--risk)_10%,transparent)]",
    },
  } as const;
  const cfg = map[s];
  return (
    <span
      className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-wider ${cfg.color}`}
    >
      {s === "processing" && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brass)] shadow-[0_0_6px_var(--brass)]" />
      )}
      {cfg.label}
    </span>
  );
}

