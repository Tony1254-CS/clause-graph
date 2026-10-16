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

  const dateLabel = new Date(bt.case_date).toISOString().slice(0, 10);

  return (
    <article className="glass-panel p-6 flex flex-col gap-5">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
          Enforcement case · {dateLabel}
        </p>
        <h3 className="mt-2 font-display text-[22px] leading-[1.15] tracking-tight text-foreground">
          {bt.company}
        </h3>
        <p className="mt-2 font-display text-[36px] leading-[1] tracking-tight text-[var(--risk)] tabular-nums">
          <span className="font-mono text-[15px] align-middle mr-1 text-muted-foreground">
            fine
          </span>
          {formatFine(bt.fine_usd)}
        </p>
        <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
          {bt.regulation}
        </p>
      </header>

      <p className="text-[13px] leading-[1.6] text-muted-foreground">{bt.summary}</p>

      <div className="rounded-[12px] border border-[var(--hairline-strong)] bg-[color-mix(in_oklab,var(--brass)_6%,transparent)] p-3.5">
        <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-[var(--brass)]">
          <ShieldAlert className="h-3 w-3" strokeWidth={1.8} />
          Reconstruction — not this company's actual contracts
        </p>
        <p className="mt-1.5 text-[12px] leading-[1.55] text-muted-foreground">
          Clauses below are synthetic, drafted to mirror the enforcement pattern. Analysis runs live
          via the same pipeline as Simulate Impact.
        </p>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Reconstructed scenario prompt
        </p>
        <p className="text-[12.5px] leading-[1.6] text-foreground/90 italic border-l-2 border-[var(--hairline-strong)] pl-3">
          "{bt.reconstructed_prompt}"
        </p>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Reconstructed clauses
        </p>
        <ul className="flex flex-col gap-2">
          {bt.reconstructed_clauses.map((c) => (
            <li
              key={c.id}
              className="rounded-[12px] border border-[var(--hairline)] p-2.5 text-[12px] leading-[1.55] text-foreground/85"
            >
              <span className="mr-2 font-mono text-[10px] text-[var(--brass)]">{c.id}</span>
              {c.text}
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={onRun}
        disabled={status === "loading"}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brass)] px-4 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 ease-out hover:-translate-y-px hover:bg-[var(--brass-strong)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
            Analyzing…
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5" strokeWidth={2} />
            {status === "done" ? "Re-run analysis" : "Run Analysis"}
          </>
        )}
      </button>

      {error && (
        <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk)]" />
          <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-[20px] border border-[var(--hairline-strong)] bg-[var(--surface-glass)] p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
              Reconstructed scenario · analyzed live
            </p>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground border border-[var(--hairline)] rounded-full px-2 py-0.5">
              {result.fallback ? "Demo fallback" : "gpt-4o"}
            </span>
          </div>
          {result.summary && (
            <p className="mt-3 text-[12.5px] leading-[1.55] text-muted-foreground">
              {result.summary}
            </p>
          )}
          <ul className="mt-3 flex flex-col gap-2.5">
            {result.impacts.map((i) => (
              <li
                key={i.contract_id}
                className="rounded-[12px] border border-[var(--hairline)] p-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--brass)]">
                    {i.contract_id}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[i.severity]}`} />
                    {SEV_LABEL[i.severity]}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-[1.55] text-foreground/85">
                  {clauseById.get(i.contract_id)}
                </p>
                <p className="mt-1.5 text-[12px] leading-[1.55] text-muted-foreground">
                  <span className="mr-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--brass)]">
                    Fix →
                  </span>
                  {i.suggested_amendment}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground">
            Historical fine: {formatFine(bt.fine_usd)} · Source: {bt.source}
          </p>
        </div>
      )}
    </article>
  );
}
