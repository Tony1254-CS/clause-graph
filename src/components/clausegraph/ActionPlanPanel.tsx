import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Wand2, Copy, FileDown, Check, ShieldAlert, ClipboardList } from "lucide-react";
import { generateActionPlan } from "@/lib/action-plan.functions";
import type {
  ActionPlan,
  ActionPlanInput,
  TechPriority,
  SourceCitation,
} from "@/lib/action-plan-types";

const PRIORITY_DOT: Record<TechPriority, string> = {
  P0: "bg-[var(--risk)]",
  P1: "bg-[var(--brass)]",
  P2: "bg-muted-foreground/60",
};

function planToMarkdown(plan: ActionPlan, regulationText: string): string {
  const lines: string[] = [];
  lines.push("# ClauseGraph Compliance Action Plan");
  lines.push("");
  lines.push(`_Generated ${new Date().toISOString()}_`);
  lines.push("");
  lines.push(
    "> **DRAFT — NOT LEGAL ADVICE.** Every amendment below is an unreviewed suggestion for qualified legal counsel review, never a final legal position.",
  );
  lines.push("");
  lines.push("## Proposed regulation / Statutory trigger");
  lines.push("");
  lines.push(regulationText);
  lines.push("");
  lines.push("## Updated policy draft");
  lines.push("");
  lines.push(plan.policy_draft);
  lines.push("");
  lines.push("## Contract amendments (for legal review)");
  lines.push("");
  plan.amendments.forEach((a) => {
    lines.push(`- **${a.contract_id} — ${a.contract_name}**`);
    lines.push(`  - Suggestion: ${a.suggestion}`);
    if (a.rationale) lines.push(`  - Rationale: ${a.rationale}`);
    if (a.clause_quote) lines.push(`  - Grounding Clause Quote: "${a.clause_quote}"`);
    if (a.citation) lines.push(`  - Statutory Citation: ${a.citation}`);
  });
  lines.push("");
  lines.push("## Technical fix checklist");
  lines.push("");
  plan.tech_fixes.forEach((t) => {
    lines.push(`- [ ] **${t.priority}** — ${t.title}`);
    if (t.detail) lines.push(`      ${t.detail}`);
  });

  if (plan.sources && plan.sources.length > 0) {
    lines.push("");
    lines.push("## Appendix: Authoritative Legal Sources");
    lines.push("");
    plan.sources.forEach((s) => {
      lines.push(`- **${s.title}** (${s.instrument_id})`);
      if (s.official_url) lines.push(`  - Official URL: ${s.official_url}`);
      if (s.quote) lines.push(`  - Verbatim Rule Excerpt: "${s.quote}"`);
    });
  }

  return lines.join("\n");
}

