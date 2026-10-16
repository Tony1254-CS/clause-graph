import { useState } from "react";
import { Copy, Check, Scale } from "lucide-react";
import type { Clause } from "@/data/types";
import { RegulationPill } from "./RegulationPill";

export function ClauseRow({ clause, index }: { clause: Clause; index?: number }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(clause.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 backdrop-blur-xl transition-all duration-300 ease-out hover:border-[color-mix(in_oklab,var(--brass)_35%,transparent)] hover:shadow-[var(--shadow-soft)]">
      {/* Top indicator hairline on hover */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {typeof index === "number" && (
            <span className="flex h-5 items-center rounded-md border border-[var(--hairline-strong)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] px-2 font-mono text-[10px] font-semibold text-[var(--brass)]">
              Obligation #{index + 1}
            </span>
          )}
          <span className="rounded-md border border-white/5 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {clause.id}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
            <Scale className="h-3 w-3 text-[var(--brass)]" />
            {clause.linked_regs.length} citation{clause.linked_regs.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-md border border-white/5 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-[var(--hairline-strong)] hover:text-foreground"
            title="Copy clause language"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-[var(--success)]" />
                <span className="text-[var(--success)]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Clause Text with Legal Quotation styling */}
      <div className="relative mt-4 border-l-2 border-[var(--brass)]/50 pl-4 py-0.5">
        <p className="text-[14.5px] font-normal leading-[1.7] text-foreground/90">
          "{clause.text}"
        </p>
      </div>

      {/* Regulatory Mapping Pills */}
      {clause.linked_regs.length > 0 && (
        <div className="mt-5 border-t border-[var(--hairline)] pt-4">
          <div className="mb-2.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <Scale className="h-3 w-3 text-[var(--brass)]" />
            Governing Regulatory Frameworks
          </div>
          <div className="flex flex-wrap gap-2">
            {clause.linked_regs.map((regId) => (
              <RegulationPill key={regId} regId={regId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
