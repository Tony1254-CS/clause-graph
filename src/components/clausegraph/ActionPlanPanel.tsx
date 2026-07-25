import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2,
  Sparkles,
  Copy,
  FileDown,
  Check,
  ShieldAlert,
  ClipboardList,
} from "lucide-react";
import { generateActionPlan } from "@/lib/action-plan.functions";
import type { ActionPlan, ActionPlanInput, TechPriority } from "@/lib/action-plan-types";

const PRIORITY_DOT: Record<TechPriority, string> = {
  P0: "bg-[var(--risk)]",
  P1: "bg-brass",
  P2: "bg-muted-foreground/60",
};

function planToMarkdown(plan: ActionPlan, regulationText: string): string {
  const lines: string[] = [];
  lines.push("# ClauseGraph Compliance Action Plan");
  lines.push("");
  lines.push(`_Generated ${new Date().toISOString()}_`);
  lines.push("");
  lines.push(
    "> Draft output for legal review. Every amendment below is a suggestion, never a final position.",
  );
  lines.push("");
  lines.push("## Proposed regulation");
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
  });
  lines.push("");
  lines.push("## Technical fix checklist");
  lines.push("");
  plan.tech_fixes.forEach((t) => {
    lines.push(`- [ ] **${t.priority}** — ${t.title}`);
    if (t.detail) lines.push(`      ${t.detail}`);
  });
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
    }
  };

  const writeWrapped = (
    text: string,
    size: number,
    style: "normal" | "bold" = "normal",
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

  writeWrapped("ClauseGraph Compliance Action Plan", 18, "bold", 6);
  writeWrapped(`Generated ${new Date().toLocaleString()}`, 9, "normal", 8);
  y += 6;

  doc.setDrawColor(180);
  doc.line(margin, y, margin + width, y);
  y += 14;

  writeWrapped(
    "Draft output for legal review. Every amendment below is a suggestion, never a final position.",
    10,
    "bold",
    10,
  );

  writeWrapped("Proposed regulation", 12, "bold", 6);
  writeWrapped(regulationText, 10, "normal", 3);
  y += 10;

  writeWrapped("Updated policy draft", 12, "bold", 6);
  writeWrapped(plan.policy_draft, 10, "normal", 3);
  y += 10;

  writeWrapped("Contract amendments (for legal review)", 12, "bold", 6);
  plan.amendments.forEach((a) => {
    writeWrapped(`${a.contract_id} — ${a.contract_name}`, 10, "bold", 2);
    writeWrapped(`Suggestion: ${a.suggestion}`, 10, "normal", 2);
    if (a.rationale) writeWrapped(`Rationale: ${a.rationale}`, 10, "normal", 2);
    y += 4;
  });
  y += 6;

  writeWrapped("Technical fix checklist", 12, "bold", 6);
  plan.tech_fixes.forEach((t) => {
    writeWrapped(`[ ] ${t.priority} — ${t.title}`, 10, "bold", 2);
    if (t.detail) writeWrapped(t.detail, 10, "normal", 2);
    y += 4;
  });

  doc.save(`clausegraph-action-plan-${Date.now()}.pdf`);
}

type Props = {
  regulationText: string;
  summary?: string;
  impacts: ActionPlanInput["impacts"];
  variant?: "reactive" | "forecast";
};

