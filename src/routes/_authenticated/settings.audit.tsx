import { useState, useTransition, useMemo } from "react";
import { createPortal } from "react-dom";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  ChevronRight,
  X,
  FileSpreadsheet,
  FileText,
  Anchor,
  Clock,
  User,
  Hash,
  Database,
  ArrowDownCircle,
  Filter,
  Zap,
  Lock,
  AlertCircle,
  Scale,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { myRoleQuery, profileQuery } from "@/data/queries";
import {
  getAuditLogs,
  verifyAuditTrail,
  exportAuditCsv,
  createAuditAnchorSnapshot,
  getLatestAnchorSnapshot,
} from "@/lib/audit/audit.functions";
import type { AuditEvent, AuditAction, AuditFilterParams } from "@/lib/audit/types";
import { RouteError } from "@/components/clausegraph/RouteError";
import jsPDF from "jspdf";

export const Route = createFileRoute("/_authenticated/settings/audit")({
  head: () => ({
    meta: [
      { title: "Audit Ledger — ClauseGraph" },
      { name: "description", content: "Cryptographic, tamper-evident audit ledger and governance trail." },
      { property: "og:title", content: "Audit Ledger — ClauseGraph" },
      { property: "og:description", content: "Cryptographic, tamper-evident audit ledger and governance trail." },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(myRoleQuery),
      context.queryClient.ensureQueryData(profileQuery),
    ]),
  component: AuditPage,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Audit ledger unavailable" error={error} reset={reset} />
  ),
});

function formatTimestamp(value: unknown): string {
  if (!value) return "—";
  if (value instanceof Date) {
    return value.toISOString().replace("T", " ").slice(0, 19) + " UTC";
  }
  if (typeof value === "string") {
    return value.replace("T", " ").replace("Z", " UTC");
  }
  return String(value);
}

