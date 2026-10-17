import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Play, ShieldAlert } from "lucide-react";
import { type BacktestCaseRow } from "@/data/queries";
import { simulateBacktest } from "@/lib/backtest.functions";
import type { SimulationResult, Severity } from "@/lib/simulate-types";

function formatFine(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(0)}M`;
  return `$${usd.toLocaleString()}`;
}

const SEV_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };
const SEV_DOT: Record<Severity, string> = {
  high: "bg-[var(--risk)]",
  medium: "bg-[color-mix(in_oklab,var(--risk)_75%,transparent)]",
  low: "bg-[color-mix(in_oklab,var(--risk)_45%,transparent)]",
};

export function BacktestCard({ bt }: { bt: BacktestCaseRow }) {
  const runBacktest = useServerFn(simulateBacktest);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  const clauseById = useMemo(() => {
    const m = new Map<string, string>();
    bt.reconstructed_clauses.forEach((c) => m.set(c.id, c.text));
    return m;
  }, [bt]);

  async function onRun() {
    if (status === "loading") return;
    setStatus("loading");
    setError(null);
    setResult(null);
    const started = Date.now();
    try {
      const res = await runBacktest({ data: { caseId: bt.id } });
      const elapsed = Date.now() - started;
      if (elapsed < 1200) await new Promise((r) => setTimeout(r, 1200 - elapsed));
      setResult(res);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setStatus("error");
    }
  }

  const dateLabel = new Date(bt.case_date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <article className="group relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-6 md:p-8 backdrop-blur-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-[var(--hairline-strong)] hover:shadow-[0_24px_60px_-16px_rgba(94,234,212,0.12)] space-y-6">
      {/* Top glowing hairline accent on hover */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--risk)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      {/* ── Case Header & Statutory Fine ── */}
      <header className="space-y-4 pb-4 border-b border-[var(--hairline)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
            {bt.regulation}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            Enforced: {dateLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-display text-[24px] md:text-[28px] font-bold leading-[1.15] tracking-tight text-foreground">
              {bt.company}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
              {bt.source}
            </p>
          </div>

          {/* Big Stat Callout */}
          <div className="text-right">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground block">
              Historical Penalty
            </span>
            <span className="font-display text-[32px] md:text-[38px] font-bold text-[var(--risk)] tabular-nums leading-none block mt-1">
              {formatFine(bt.fine_usd)}
            </span>
          </div>
        </div>

        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          {bt.summary}
        </p>
      </header>

      {/* ── Synthetic Reconstruction Notice ── */}
      <div className="rounded-xl border border-[var(--hairline)] bg-white/[0.02] p-4 flex items-start gap-3">
        <ShieldAlert className="h-4 w-4 text-[var(--brass)] shrink-0 mt-0.5" strokeWidth={1.8} />
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--brass)] font-semibold">
            Reconstructed Contract Corpus
          </p>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Clauses below are synthetic reconstructions designed to mirror the actual legal vulnerability. 
            The analysis runs live through the production ClauseGraph pipeline.
          </p>
        </div>
      </div>

      {/* ── Reconstructed Clauses List ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">
            Reconstructed Clauses ({bt.reconstructed_clauses.length}):
          </span>
          <button
            type="button"
            onClick={() => setShowPrompt(!showPrompt)}
            className="font-mono text-[10px] text-[var(--brass)] hover:underline cursor-pointer"
          >
            {showPrompt ? "Hide Scenario Prompt" : "View Scenario Prompt"}
          </button>
        </div>

        {showPrompt && (
          <div className="rounded-xl border border-white/5 bg-black/40 p-3.5 font-mono text-[11.5px] leading-relaxed text-muted-foreground italic border-l-2 border-[var(--brass)]">
            "{bt.reconstructed_prompt}"
          </div>
        )}

        <div className="space-y-2">
          {bt.reconstructed_clauses.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[12.5px] leading-relaxed text-foreground/90 transition-colors hover:border-white/10"
            >
              <span className="mr-2 font-mono text-[10px] text-[var(--brass)] font-semibold">{c.id}</span>
              {c.text}
            </div>
          ))}
        </div>
      </div>

      {/* ── Live Pipeline Trigger Button ── */}
      <div className="pt-2">
        <button
          onClick={onRun}
          disabled={status === "loading"}
          className="relative inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--brass)] px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--primary-foreground)] shadow-[0_10px_30px_-10px_rgba(94,234,212,0.45)] hover:bg-[var(--brass-strong)] active:scale-[0.98] disabled:opacity-40 transition-all cursor-pointer"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              <span>Running Backtest Validation…</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" strokeWidth={2} />
              <span>{status === "done" ? "Re-Run Live Pipeline" : "Run Live Pipeline Validation"}</span>
            </>
          )}
        </button>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--risk)]/20 bg-[var(--risk)]/10 px-3 py-2 text-xs text-[var(--risk)] font-mono">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Live Analysis Output: The "Breach vs Remediation" Split Card ── */}
      {result && (
        <div className="rounded-[20px] border border-[var(--hairline)] bg-gradient-to-br from-black/40 to-white/[0.02] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-foreground font-semibold">
                Live Validation Assessment
              </span>
            </div>
            <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground border border-white/10 rounded-full px-2.5 py-0.5">
              {result.fallback ? "Demo Fallback" : "Live GPT-4o Model"}
            </span>
          </div>

          {result.summary && (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {result.summary}
            </p>
          )}

          {/* Vulnerability vs Fix Split list */}
          <div className="space-y-3">
            {result.impacts.map((i) => (
              <div
                key={i.contract_id}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3 transition-colors hover:border-white/10"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--brass)] font-semibold">
                    Target: {i.contract_id}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold ${
                      i.severity === "high"
                        ? "bg-[var(--risk)]/20 text-[var(--risk)] border border-[var(--risk)]/40"
                        : "bg-[var(--brass)]/20 text-[var(--brass)] border border-[var(--brass)]/40"
                    }`}
                  >
                    {SEV_LABEL[i.severity]} Severity Exposure
                  </span>
                </div>

                {/* Original Flaw */}
                <div className="rounded-lg bg-black/40 p-3 border-l-2 border-[var(--risk)]">
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--risk)] block mb-1">
                    Vulnerable Provision (Actual Pattern):
                  </span>
                  <p className="text-[12px] leading-relaxed text-muted-foreground">
                    {clauseById.get(i.contract_id)}
                  </p>
                </div>

                {/* ClauseGraph Automated Fix */}
                <div className="rounded-lg bg-[var(--brass)]/5 p-3 border-l-2 border-[var(--brass)]">
                  <span className="font-mono text-[9.5px] uppercase tracking-wider text-[var(--brass)] block mb-1">
                    ClauseGraph Proposed Remediation:
                  </span>
                  <p className="text-[12px] leading-relaxed text-foreground font-medium">
                    {i.suggested_amendment}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