export function ActionPlanPanel({ regulationText, summary, impacts, variant = "reactive" }: Props) {
  const isForecast = variant === "forecast";
  const runPlan = useServerFn(generateActionPlan);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [plan, setPlan] = useState<ActionPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onGenerate() {
    if (status === "loading") return;
    setStatus("loading");
    setError(null);
    setPlan(null);
    try {
      const res = await runPlan({
        data: { regulationText, summary, impacts },
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
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
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
          className="inline-flex shrink-0 items-center gap-2 rounded-[12px] bg-[var(--brass)] px-4 py-2.5 text-[13px] font-medium text-[var(--primary-foreground)] shadow-[var(--glow-brass)] hover:bg-[var(--brass-strong)] active:scale-[0.98] duration-150 ease-out transition-all"
        >
          <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
          Generate Action Plan
        </button>

      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="glass-panel p-6 flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-brass" strokeWidth={2} />
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
        <button
          onClick={onGenerate}
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-brass hover:underline duration-150 ease-out transition-colors"
        >
          Retry →
        </button>
      </div>
    );
  }


  if (!plan) return null;

  return (
    <div className="glass-panel p-6 flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
            <ClipboardList className="h-3 w-3" strokeWidth={1.8} />
            Compliance Action Plan
          </p>
          <h3 className="mt-2 font-display text-[26px] leading-[1.1] tracking-tight text-foreground">
            Draft remediation
          </h3>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {new Date().toLocaleString()}
            {plan.fallback && " · demo fallback"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--hairline-strong)] px-3 py-2 text-[12px] text-foreground hover:bg-[rgba(255,255,255,0.03)] duration-150 ease-out transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-brass" strokeWidth={2} />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
                Copy
              </>
            )}
          </button>
          <button
            onClick={() => exportPdf(plan, regulationText)}
            className="inline-flex items-center gap-1.5 rounded-[12px] bg-[var(--brass)] px-3 py-2 text-[12px] font-medium text-[var(--primary-foreground)] shadow-[var(--glow-brass)] hover:bg-[var(--brass-strong)] active:scale-[0.98] duration-150 ease-out transition-all"
          >
            <FileDown className="h-3.5 w-3.5" strokeWidth={2} />
            Export PDF
          </button>

        </div>
      </header>

      <div className="rounded-[12px] border border-[var(--hairline-strong)] bg-[rgba(201,166,107,0.04)] p-3.5">
        <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.2em] text-brass">
          <ShieldAlert className="h-3 w-3" strokeWidth={1.8} />
          Draft output — for legal review
        </p>
        <p className="mt-1.5 text-[12px] leading-[1.55] text-muted-foreground">
          Every amendment below is a suggestion. Nothing here is a final legal position;
          route through counsel before adopting.
        </p>
      </div>

      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
          Updated policy draft
        </p>
        <p className="text-[13.5px] leading-[1.7] text-foreground/90">{plan.policy_draft}</p>
      </section>

      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
          Contract amendments
        </p>
        <ul className="flex flex-col gap-3">
          {plan.amendments.map((a, idx) => (
            <li
              key={`${a.contract_id}-${idx}`}
              className="rounded-[12px] border border-[var(--hairline)] p-4"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass">
                    {a.contract_id}
                  </span>
                  <span className="ml-2 text-[13px] text-foreground">{a.contract_name}</span>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-brass border border-[var(--hairline-strong)] rounded-full px-2 py-0.5">
                  For legal review
                </span>
              </div>
              <p className="mt-2 text-[13px] leading-[1.6] text-foreground/90">
                {a.suggestion}
              </p>
              {a.rationale && (
                <p className="mt-1.5 text-[12px] leading-[1.55] text-muted-foreground">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground mr-1.5">
                    Why
                  </span>
                  {a.rationale}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
          Technical fix checklist
        </p>
        <ul className="flex flex-col gap-2">
          {plan.tech_fixes.map((t, idx) => (
            <li
              key={`${t.title}-${idx}`}
              className="rounded-[12px] border border-[var(--hairline)] p-3 flex gap-3"
            >

              <input
                type="checkbox"
                className="mt-1 h-3.5 w-3.5 accent-[var(--brass)] cursor-pointer"
                aria-label={`Mark ${t.title} done`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[t.priority]}`}
                  />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">
                    {t.priority}
                  </span>
                  <span className="text-[13px] text-foreground">{t.title}</span>
                </div>
                {t.detail && (
                  <p className="mt-1 text-[12px] leading-[1.55] text-muted-foreground">
                    {t.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
