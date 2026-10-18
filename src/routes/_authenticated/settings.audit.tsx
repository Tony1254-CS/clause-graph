import { useState, useTransition } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  History,
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

function StatCard({
  label,
  value,
  sub,
  alert,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  alert?: boolean;
  icon?: any;
}) {
  return (
    <div
      className={`glass-panel p-4 flex flex-col justify-between ${
        alert ? "border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.06)]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground/70" />}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={`font-display text-[26px] font-semibold leading-none ${
            alert ? "text-[var(--risk)]" : "text-foreground"
          }`}
        >
          {value}
        </span>
        {sub && <span className="font-mono text-[10px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  if (action.startsWith("auth.")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-blue-400">
        {action}
      </span>
    );
  }
  if (action.startsWith("simulation.")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-purple-400">
        {action}
      </span>
    );
  }
  if (action.startsWith("review.")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-400">
        {action}
      </span>
    );
  }
  if (action.startsWith("audit.")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-400">
        {action}
      </span>
    );
  }
  if (action.startsWith("contract.")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-sky-400">
        {action}
      </span>
    );
  }
  if (action.startsWith("workspace.")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-rose-400">
        {action}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface-glass)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
      {action}
    </span>
  );
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
  const [filterCorrelationId, setFilterCorrelationId] = useState<string>("");
  const [filterEntityId, setFilterEntityId] = useState<string>("");
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

  // UI state
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<any | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [activeCursor, setActiveCursor] = useState<number | undefined>(undefined);
  const [accumulatedEvents, setAccumulatedEvents] = useState<AuditEvent[]>([]);
  const [isPending, startTransition] = useTransition();

  // Query audit logs
  const activeFilters: AuditFilterParams = {
    action: filterAction !== "all" ? (filterAction as AuditAction) : undefined,
    entityType: filterEntityType !== "all" ? filterEntityType : undefined,
    correlationId: filterCorrelationId.trim() || undefined,
    entityId: filterEntityId.trim() || undefined,
    startDate: filterStartDate ? new Date(filterStartDate).toISOString() : undefined,
    endDate: filterEndDate ? new Date(filterEndDate).toISOString() : undefined,
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
      filterCorrelationId,
      filterEntityId,
      filterStartDate,
      filterEndDate,
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

  const events = logsData?.events || [];

  return (
    <AppShell>
      <div className="w-full max-w-[1200px] space-y-6">
        {/* Header: Clean luxury design system */}
        <header className="flex flex-wrap items-end justify-between gap-6 pb-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
              Governance Trail · Cryptographic Chain v1
            </p>
            <h1 className="mt-2 font-display text-[34px] sm:text-[38px] leading-[1.05] tracking-tight text-foreground flex flex-wrap items-center gap-3">
              Audit Ledger
              <span className="rounded-full border border-[var(--hairline-strong)] bg-[rgba(94,234,212,0.08)] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--brass)] font-normal">
                SHA-256 Chained
              </span>
            </h1>
            <p className="mt-1 text-xs text-muted-foreground font-sans">
              Append-only, cryptographically verified governance trail with external anchoring.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-4 py-2 text-xs md:text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 ease-out hover:-translate-y-px hover:bg-[var(--brass-strong)] disabled:opacity-50"
              title="Verify cryptographic hash chain and compare against anchor"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${verifyMutation.isPending ? "animate-spin" : ""}`} />
              <span>{verifyMutation.isPending ? "Verifying..." : "Verify Chain"}</span>
            </button>

            <button
              type="button"
              onClick={() => anchorMutation.mutate()}
              disabled={anchorMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3.5 py-2 text-xs font-semibold text-foreground transition-all duration-200 ease-out hover:-translate-y-px hover:border-[var(--brass)] hover:text-[var(--brass)] disabled:opacity-50"
              title="Create point-in-time external anchor snapshot to prevent tail-deletion"
            >
              <Anchor className="h-3.5 w-3.5 text-sky-400" />
              <span>Anchor Head</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isExporting || events.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-2 text-xs font-mono text-muted-foreground transition-all duration-200 ease-out hover:-translate-y-px hover:border-[var(--hairline-strong)] hover:text-foreground disabled:opacity-50"
              title="Export ledger as CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting || events.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-2 text-xs font-mono text-muted-foreground transition-all duration-200 ease-out hover:-translate-y-px hover:border-[var(--hairline-strong)] hover:text-foreground disabled:opacity-50"
              title="Export certificate as PDF"
            >
              <FileText className="h-3.5 w-3.5 text-rose-400" />
              <span>PDF</span>
            </button>
          </div>
        </header>

        {/* Verification Status Banner */}
        {verifyStatus && (
          <div
            className={`glass-panel p-4 flex items-center justify-between gap-4 border ${
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
                  {verifyStatus.valid ? "Cryptographic Chain Verified Valid" : "Chain Integrity Failure Detected"}
                </span>
                <span className="text-[var(--brass)]">{verifyStatus.rows_checked} links checked</span>
                <span className="text-muted-foreground">
                  Head #{verifyStatus.head_id} ({verifyStatus.head_hash?.slice(0, 12)}...)
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
          <div className="glass-panel p-4 flex items-center justify-between gap-4 border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.06)] text-xs font-mono text-[var(--risk)]">
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

        {/* Telemetry Summary Cards: matching StatCard layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Active Ledger Head"
            value={`#${events[0]?.id || 0}`}
            sub={events[0]?.row_hash ? `${events[0].row_hash.slice(0, 12)}...` : "Genesis"}
            icon={Hash}
          />
          <StatCard
            label="External Anchor Checkpoint"
            value={latestAnchor ? `#${latestAnchor.head_id}` : "None"}
            sub={latestAnchor ? `${latestAnchor.row_count} rows protected` : "Snapshot recommended"}
            icon={Anchor}
          />
          <div className="glass-panel p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">
                Tail Protection
              </p>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-[26px] font-semibold leading-none text-emerald-400 flex items-center gap-2">
                Active
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">Truncation Guard</span>
            </div>
          </div>
          <StatCard
            label="Loaded Log Records"
            value={events.length}
            sub="Cursor-paginated"
            icon={Database}
          />
        </div>

        {/* Streamlined Filter Toolbar */}
        <div className="glass-panel p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-foreground">
            <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              <Filter className="h-3.5 w-3.5 text-[var(--brass)]" />
              Ledger Filters
            </span>
            {(filterAction !== "all" ||
              filterEntityType !== "all" ||
              filterCorrelationId ||
              filterEntityId ||
              filterStartDate ||
              filterEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setFilterAction("all");
                  setFilterEntityType("all");
                  setFilterCorrelationId("");
                  setFilterEntityId("");
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setActiveCursor(undefined);
                }}
                className="font-mono text-[10px] uppercase tracking-wider text-[var(--brass)] hover:underline"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Action Filter */}
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Action Type
              </label>
              <select
                value={filterAction}
                onChange={(e) => {
                  setFilterAction(e.target.value);
                  setActiveCursor(undefined);
                }}
                className="w-full rounded-full bg-[var(--surface-glass)] border border-[var(--hairline)] px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-[var(--brass)] transition-colors"
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
                  <option value="review.marked_stale">review.marked_stale</option>
                </optgroup>
                <optgroup label="Contracts & Clauses">
                  <option value="contract.uploaded">contract.uploaded</option>
                  <option value="contract.parsed">contract.parsed</option>
                  <option value="contract.deleted">contract.deleted</option>
                  <option value="clause.edited">clause.edited</option>
                </optgroup>
                <optgroup label="Artifacts & Exports">
                  <option value="action_plan.exported_pdf">action_plan.exported_pdf</option>
                  <option value="artifact.exported">artifact.exported</option>
                  <option value="audit.exported">audit.exported</option>
                  <option value="audit.verified">audit.verified</option>
                </optgroup>
                <optgroup label="Governance & Workspace">
                  <option value="workspace.deletion_requested">workspace.deletion_requested</option>
                  <option value="workspace.deletion_cancelled">workspace.deletion_cancelled</option>
                  <option value="policy.updated">policy.updated</option>
                  <option value="auth.login">auth.login</option>
                </optgroup>
              </select>
            </div>

            {/* Entity Type Filter */}
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Entity Type
              </label>
              <select
                value={filterEntityType}
                onChange={(e) => {
                  setFilterEntityType(e.target.value);
                  setActiveCursor(undefined);
                }}
                className="w-full rounded-full bg-[var(--surface-glass)] border border-[var(--hairline)] px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-[var(--brass)] transition-colors"
              >
                <option value="all">All Entities</option>
                <option value="simulation">simulation</option>
                <option value="review_item">review_item</option>
                <option value="contract">contract</option>
                <option value="action_plan">action_plan</option>
                <option value="compliance_artifact">compliance_artifact</option>
                <option value="organization">organization</option>
                <option value="audit_log">audit_log</option>
              </select>
            </div>

            {/* Entity ID Search */}
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Entity ID
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by entity ID..."
                  value={filterEntityId}
                  onChange={(e) => {
                    setFilterEntityId(e.target.value);
                    setActiveCursor(undefined);
                  }}
                  className="w-full rounded-full bg-[var(--surface-glass)] border border-[var(--hairline)] pl-8 pr-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--brass)] transition-colors"
                />
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
              </div>
            </div>

            {/* Correlation ID Search */}
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Correlation ID
              </label>
              <input
                type="text"
                placeholder="UUID..."
                value={filterCorrelationId}
                onChange={(e) => {
                  setFilterCorrelationId(e.target.value);
                  setActiveCursor(undefined);
                }}
                className="w-full rounded-full bg-[var(--surface-glass)] border border-[var(--hairline)] px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--brass)] transition-colors"
              >
              </input>
            </div>
          </div>
        </div>

        {/* Ledger Table: matching clean liquid-glass styling */}
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface-raised)] border-b border-[var(--hairline)] text-muted-foreground font-mono text-[9.5px] uppercase tracking-[0.18em]">
                <tr>
                  <th className="py-3 px-4 w-16">ID</th>
                  <th className="py-3 px-4 w-44">Timestamp (UTC)</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4 w-32">Correlation</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hairline)] font-sans">
                {logsLoading && events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground font-mono text-xs">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[var(--brass)]" />
                      Loading tamper-evident ledger...
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground font-mono text-xs">
                      No audit events match the specified filters.
                    </td>
                  </tr>
                ) : (
                  events.map((evt) => (
                    <tr
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className="hover:bg-[rgba(255,255,255,0.03)] cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-[var(--brass)]">
                        #{evt.id}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                          <span>{formatTimestamp(evt.created_at)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <ActionBadge action={evt.action} />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">{evt.entity_type}</span>
                          <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[140px]">
                            {evt.entity_id}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs">
                          <User className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {evt.actor_label || evt.actor_id || "System Engine"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-[11px] whitespace-nowrap">
                        {evt.correlation_id ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterCorrelationId(evt.correlation_id || "");
                            }}
                            className="text-[var(--brass)] hover:underline cursor-pointer"
                            title={`Filter by correlation ${evt.correlation_id}`}
                          >
                            {evt.correlation_id.slice(0, 8)}...
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground group-hover:text-[var(--brass)] transition-colors">
                          Inspect
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Cursor Pagination Footer */}
          {logsData?.nextCursor && (
            <div className="p-4 border-t border-[var(--hairline)] bg-[var(--surface-raised)] flex justify-center">
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
        </div>

        {/* Detail Inspection Drawer: matching EvidenceDrawer / ReviewDetail layout */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-2xl bg-[var(--shell-bg)] border-l border-[var(--hairline)] h-full overflow-y-auto shadow-2xl p-6 space-y-6 animate-in slide-in-from-right duration-200">
              <div className="flex items-start justify-between border-b border-[var(--hairline)] pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-foreground font-mono">
                      Event #{selectedEvent.id}
                    </span>
                    <ActionBadge action={selectedEvent.action} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    Created: {formatTimestamp(selectedEvent.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cryptographic Chain Box */}
              <div className="glass-panel p-4 space-y-2 border border-emerald-500/20">
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  Cryptographic Chaining Details
                </div>
                <div className="text-[11px] font-mono space-y-2 text-foreground/90 mt-2">
                  <div className="flex justify-between py-1 border-b border-[var(--hairline)]">
                    <span className="text-muted-foreground">Hash Version:</span>
                    <span className="text-[var(--brass)] font-semibold">v{selectedEvent.hash_version}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 py-1 border-b border-[var(--hairline)]">
                    <span className="text-muted-foreground">Previous Hash (prev_hash):</span>
                    <span className="text-muted-foreground/80 break-all select-all text-[10px]">
                      {selectedEvent.prev_hash}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 py-1">
                    <span className="text-muted-foreground">Row Hash (SHA-256 digest):</span>
                    <span className="text-[var(--brass)] font-semibold break-all select-all text-[10px]">
                      {selectedEvent.row_hash}
                    </span>
                  </div>
                </div>
              </div>

              {/* Event Attributes */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="glass-panel p-3">
                  <span className="text-muted-foreground block font-mono text-[10px] uppercase tracking-wider">
                    Entity Type & ID
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block truncate">
                    {selectedEvent.entity_type} : {selectedEvent.entity_id}
                  </span>
                </div>
                <div className="glass-panel p-3">
                  <span className="text-muted-foreground block font-mono text-[10px] uppercase tracking-wider">
                    Actor & Role
                  </span>
                  <span className="font-semibold text-foreground mt-0.5 block truncate">
                    {selectedEvent.actor_label || selectedEvent.actor_id || "System"} ({selectedEvent.actor_role})
                  </span>
                </div>
                {selectedEvent.correlation_id && (
                  <div className="col-span-2 glass-panel p-3 font-mono text-[11px]">
                    <span className="text-muted-foreground block font-mono text-[10px] uppercase tracking-wider font-sans">
                      Correlation ID
                    </span>
                    <span className="text-[var(--brass)] break-all">{selectedEvent.correlation_id}</span>
                  </div>
                )}
              </div>

              {/* Redacted Payloads */}
              <div className="space-y-4 text-xs">
                {selectedEvent.basis && (
                  <div>
                    <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
                      <span>Decision Basis (Why)</span>
                      <span className="text-[9px] text-[var(--brass)]">redacted at write-time</span>
                    </h4>
                    <pre className="glass-panel p-3 text-foreground/90 font-mono text-[11px] overflow-x-auto max-h-48">
                      {JSON.stringify(selectedEvent.basis, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedEvent.before && (
                  <div>
                    <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      Before Snapshot
                    </h4>
                    <pre className="glass-panel p-3 text-foreground/90 font-mono text-[11px] overflow-x-auto max-h-48">
                      {JSON.stringify(selectedEvent.before, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedEvent.after && (
                  <div>
                    <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      After Snapshot / Diff
                    </h4>
                    <pre className="glass-panel p-3 text-foreground/90 font-mono text-[11px] overflow-x-auto max-h-48">
                      {JSON.stringify(selectedEvent.after, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <h4 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                    Metadata & Attribution
                  </h4>
                  <pre className="glass-panel p-3 text-muted-foreground font-mono text-[11px] overflow-x-auto max-h-48">
                    {JSON.stringify(selectedEvent.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
