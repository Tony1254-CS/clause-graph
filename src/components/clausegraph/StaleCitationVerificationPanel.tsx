import { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type {
  CitationVerificationFinding,
  CitationVerificationStatus,
  CitationVerificationSummary,
} from "@/lib/citation-verify.types";

const STATUS_CONFIG: Record<
  CitationVerificationStatus,
  {
    label: string;
    badgeClass: string;
    icon: typeof ShieldCheck;
    description: string;
  }
> = {
  VERIFIED: {
    label: "VERIFIED",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
    description: "Statute confirmed in active force in official gazette/records.",
  },
  AMENDED: {
    label: "AMENDED",
    badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: Clock,
    description: "Subsequent legislative amendments enacted. Review current amendment text.",
  },
  REPEALED: {
    label: "REPEALED",
    badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    icon: XCircle,
    description: "Statute formally repealed or rescinded. High legal liability risk.",
  },
  SUPERSEDED: {
    label: "SUPERSEDED",
    badgeClass: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    icon: AlertTriangle,
    description: "Replaced by a successor legal instrument or court decision.",
  },
  UNVERIFIED: {
    label: "UNVERIFIED",
    badgeClass: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    icon: HelpCircle,
    description: "No authoritative official gazette record found. Verify before reliance.",
  },
};

export function CitationVerificationBadge({
  status,
  className = "",
}: {
  status: CitationVerificationStatus;
  className?: string;
}) {
  const conf = STATUS_CONFIG[status] ?? STATUS_CONFIG.UNVERIFIED;
  const Icon = conf.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium border uppercase tracking-wider ${conf.badgeClass} ${className}`}
      title={conf.description}
    >
      <Icon className="h-3 w-3 shrink-0" strokeWidth={2} />
      {conf.label}
    </span>
  );
}

export function CitationFindingCard({
  finding,
}: {
  finding: CitationVerificationFinding;
}) {
  const [expanded, setExpanded] = useState(false);
  const { citation, status, matchedAuthority, warningMessage, reasons, officialSourceUrl } =
    finding;

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-200 ${
        status === "REPEALED" || status === "SUPERSEDED"
          ? "border-rose-500/30 bg-rose-950/10"
          : status === "AMENDED"
            ? "border-amber-500/30 bg-amber-950/10"
            : status === "UNVERIFIED"
              ? "border-slate-700/50 bg-slate-900/20"
              : "border-emerald-500/20 bg-emerald-950/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <CitationVerificationBadge status={status} />
            <h4 className="text-[13.5px] font-medium text-foreground">
              {citation.actTitle}
              {citation.section && (
                <span className="ml-1 text-[var(--brass)] font-mono text-xs">
                  ({citation.section})
                </span>
              )}
            </h4>
            {citation.jurisdiction && (
              <span className="font-mono text-[10px] text-muted-foreground uppercase border border-white/10 px-1.5 py-0.5 rounded">
                {citation.jurisdiction}
              </span>
            )}
          </div>

          {warningMessage && (
            <p className="mt-2 text-xs font-medium text-amber-300/90 leading-relaxed bg-black/20 p-2.5 rounded-lg border border-amber-500/20">
              ⚠️ {warningMessage}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-mono transition-colors"
        >
          {expanded ? "Hide Audit" : "Audit Details"}
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3.5 pt-3.5 border-t border-white/5 space-y-2.5 text-xs text-muted-foreground">
          {citation.contextSnippet && (
            <div>
              <span className="font-mono text-[10px] uppercase text-muted-foreground/80 block mb-0.5">
                Cited in context:
              </span>
              <p className="font-serif italic text-foreground/80 bg-white/[0.02] p-2 rounded border border-white/5">
                &ldquo;{citation.contextSnippet}&rdquo;
              </p>
            </div>
          )}

          <div>
            <span className="font-mono text-[10px] uppercase text-muted-foreground/80 block mb-0.5">
              Verification Evidence:
            </span>
            <ul className="list-disc pl-4 space-y-1">
              {reasons.map((r, i) => (
                <li key={i} className="text-foreground/85">
                  {r}
                </li>
              ))}
            </ul>
          </div>

          {matchedAuthority && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              {matchedAuthority.effectiveDate && (
                <div>
                  <span className="text-muted-foreground">Effective Date: </span>
                  <span className="text-foreground">{matchedAuthority.effectiveDate}</span>
                </div>
              )}
              {matchedAuthority.amendedDate && (
                <div>
                  <span className="text-amber-400">Last Amended: </span>
                  <span className="text-foreground">{matchedAuthority.amendedDate}</span>
                </div>
              )}
              {matchedAuthority.repealedDate && (
                <div>
                  <span className="text-rose-400">Repealed Date: </span>
                  <span className="text-foreground">{matchedAuthority.repealedDate}</span>
                </div>
              )}
              {matchedAuthority.supersededBy && (
                <div className="sm:col-span-2">
                  <span className="text-purple-400">Superseded By: </span>
                  <span className="text-foreground font-semibold">{matchedAuthority.supersededBy}</span>
                </div>
              )}
            </div>
          )}

          {/* Official Source Link */}
          {(officialSourceUrl || citation.sourceUrl) && (
            <div className="pt-2 flex items-center gap-3">
              {officialSourceUrl && (
                <a
                  href={officialSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[var(--brass)] hover:underline font-mono text-[11px]"
                >
                  <ExternalLink className="h-3 w-3" />
                  Official Legislative Gazette
                </a>
              )}
              {citation.sourceUrl && citation.sourceUrl !== officialSourceUrl && (
                <a
                  href={citation.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:underline font-mono text-[11px]"
                >
                  <ExternalLink className="h-3 w-3" />
                  Cited Source Link
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function StaleCitationVerificationPanel({
  verification,
  className = "",
}: {
  verification?: CitationVerificationSummary;
  className?: string;
}) {
  if (!verification || verification.totalCitations === 0) return null;

  return (
    <div
      className={`rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-5 backdrop-blur-xl space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-[var(--hairline)]">
        <div className="flex items-center gap-2.5">
          <div
            className={`grid h-8 w-8 place-items-center rounded-xl border ${
              verification.requiresHumanReview
                ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {verification.requiresHumanReview ? (
              <ShieldAlert className="h-4 w-4" strokeWidth={2} />
            ) : (
              <ShieldCheck className="h-4 w-4" strokeWidth={2} />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-[15px] font-semibold text-foreground">
                Legal Citation Verification Audit
              </h3>
              {verification.requiresHumanReview && (
                <span className="font-mono text-[10px] uppercase font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Human Review Required
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Automated cross-check against authoritative legal gazettes and versioned statutes
            </p>
          </div>
        </div>

        {/* Status Counts Pill Summary */}
        <div className="flex items-center gap-2 font-mono text-[11px]">
          {verification.verifiedCount > 0 && (
            <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {verification.verifiedCount} Verified
            </span>
          )}
          {verification.amendedCount > 0 && (
            <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {verification.amendedCount} Amended
            </span>
          )}
          {verification.repealedCount > 0 && (
            <span className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
              {verification.repealedCount} Repealed
            </span>
          )}
          {verification.supersededCount > 0 && (
            <span className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold">
              {verification.supersededCount} Superseded
            </span>
          )}
          {verification.unverifiedCount > 0 && (
            <span className="px-2 py-1 rounded-md bg-slate-500/10 text-slate-400 border border-slate-500/20">
              {verification.unverifiedCount} Unverified
            </span>
          )}
        </div>
      </div>

      {/* Human Review Advisory Banner */}
      {verification.requiresHumanReview && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-amber-200">
            <strong>Legal Notice:</strong> This AI response contains references to legal
            authorities that are repealed, superseded, or not positively verified in the official
            repository. Do not execute contract clauses relying on these citations without formal
            counsel review.
          </p>
        </div>
      )}

      {/* Individual Citation Cards */}
      <div className="space-y-2.5">
        {verification.findings.map((f, i) => (
          <CitationFindingCard key={`${f.citation.normalizedKey}-${i}`} finding={f} />
        ))}
      </div>
    </div>
  );
}