async function exportPdf(plan: ActionPlan, regulationText: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 56;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  const ensure = (need: number) => {
    if (y + need > pageHeight - margin) {
      doc.addPage();
      y = margin;
      // Re-stamp draft banner on subsequent pages
      stampHeader();
    }
  };

  const stampHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(200, 50, 50);
    doc.text("DRAFT — NOT LEGAL ADVICE (SUBJECT TO QUALIFIED ATTORNEY REVIEW)", margin, y);
    doc.setTextColor(0, 0, 0);
    y += 14;
  };

  const writeWrapped = (
    text: string,
    size: number,
    style: "normal" | "bold" | "italic" = "normal",
    gap = 4,
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width);
    for (const line of lines) {
      ensure(size + gap);
      doc.text(line, margin, y);
      y += size + gap;
    }
  };

  stampHeader();

  writeWrapped("ClauseGraph Compliance Action Plan", 18, "bold", 6);
  writeWrapped(`Generated ${new Date().toLocaleString()}`, 9, "normal", 8);
  y += 6;

  doc.setDrawColor(180);
  doc.line(margin, y, margin + width, y);
  y += 14;

  writeWrapped(
    "DRAFT OUTPUT FOR LEGAL REVIEW: Every amendment and policy change below is an AI/algorithmic recommendation and does not constitute formal legal counsel. Verify all statutory citations against official gazettes before executing amendments.",
    9,
    "italic",
    10,
  );

  writeWrapped("Proposed Regulation / Statutory Trigger", 12, "bold", 6);
  writeWrapped(regulationText, 10, "normal", 3);
  y += 10;

  writeWrapped("Updated Policy Draft", 12, "bold", 6);
  writeWrapped(plan.policy_draft, 10, "normal", 3);
  y += 10;

  writeWrapped("Contract Amendments (for Legal Review)", 12, "bold", 6);
  plan.amendments.forEach((a) => {
    writeWrapped(`${a.contract_id} — ${a.contract_name}`, 10, "bold", 2);
    writeWrapped(`Suggestion: ${a.suggestion}`, 10, "normal", 2);
    if (a.rationale) writeWrapped(`Rationale: ${a.rationale}`, 9, "normal", 2);
    if (a.clause_quote) writeWrapped(`Grounding Clause Quote: "${a.clause_quote}"`, 8, "italic", 2);
    if (a.citation) writeWrapped(`Statutory Citation: ${a.citation}`, 8, "bold", 2);
    y += 4;
  });
  y += 6;

  writeWrapped("Technical Fix Checklist", 12, "bold", 6);
  plan.tech_fixes.forEach((t) => {
    writeWrapped(`[ ] ${t.priority} — ${t.title}`, 10, "bold", 2);
    if (t.detail) writeWrapped(t.detail, 9, "normal", 2);
    y += 4;
  });

  if (plan.sources && plan.sources.length > 0) {
    y += 8;
    ensure(40);
    writeWrapped("Appendix: Authoritative Legal Sources", 12, "bold", 6);
    plan.sources.forEach((s) => {
      writeWrapped(`• ${s.title} (${s.instrument_id})`, 10, "bold", 2);
      if (s.official_url) writeWrapped(`  Official Source: ${s.official_url}`, 9, "normal", 2);
      if (s.quote) writeWrapped(`  Verbatim Duty: "${s.quote}"`, 8, "italic", 2);
      y += 4;
    });
  }

  doc.save(`clausegraph-action-plan-${Date.now()}.pdf`);
}

type Props = {
  regulationText: string;
  summary?: string;
  impacts: ActionPlanInput["impacts"];
  sources?: SourceCitation[];
  variant?: "reactive" | "forecast";
};

