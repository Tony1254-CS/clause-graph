import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Loader2, Terminal, Copy, Check, Download, FileCode, PlayCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { generateComplianceCode, requestVerifiedCode, type ComplianceCode, type Stack } from "@/lib/compliance-code.functions";

type Props = {
  regulationText: string;
  gap: string;
  regulationId?: string;
  simulationRunId?: string;
  className?: string;
};

function useTyping(text: string, enabled: boolean, cps = 260) {
  const [out, setOut] = useState(enabled ? "" : text);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) {
      setOut(text);
      return;
    }
    setOut("");
    const start = performance.now();
    const step = (now: number) => {
      const chars = Math.min(text.length, Math.floor(((now - start) / 1000) * cps));
      setOut(text.slice(0, chars));
      if (chars < text.length) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, enabled, cps]);
  return { out, done: out.length === text.length, skip: () => setOut(text) };
}

const EXT: Record<string, string> = { python: "py", bash: "sh", terraform: "tf", yaml: "yaml" };

function CodeBlock({ code, language, animate }: { code: string; language: string; animate: boolean }) {
  const reducedMotion =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const { out, done, skip } = useTyping(code, animate && !reducedMotion);
  return (
    <div className="relative">
      <pre className="max-h-[420px] overflow-auto rounded-[12px] border border-[var(--hairline-strong)] bg-[rgba(11,14,20,0.6)] p-4 font-mono text-[12px] leading-[1.55] text-foreground/90 whitespace-pre">
        <code>{out}</code>
        {!done && <span className="ml-0.5 inline-block h-4 w-2 translate-y-[3px] animate-pulse bg-[color-mix(in_oklab,var(--brass)_70%,transparent)]" />}
      </pre>
      {!done && (
        <button
          onClick={skip}
          className="absolute right-2 top-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground transition-colors duration-200 hover:text-[var(--brass)]"
        >
          Skip →
        </button>
      )}
      <span className="absolute bottom-2 right-3 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {language}
      </span>
    </div>
  );
}