function Stat({ label, value, isRisk }: { label: string; value: string; isRisk?: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`mt-0.5 font-mono text-[15px] ${
          isRisk ? "text-[var(--risk)] font-semibold" : "text-[var(--brass)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  if (action.startsWith("audit.verified") || action.startsWith("audit.anchored")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brass)]/40 bg-[color-mix(in_oklab,var(--brass)_12%,transparent)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--brass)] shadow-[0_0_12px_rgba(94,234,212,0.1)]">
        <ShieldCheck size={12} className="text-[var(--brass)]" />
        {action}
      </span>
    );
  }

  if (action === "review.approved") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-emerald-400">
        <CheckCircle2 size={12} className="text-emerald-400" />
        {action}
      </span>
    );
  }

  if (action === "review.rejected" || action.includes("deletion")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(225,82,75,0.4)] bg-[color-mix(in_oklab,var(--risk)_14%,transparent)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-[var(--risk)] shadow-[0_0_12px_rgba(225,82,72,0.12)]">
        <AlertCircle size={12} className="text-[var(--risk)]" />
        {action}
      </span>
    );
  }

  if (action.startsWith("simulation.")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/35 bg-purple-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-purple-300">
        <Zap size={12} className="text-purple-400" />
        {action}
      </span>
    );
  }

  if (action.startsWith("review.")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-amber-400">
        <Clock size={12} className="text-amber-400" />
        {action}
      </span>
    );
  }

  if (action.startsWith("contract.") || action.startsWith("clause.")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/35 bg-sky-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-sky-400">
        <FileText size={12} className="text-sky-400" />
        {action}
      </span>
    );
  }

  if (action.startsWith("auth.")) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline-strong)] bg-[var(--surface-glass)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
        <Lock size={12} className="text-muted-foreground" />
        {action}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-glass)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground">
      <Hash size={12} className="text-muted-foreground" />
      {action}
    </span>
  );
}

function formatActionTitle(action: string, entityType: string, entityId: string): string {
  switch (action) {
    case "audit.verified":
      return "Cryptographic Chain Integrity Verification";
    case "audit.anchored":
      return "Point-in-Time Anchor Snapshot Created";
    case "audit.exported":
      return "Tamper-Evident Ledger Exported";
    case "simulation.run":
      return "Simulation Impact Blast-Radius Analysis";
    case "simulation.fallback_activated":
      return "Deterministic Fallback Activated";
    case "code.generated":
      return "Compliance-as-Code Artifact Generated";
    case "action_plan.generated":
      return "Executive Action Plan Compiled";
    case "whatif.run":
      return "What-If Regulatory Scenario Run";
    case "review.created":
      return "Item Submitted to Review Queue";
    case "review.approved":
      return "Human Sign-off Approved";
    case "review.rejected":
      return "Human Review Rejected";
    case "review.edited":
      return "Payload Amended by Reviewer";
    case "review.comment_added":
      return "Review Discussion Comment Added";
    case "review.escalated":
      return "SLA Breach Escalation Triggered";
    case "contract.uploaded":
      return "Contract Document Uploaded";
    case "contract.parsed":
      return "Contract Segmentation & Ontology Linking";
    case "clause.edited":
      return "Contract Clause Amended";
    case "auth.login":
      return "Workspace Authentication Session";
    default:
      return `${action.replace(/\./g, " · ")} — ${entityType} (${entityId})`;
  }
}

function AuditPage() {
  const { data: myRole } = useSuspenseQuery(myRoleQuery);
  const { data: profile } = useSuspenseQuery(profileQuery);
  const isAdmin = myRole === "admin";

  // Server functions
  const fetchLogsFn = useServerFn(getAuditLogs);
  const verifyChainFn = useServerFn(verifyAuditTrail);
  const exportCsvFn = useServerFn(exportAuditCsv);
  const createAnchorFn = useServerFn(createAuditAnchorSnapshot);
  const getLatestAnchorFn = useServerFn(getLatestAnchorSnapshot);

  // Filter state
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterEntityType, setFilterEntityType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeCursor, setActiveCursor] = useState<number | undefined>(undefined);

  // UI state
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<any | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Query audit logs
  const activeFilters: AuditFilterParams = {
    action: filterAction !== "all" ? (filterAction as AuditAction) : undefined,
    entityType: filterEntityType !== "all" ? filterEntityType : undefined,
    cursor: activeCursor,
    limit: 50,
  };

  const {
    data: logsData,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: [
      "audit-logs",
      filterAction,
      filterEntityType,
      activeCursor,
    ],
    queryFn: async () => {
      if (!isAdmin) return { events: [], nextCursor: null };
      return await fetchLogsFn({ data: activeFilters });
    },
    enabled: isAdmin,
  });

  // Query latest anchor
  const { data: latestAnchor, refetch: refetchAnchor } = useQuery({
    queryKey: ["audit-latest-anchor"],
    queryFn: async () => {
      if (!isAdmin) return null;
      return await getLatestAnchorFn();
    },
    enabled: isAdmin,
  });

  // Verification mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      setVerifyError(null);
      return await verifyChainFn();
    },
    onSuccess: (data) => {
      setVerifyStatus(data);
      refetchLogs();
      refetchAnchor();
    },
    onError: (err: any) => {
      setVerifyError(err?.message || "Verification failed");
    },
  });

  // Anchor snapshot mutation
  const anchorMutation = useMutation({
    mutationFn: async () => {
      return await createAnchorFn();
    },
    onSuccess: () => {
      refetchAnchor();
      refetchLogs();
    },
  });

  // Handle CSV export
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const res = await exportCsvFn({
        data: {
          filter: activeFilters,
          format: "csv",
        },
      });

      if (res?.csvContent) {
        const blob = new Blob([res.csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", res.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      console.error("Export error:", err);
      alert(`Export failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle PDF export
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const events = logsData?.events || [];
      const doc = new jsPDF();

      doc.setFontSize(18);
      doc.text("ClauseGraph Audit Ledger Certificate", 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Organization: ${profile?.orgName || "Enterprise Workspace"}`, 14, 28);
      doc.text(`Exported At: ${new Date().toUTCString()} (UTC)`, 14, 34);
      doc.text(`Total Records in Report: ${events.length}`, 14, 40);

      if (latestAnchor) {
        doc.text(
          `Latest Verified Anchor: #${latestAnchor.head_id} (${latestAnchor.row_count} rows, anchored ${formatTimestamp(
            latestAnchor.anchored_at
          )})`,
          14,
          46
        );
      }

      doc.setDrawColor(200);
      doc.line(14, 52, 196, 52);

      let y = 60;
      doc.setFontSize(9);
      doc.setTextColor(0);

      events.slice(0, 30).forEach((evt) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.text(`#${evt.id} [${evt.action}]`, 14, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`${formatTimestamp(evt.created_at)} | Actor: ${evt.actor_label || evt.actor_id || "system"}`, 80, y);
        doc.setTextColor(0);

        y += 5;
        doc.text(`Entity: ${evt.entity_type} (${evt.entity_id}) | Hash: ${evt.row_hash.slice(0, 16)}...`, 14, y);
        y += 8;
      });

      if (events.length > 30) {
        doc.setTextColor(120);
        doc.text(
          `... and ${events.length - 30} additional records truncated from PDF preview. Use CSV for full export.`,
          14,
          y
        );
      }

      doc.save(`clausegraph-audit-report-${Date.now()}.pdf`);
    } catch (err: any) {
      console.error("PDF export error:", err);
      alert(`PDF export failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const rawEvents = logsData?.events || [];

  const filteredEvents = useMemo(() => {
    if (!searchQuery.trim()) return rawEvents;
    const q = searchQuery.toLowerCase();
    return rawEvents.filter((evt) => {
      return (
        evt.action.toLowerCase().includes(q) ||
        evt.entity_type.toLowerCase().includes(q) ||
        evt.entity_id.toLowerCase().includes(q) ||
        (evt.actor_label && evt.actor_label.toLowerCase().includes(q)) ||
        (evt.actor_id && evt.actor_id.toLowerCase().includes(q)) ||
        (evt.correlation_id && evt.correlation_id.toLowerCase().includes(q)) ||
        evt.row_hash.toLowerCase().includes(q) ||
        String(evt.id).includes(q)
      );
    });
  }, [rawEvents, searchQuery]);

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="w-full max-w-[1200px] py-12">
          <div className="glass-panel p-8 text-center max-w-lg mx-auto border-[rgba(225,82,75,0.3)]">
            <ShieldAlert className="w-12 h-12 text-[var(--risk)] mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold text-foreground">Access Restricted</h2>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
              The tamper-evident audit ledger contains organization-wide compliance records and cryptographic chain proofs.
              Access is restricted strictly to designated workspace administrators.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="w-full max-w-[1200px]">
        {/* Header: Clean & minimal, identical to stale-citations.tsx & contracts.index.tsx */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
              Governance Trail · {rawEvents.length} event{rawEvents.length === 1 ? "" : "s"}
            </p>
            <h1 className="mt-2 font-display text-[38px] leading-[1.05] tracking-tight text-foreground">
              Audit Ledger
            </h1>
          </div>

          <div className="flex flex-wrap items-end gap-6 sm:gap-8">
            <Stat label="Active Head" value={rawEvents[0] ? `#${rawEvents[0].id}` : "Genesis"} />
            <Stat
              label="Anchor"
              value={latestAnchor ? `#${latestAnchor.head_id}` : "None"}
            />
            <Stat
              label="Integrity"
              value={verifyStatus?.valid === false ? "Breached" : "SHA-256 Chained"}
              isRisk={verifyStatus?.valid === false}
            />

            <button
              type="button"
              onClick={() => anchorMutation.mutate()}
              disabled={anchorMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] px-3.5 py-1.5 text-xs font-semibold text-foreground transition-all duration-200 ease-out hover:-translate-y-px hover:border-[var(--brass)] hover:text-[var(--brass)] disabled:opacity-50"
              title="Create point-in-time external anchor snapshot"
            >
              <Anchor className={`h-3.5 w-3.5 ${anchorMutation.isPending ? "animate-spin text-sky-400" : "text-sky-400"}`} />
              <span>{anchorMutation.isPending ? "Anchoring..." : "Anchor Head"}</span>
            </button>

            <button
              type="button"
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 ease-out hover:-translate-y-px hover:bg-[var(--brass-strong)] disabled:opacity-50"
              title="Verify cryptographic hash chain integrity"
            >
              <RefreshCw className={`h-4 w-4 ${verifyMutation.isPending ? "animate-spin" : ""}`} />
              <span>{verifyMutation.isPending ? "Verifying..." : "Verify Chain"}</span>
            </button>
          </div>
        </header>

        {/* Dismissible Verification Results Banner */}
        {verifyStatus && (
          <div
            className={`mb-6 glass-panel p-4 flex items-center justify-between gap-4 border ${
              verifyStatus.valid ? "border-emerald-500/30" : "border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.06)]"
            }`}
          >
            <div className="flex items-center gap-3">
              {verifyStatus.valid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-[var(--risk)] shrink-0" />
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
                <span className="font-semibold text-foreground">
                  {verifyStatus.valid ? "Cryptographic Chain Verified:" : "Integrity Failure Detected:"}
                </span>
                <span className="text-[var(--brass)]">{verifyStatus.rows_checked} links checked</span>
                <span className="text-muted-foreground">
                  Head #{verifyStatus.head_id} ({verifyStatus.head_hash?.slice(0, 10)}...)
                </span>
                {verifyStatus.anchored && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Tail Intact (Anchored)
                  </span>
                )}
                {verifyStatus.error && (
                  <span className="text-[var(--risk)]">{verifyStatus.error}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => setVerifyStatus(null)}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.05)] transition-colors"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {verifyError && (
          <div className="mb-6 glass-panel p-4 flex items-center justify-between gap-4 border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.06)] text-xs font-mono text-[var(--risk)]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{verifyError}</span>
            </div>
            <button
              onClick={() => setVerifyError(null)}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.05)] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Streamlined Search & Export Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search actions, entities, actors, IDs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2 rounded-full bg-[var(--surface-glass)] border border-[var(--hairline)] text-xs md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--brass)] font-mono transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value);
                setActiveCursor(undefined);
              }}
              className="rounded-full bg-[var(--surface-glass)] border border-[var(--hairline)] px-3.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground focus:outline-none focus:border-[var(--brass)] transition-colors"
            >
              <option value="all">All Actions</option>
              <optgroup label="AI Simulations & Pipelines">
                <option value="simulation.run">simulation.run</option>
                <option value="simulation.fallback_activated">simulation.fallback_activated</option>
                <option value="code.generated">code.generated</option>
                <option value="action_plan.generated">action_plan.generated</option>
                <option value="whatif.run">whatif.run</option>
              </optgroup>
              <optgroup label="Review Queue Decisions">
                <option value="review.created">review.created</option>
                <option value="review.approved">review.approved</option>
                <option value="review.rejected">review.rejected</option>
                <option value="review.edited">review.edited</option>
                <option value="review.comment_added">review.comment_added</option>
                <option value="review.escalated">review.escalated</option>
              </optgroup>
              <optgroup label="Contracts & Clauses">
                <option value="contract.uploaded">contract.uploaded</option>
                <option value="contract.parsed">contract.parsed</option>
                <option value="clause.edited">clause.edited</option>
              </optgroup>
              <optgroup label="Cryptographic Governance">
                <option value="audit.verified">audit.verified</option>
                <option value="audit.anchored">audit.anchored</option>
                <option value="audit.exported">audit.exported</option>
                <option value="auth.login">auth.login</option>
              </optgroup>
            </select>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting || rawEvents.length === 0}
              className="press inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:border-[var(--hairline-strong)] hover:text-foreground disabled:opacity-50 transition-ui"
              title="Export ledger as CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting || rawEvents.length === 0}
              className="press inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:border-[var(--hairline-strong)] hover:text-foreground disabled:opacity-50 transition-ui"
              title="Export certificate as PDF"
            >
              <FileText className="h-3.5 w-3.5 text-rose-400" />
              <span>PDF</span>
            </button>

            <span className="font-mono text-[11px] text-muted-foreground shrink-0 uppercase tracking-wider">
              {filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Findings List: Clean 3-Column Layout identical to stale-citations.tsx */}
        {logsLoading && rawEvents.length === 0 ? (
          <div className="glass-panel p-10 text-center text-muted-foreground font-mono text-xs animate-pulse">
            Loading cryptographic audit ledger...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="glass-panel mx-auto max-w-md p-10 text-center space-y-3">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-[var(--hairline-strong)]">
              <CheckCircle2 className="h-5 w-5 text-[var(--brass)]" strokeWidth={1.75} />
            </div>
            <h3 className="font-display text-[20px] leading-[1.15] tracking-tight text-foreground">
              No Audit Records Found
            </h3>
            <p className="text-[13px] text-muted-foreground">
              No ledger events match the specified search query or action filter.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredEvents.map((evt) => (
              <div
                key={evt.id}
                onClick={() => setSelectedEvent(evt)}
                className="glass-panel group grid grid-cols-1 md:grid-cols-[160px_1fr_auto] items-center gap-4 md:gap-7 px-6 py-5 min-h-[88px] duration-150 ease-out transition-all hover:border-[var(--hairline-strong)] cursor-pointer"
              >
                {/* Col 1: Action Badge */}
                <div>
                  <ActionBadge action={evt.action} />
                </div>

                {/* Col 2: Action Title & Event Metadata */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-[17px] md:text-[18px] leading-snug tracking-tight text-foreground group-hover:text-[var(--brass)] duration-150 ease-out transition-colors truncate">
                      {formatActionTitle(evt.action, evt.entity_type, evt.entity_id)}
                    </h3>
                    <span className="font-mono text-[11px] text-[var(--brass)] font-semibold shrink-0">
                      #{evt.id}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground truncate flex items-center gap-2 font-mono">
                    <span>{formatTimestamp(evt.created_at)}</span>
                    <span className="text-muted-foreground/40">&middot;</span>
                    <span className="text-foreground/85">{evt.actor_label || evt.actor_id || "System"}</span>
                    <span className="text-muted-foreground/40">&middot;</span>
                    <span className="text-muted-foreground">{evt.entity_type} ({evt.entity_id})</span>
                    {evt.correlation_id && (
                      <>
                        <span className="text-muted-foreground/40">&middot;</span>
                        <span className="text-[var(--brass)]/80">corr: {evt.correlation_id.slice(0, 8)}...</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Col 3: Hash Preview + Pill Inspect Action Button */}
                <div className="flex items-center gap-4 justify-between md:justify-end shrink-0">
                  <div className="text-right hidden sm:block">
                    <span className="font-mono text-[11px] text-muted-foreground/80 block select-all">
                      {evt.row_hash.slice(0, 10)}...
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--brass)]/70">
                      SHA-256 v{evt.hash_version}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(evt);
                    }}
                    className="press inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:border-[var(--brass)] hover:text-foreground transition-ui"
                  >
                    <span>Inspect</span>
                    <ChevronRight size={13} className="text-[var(--brass)]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cursor Pagination Footer */}
        {logsData?.nextCursor && (
          <div className="pt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setActiveCursor(logsData.nextCursor || undefined)}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] px-4 py-2 text-xs font-mono text-foreground hover:border-[var(--brass)] hover:text-[var(--brass)] transition-all shadow-sm"
            >
              <ArrowDownCircle className="w-4 h-4 text-[var(--brass)]" />
              Load Older Records (Before #{logsData.nextCursor})
            </button>
          </div>
        )}

        {/* Detail Inspection Drawer: matching EvidenceDrawer layout perfectly */}
        {selectedEvent && typeof document !== "undefined" &&
          createPortal(
            <div className="fixed inset-0 z-[100] flex justify-end bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
              <div className="flex-1" onClick={() => setSelectedEvent(null)} aria-label="Close backdrop" />

              <div className="w-full max-w-[860px] h-full h-dvh bg-[var(--shell-bg)] border-l border-[var(--hairline-strong)] text-foreground shadow-[var(--shadow-lift)] flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="px-7 py-5 border-b border-[var(--hairline)] bg-[var(--shell-secondary)] flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="font-display text-[23px] md:text-[25px] leading-tight tracking-tight text-foreground truncate">
                      Audit Event Dossier
                    </h2>
                    <p className="mt-1.5 text-[14px] text-muted-foreground truncate">
                      Action:{" "}
                      <span className="text-foreground font-mono font-medium">{selectedEvent.action}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full bg-[rgba(255,255,255,0.04)] text-muted-foreground border border-[var(--hairline)]">
                      Event #{selectedEvent.id}
                    </span>
                    <button
                      onClick={() => setSelectedEvent(null)}
                      className="press p-2.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.05)] transition-colors ml-1"
                      title="Close Drawer (Esc)"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 premium-scrollbar">
                  {/* Section 1: Cryptographic Chaining Details */}
                  <div className="glass-panel p-6 space-y-4 border border-[rgba(94,234,212,0.28)] border-l-4 border-l-[var(--brass)] bg-gradient-to-br from-[rgba(94,234,212,0.03)] via-transparent to-transparent shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
                    <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                      <span className="flex items-center gap-2 text-[var(--brass)] font-semibold uppercase tracking-wider text-[11px]">
                        <ShieldCheck size={15} /> Cryptographic Proof
                      </span>
                      <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.14)] text-foreground">
                        Version: v{selectedEvent.hash_version}
                      </span>
                    </div>

                    <div className="space-y-3 font-mono text-[11px] text-foreground">
                      <div className="p-3 rounded-[10px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.08)]">
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-1">
                          Row Hash (SHA-256 Digest)
                        </span>
                        <span className="text-[var(--brass)] font-semibold break-all select-all">
                          {selectedEvent.row_hash}
                        </span>
                      </div>

                      <div className="p-3 rounded-[10px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.08)]">
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-1">
                          Previous Hash (prev_hash)
                        </span>
                        <span className="text-muted-foreground/80 break-all select-all">
                          {selectedEvent.prev_hash}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Event Attributes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="glass-panel p-4">
                      <span className="text-muted-foreground block font-mono text-[10px] uppercase tracking-wider">
                        Entity Target
                      </span>
                      <span className="font-semibold text-foreground mt-1 block truncate">
                        {selectedEvent.entity_type} : {selectedEvent.entity_id}
                      </span>
                    </div>

                    <div className="glass-panel p-4">
                      <span className="text-muted-foreground block font-mono text-[10px] uppercase tracking-wider">
                        Actor & Role
                      </span>
                      <span className="font-semibold text-foreground mt-1 block truncate">
                        {selectedEvent.actor_label || selectedEvent.actor_id || "System Engine"} ({selectedEvent.actor_role})
                      </span>
                    </div>

                    {selectedEvent.correlation_id && (
                      <div className="sm:col-span-2 glass-panel p-4 font-mono text-[11px]">
                        <span className="text-muted-foreground block font-mono text-[10px] uppercase tracking-wider font-sans">
                          Correlation ID
                        </span>
                        <span className="text-[var(--brass)] break-all">{selectedEvent.correlation_id}</span>
                      </div>
                    )}
                  </div>

                  {/* Section 3: Decision Basis / Redacted Rationale */}
                  {selectedEvent.basis && (
                    <div className="glass-panel p-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-mono text-[10px] uppercase tracking-wider text-[var(--brass)] font-semibold flex items-center gap-1.5">
                          <Scale size={13} /> Decision Basis (Why)
                        </h4>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                          Redacted at write-time
                        </span>
                      </div>
                      <pre className="p-3 rounded-[10px] bg-[rgba(0,0,0,0.35)] border border-[rgba(255,255,255,0.08)] text-foreground/90 font-mono text-[11px] overflow-x-auto max-h-48 premium-scrollbar">
                        {JSON.stringify(selectedEvent.basis, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Section 4: Before / After Snapshots */}
                  {selectedEvent.before && (
                    <div className="glass-panel p-5 space-y-2">
                      <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Before Snapshot
                      </h4>
                      <pre className="p-3 rounded-[10px] bg-[rgba(0,0,0,0.35)] border border-[rgba(255,255,255,0.08)] text-foreground/90 font-mono text-[11px] overflow-x-auto max-h-48 premium-scrollbar">
                        {JSON.stringify(selectedEvent.before, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedEvent.after && (
                    <div className="glass-panel p-5 space-y-2">
                      <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        After Snapshot / Diff
                      </h4>
                      <pre className="p-3 rounded-[10px] bg-[rgba(0,0,0,0.35)] border border-[rgba(255,255,255,0.08)] text-foreground/90 font-mono text-[11px] overflow-x-auto max-h-48 premium-scrollbar">
                        {JSON.stringify(selectedEvent.after, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Section 5: Metadata & Attribution */}
                  <div className="glass-panel p-5 space-y-2">
                    <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Metadata & Attribution
                    </h4>
                    <pre className="p-3 rounded-[10px] bg-[rgba(0,0,0,0.35)] border border-[rgba(255,255,255,0.08)] text-muted-foreground font-mono text-[11px] overflow-x-auto max-h-48 premium-scrollbar">
                      {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </AppShell>
  );
}