export function ActionPlanPanel({
  regulationText,
  summary,
  impacts,
  sources,
  variant = "reactive",
}: Props) {
  const isForecast = variant === "forecast";
  const runPlan = useServerFn(generateActionPlan);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [doneFixes, setDoneFixes] = useState<Set<string>>(new Set());

  async function onGenerate() {
    if (status === "loading") return;
    setStatus("loading");
    setError(null);
    setPlan(null);
    try {
      const res = await runPlan({
        data: { regulationText, summary, impacts, sources },
      });
      setPlan(res);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate action plan");
      setStatus("error");
    }
  }

  async function onCopy() {
    if (!plan) return;
    await navigator.clipboard.writeText(planToMarkdown(plan, regulationText));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  if (status === "idle") {
    return (
      <div className="glass-panel p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
            {isForecast ? "Anticipatory step" : "Next step"}
          </p>
          <p className="mt-1 text-[13px] text-foreground">
            {isForecast
              ? "Draft a preemptive remediation plan before this amendment could be enacted."
              : "Turn this simulation into a structured remediation plan."}
          </p>
        </div>
        <button
          onClick={onGenerate}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[var(--brass)] px-4 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 ease-out hover:-translate-y-px hover:bg-[var(--brass-strong)] active:scale-[0.98]"
        >
          <Wand2 className="h-3.5 w-3.5" strokeWidth={2} />
          Generate Action Plan
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="glass-panel p-6 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-[var(--brass)]" strokeWidth={2} />
        <p className="text-[13px] text-muted-foreground">
          Drafting policy, amendments, and technical checklist…
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="glass-panel p-6">
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk)]" />
          {error}
        </p>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="glass-panel p-6 space-y-6">
      {/* Header with Draft badge and actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[var(--brass)]" strokeWidth={1.8} />
            <h3 className="font-display text-[18px] text-foreground">Remediation Action Plan</h3>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--risk)] border border-[var(--risk)]/30 bg-[var(--risk)]/10 rounded-full px-2 py-0.5">
              Draft — Not Legal Advice
            </span>
            {plan.fallback && (
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground border border-[var(--hairline)] rounded-full px-2 py-0.5">
                Deterministic Template
              </span>
            )}
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Structured hand-off for legal ops and engineering leads. Every amendment requires
            attorney review.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] px-3 py-1.5 text-[12px] text-foreground hover:bg-[var(--surface-muted)] transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Copied Markdown
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                Copy Markdown
              </>
            )}
          </button>
          <button
            onClick={() => exportPdf(plan, regulationText)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brass)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--primary-foreground)] hover:bg-[var(--brass-strong)] shadow-[var(--glow-brass)] transition-all"
          >
            <FileDown className="h-3.5 w-3.5" />
            Export Brief (PDF)
          </button>
        </div>
      </div>

      {/* Policy Draft */}
      <div>
        <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brass)] mb-2">
          1. Updated Policy Draft
        </h4>
        <div className="rounded-xl border border-[var(--hairline)] bg-[rgba(255,255,255,0.015)] p-4 text-[13px] leading-[1.65] text-foreground">
          {plan.policy_draft}
        </div>
      </div>

      {/* Contract Amendments */}
      <div>
        <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brass)] mb-2">
          2. Recommended Contract Amendments ({plan.amendments.length})
        </h4>
        <div className="grid gap-3">
          {plan.amendments.map((a, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[var(--hairline)] p-4 hover:border-[var(--hairline-strong)] transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono text-[11px] font-semibold text-foreground">
                  {a.contract_id} — {a.contract_name}
                </span>
                {a.citation && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground border border-[var(--hairline)] rounded px-1.5 py-0.5">
                    {a.citation}
                  </span>
                )}
              </div>
              <p className="text-[13px] leading-[1.55] text-foreground mb-1">
                <span className="text-muted-foreground font-medium">Proposed: </span>
                {a.suggestion}
              </p>
              {a.rationale && (
                <p className="text-[12px] text-muted-foreground leading-relaxed">
                  <span className="font-medium text-muted-foreground/80">Rationale: </span>
                  {a.rationale}
                </p>
              )}
              {a.clause_quote && (
                <div className="mt-2 rounded border border-[var(--hairline)] bg-amber-500/5 px-2.5 py-1 text-[11px] font-mono text-amber-200/90">
                  Grounding clause: "{a.clause_quote}"
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Technical Fixes Checklist */}
      <div>
        <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brass)] mb-2">
          3. Technical & Operational Fix Checklist
        </h4>
        <div className="space-y-2">
          {plan.tech_fixes.map((t, idx) => {
            const key = `${t.priority}-${t.title}`;
            const isDone = doneFixes.has(key);
            return (
              <div
                key={idx}
                onClick={() => {
                  setDoneFixes((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  });
                }}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                  isDone
                    ? "border-emerald-500/30 bg-emerald-500/5 opacity-70"
                    : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
                }`}
              >
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => {}}
                    className="rounded border-[var(--hairline)]"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[t.priority] || "bg-muted-foreground"}`}
                    />
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                      {t.priority}
                    </span>
                    <p
                      className={`text-[13px] font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}
                    >
                      {t.title}
                    </p>
                  </div>
                  {t.detail && (
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {t.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sources Appendix */}
      {plan.sources && plan.sources.length > 0 && (
        <div className="border-t border-[var(--hairline)] pt-4">
          <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brass)] mb-2">
            4. Sources Appendix ({plan.sources.length})
          </h4>
          <ul className="space-y-2 text-[12px]">
            {plan.sources.map((s, idx) => (
              <li key={idx} className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">
                  {s.title}{" "}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    ({s.instrument_id})
                  </span>
                </span>
                {s.official_url && (
                  <a
                    href={s.official_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[var(--brass)] hover:underline truncate"
                  >
                    {s.official_url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
