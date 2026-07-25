import { Link } from "@tanstack/react-router";
import type { Contract } from "@/data/types";
import { formatUSD } from "@/data/queries";

export function ContractCard({ contract }: { contract: Contract }) {
  return (
    <Link
      to="/contracts/$contractId"
      params={{ contractId: contract.id }}
      className="glass-panel group flex flex-col gap-5 p-6 transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[color:var(--hairline-strong)]"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {contract.id.slice(0, 8)}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {contract.clauses.length} clauses
        </span>
      </div>

      <div className="min-h-[76px]">
        <h3 className="font-display text-[19px] leading-[1.2] tracking-tight text-foreground">
          {contract.name}
        </h3>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{contract.counterparty}</p>
        <StatusBadge contract={contract} />
      </div>


      <div className="mt-auto flex items-end justify-between border-t border-[var(--hairline)] pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Notional
        </span>
        <span className="font-mono text-[15px] text-brass">{formatUSD(contract.value)}</span>
      </div>
    </Link>
  );
}

function StatusBadge({ contract }: { contract: Contract }) {
  const s = contract.extraction_status;
  if (s === "complete") return null;
  const map = {
    processing: { label: "Analyzing…", color: "text-brass border-[var(--hairline-strong)]" },
    pending: { label: "Pending", color: "text-muted-foreground border-[var(--hairline)]" },
    failed: { label: "Extraction failed", color: "text-[var(--risk)] border-[var(--risk)]/40" },
  } as const;
  const cfg = map[s];
  return (
    <span
      className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${cfg.color}`}
    >
      {s === "processing" && (
        <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse" />
      )}
      {cfg.label}
    </span>
  );
}