export function ComplianceCodePanel({ regulationText, gap, regulationId, simulationRunId, className }: Props) {
  const run = useServerFn(generateComplianceCode);
  const [stack, setStack] = useState<Stack>("aws");
  const [tab, setTab] = useState<"audit" | "remediation">("audit");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [artifact, setArtifact] = useState<ComplianceCode | null>(null);
  const [error, setError] = useState<string | null>(null);  const verifyGate = useServerFn(requestVerifiedCode);
  const [copied, setCopied] = useState(false);

  async function onGenerate() {
    if (status === "loading") return;
    setStatus("loading");
    setArtifact(null);
    setError(null);
    try {
      const res = await run({ data: { regulationText, gap, stack, regulationId, simulationRunId } });
      setArtifact(res);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate compliance code");
      setStatus("error");
    }
  }

  const active = useMemo(() => {
    if (!artifact) return null;
    return tab === "audit" ? artifact.audit_script : artifact.remediation;
  }, [artifact, tab]);

  async function onCopy() {
    if (!active) return;
    if (artifact?.artifact_id && artifact.review_status !== "approved") {
      try {
        const check = await verifyGate({ data: { artifactId: artifact.artifact_id, payload: active } });
        if (!check.approved) {
          toast.error("Gate Enforced: Compliance code is pending human review. Approve in Review Queue before copying.");
          return;
        }
      } catch {
        toast.error("Gate Enforced: Server verification failed. Unapproved code cannot be copied.");
        return;
      }
    }
    await navigator.clipboard.writeText(active.code);
    setCopied(true);
    toast.success("Code copied to clipboard");
    setTimeout(() => setCopied(false), 1600);
  }

  async function onDownload() {
    if (!active) return;
    if (artifact?.artifact_id && artifact.review_status !== "approved") {
      try {
        const check = await verifyGate({ data: { artifactId: artifact.artifact_id, payload: active } });
        if (!check.approved) {
          toast.error("Gate Enforced: Compliance code must be approved in the Review Queue before export.");
          return;
        }
      } catch {
        toast.error("Gate Enforced: Server verification failed. Export blocked.");
        return;
      }
    }
    const ext = EXT[active.language] ?? "txt";
    const blob = new Blob([active.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab}-${stack}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (status === "idle") {
    return (
      <div className={`glass-panel p-5 flex flex-wrap items-center justify-between gap-4 ${className ?? ""}`}>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
            <Terminal className="h-3 w-3" strokeWidth={1.8} /> Compliance-as-Code
          </p>
          <p className="mt-1 text-[13px] text-foreground">
            Generate an executable audit + IaC remediation for this gap.
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground truncate">Gap: {gap}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div role="tablist" className="flex rounded-[12px] border border-[var(--hairline-strong)] p-0.5">
            {(["aws", "gcp", "azure"] as const).map((s) => (
              <button
                key={s}
                role="tab"
                aria-selected={stack === s}
                onClick={() => setStack(s)}
                className={`rounded-[10px] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors duration-200 ${
                  stack === s ? "bg-[color-mix(in_oklab,var(--brass)_12%,transparent)] text-[var(--brass)]" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            onClick={onGenerate}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-4 py-2.5 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 ease-out hover:-translate-y-px hover:bg-[var(--brass-strong)] active:scale-[0.98]"
          >
            <PlayCircle className="h-3.5 w-3.5" strokeWidth={2} />
            Generate
          </button>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className={`glass-panel p-6 flex items-center gap-3 ${className ?? ""}`}>
        <Loader2 className="h-4 w-4 animate-spin text-[var(--brass)]" strokeWidth={2} />
        <p className="text-[13px] text-muted-foreground">Compiling audit script and remediation IaC…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`glass-panel p-6 ${className ?? ""}`}>
        <p className="text-[13px] text-muted-foreground">{error}</p>
        <button
          onClick={onGenerate}
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brass)] transition-colors duration-200 hover:underline"
        >
          Retry →
        </button>
      </div>
    );
  }

  if (!artifact) return null;

  const isPendingReview = artifact.review_status !== "approved";

  return (
    <div className={`glass-panel p-6 flex flex-col gap-5 ${className ?? ""}`}>
      {/* Governance Gate Banner */}
      {isPendingReview ? (
        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.08)] p-3 text-[12px]">
          <div className="flex items-center gap-2 text-[var(--risk)]">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              <strong>Enforced Approval Gate:</strong> Unreviewed AI draft held behind human review queue. Admin approval required before executing or copying IaC.
            </span>
          </div>
          <Link
            to="/reviews"
            className="shrink-0 font-mono text-[11px] font-medium text-[var(--risk)] underline hover:text-foreground"
          >
            Open Queue →
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-[12px] border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] p-3 text-[12px] text-emerald-400">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>
            <strong>Approved by Human Administrator:</strong> Tamper-evident cryptographic signature verified.
          </span>
        </div>
      )}

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
              <FileCode className="h-3 w-3" strokeWidth={1.8} /> Compliance-as-Code · {stack.toUpperCase()}
            </p>
            {isPendingReview && (
              <span className="rounded-full border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.1)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--risk)]">
                Unreviewed AI draft
              </span>
            )}
            {artifact.fallback && (
              <span className="rounded-full border border-[rgba(234,179,8,0.4)] bg-[rgba(234,179,8,0.1)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-yellow-400">
                Fallback engine
              </span>
            )}
          </div>
          <h3 className="mt-2 font-display text-[22px] leading-[1.15] tracking-tight text-foreground">
            Executable remediation
          </h3>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {new Date().toLocaleString()}
            {artifact.fallback && " · demo fallback"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCopy}
            title={isPendingReview ? "Requires admin approval before copying" : "Copy to clipboard"}
            className="inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--hairline-strong)] px-3 py-2 text-[12px] text-foreground transition-colors duration-200 hover:bg-[var(--surface-glass)]"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[var(--brass)]" strokeWidth={2} /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" strokeWidth={1.8} /> Copy
              </>
            )}
          </button>
          <button
            onClick={onDownload}
            title={isPendingReview ? "Requires admin approval before download" : "Download code"}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brass)] px-3 py-2 text-[12px] font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 hover:-translate-y-px hover:bg-[var(--brass-strong)] active:scale-[0.98]"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} /> Download
          </button>
        </div>
      </header>

      <div role="tablist" className="flex rounded-[12px] border border-[var(--hairline)] p-0.5 self-start">
        {(["audit", "remediation"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-[10px] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors duration-200 ${
              tab === k ? "bg-[color-mix(in_oklab,var(--brass)_12%,transparent)] text-[var(--brass)]" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {active && (
        <>
          <p className="text-[12.5px] leading-[1.6] text-muted-foreground">{active.description}</p>
          <CodeBlock code={active.code} language={active.language} animate={status === "done"} />
        </>
      )}

      {artifact.test_cases.length > 0 && (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Test cases
          </p>
          <ul className="flex flex-col gap-1.5">
            {artifact.test_cases.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px] text-foreground/90">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--brass)]" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
