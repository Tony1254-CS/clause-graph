import { useState, useTransition } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  History,
  ShieldCheck,
  ShieldAlert,
  Download,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  ExternalLink,
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
          `Latest Verified Anchor: #${latestAnchor.head_id} (${latestAnchor.row_count} rows, anchored ${latestAnchor.anchored_at})`,
          14,
          46
        );
      }

      doc.setDrawColor(200);
      doc.line(14, 52, 196, 52);

      let y = 60;
      doc.setFontSize(9);
      doc.setTextColor(0);

      events.slice(0, 30).forEach((evt, idx) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.text(`#${evt.id} [${evt.action}]`, 14, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`${evt.created_at} | Actor: ${evt.actor_label || evt.actor_id || "system"}`, 80, y);
        doc.setTextColor(0);

        y += 5;
        doc.text(`Entity: ${evt.entity_type} (${evt.entity_id}) | Hash: ${evt.row_hash.slice(0, 16)}...`, 14, y);
        y += 8;
      });

      if (events.length > 30) {
        doc.setTextColor(120);
        doc.text(`... and ${events.length - 30} additional records truncated from PDF preview. Use CSV for full export.`, 14, y);
      }

      doc.save(`clausegraph-audit-report-${Date.now()}.pdf`);
    } catch (err: any) {
      console.error("PDF export error:", err);
      alert(`PDF export failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.startsWith("auth.")) return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (action.startsWith("simulation.")) return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (action.startsWith("review.")) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    if (action.startsWith("audit.")) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (action.startsWith("contract.")) return "bg-sky-500/10 text-sky-400 border-sky-500/20";
    if (action.startsWith("workspace.")) return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    return "bg-slate-500/10 text-slate-300 border-slate-500/20";
  };

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6">
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-8 text-center backdrop-blur-sm">
            <ShieldAlert className="w-12 h-12 text-rose-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-rose-200">Access Restricted</h2>
            <p className="mt-2 text-sm text-slate-300 max-w-lg mx-auto">
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
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Header & Verification Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Tamper-Evident Audit Ledger
                  <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    SHA-256 Chained
                  </span>
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">
                  Append-only, cryptographically verified governance trail with external anchoring.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50"
              title="Verify cryptographic hash chain and compare against anchor"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifyMutation.isPending ? "animate-spin" : ""}`} />
              {verifyMutation.isPending ? "Verifying..." : "Verify Chain"}
            </button>

            <button
              onClick={() => anchorMutation.mutate()}
              disabled={anchorMutation.isPending}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 shadow-sm transition-all disabled:opacity-50"
              title="Create point-in-time external anchor snapshot to prevent tail-deletion"
            >
              <Anchor className="w-3.5 h-3.5 text-sky-400" />
              Anchor Head
            </button>

            <button
              onClick={handleExportCsv}
              disabled={isExporting || events.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 transition-all disabled:opacity-50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              CSV
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isExporting || events.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/80 transition-all disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" />
              PDF
            </button>
          </div>
        </div>

        {/* Verification Status Card */}
        {verifyStatus && (
          <div
            className={`p-4 rounded-xl border backdrop-blur-md transition-all ${
              verifyStatus.valid
                ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-200"
                : "bg-rose-950/30 border-rose-500/40 text-rose-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {verifyStatus.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">
                      {verifyStatus.valid
                        ? "Cryptographic Chain Verified Valid"
                        : "Audit Chain Integrity Failure Detected"}
                    </span>
                    {verifyStatus.anchored && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        Tail Intact (Anchored)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">
                    Checked {verifyStatus.rows_checked} event links from genesis. Live chain head: #
                    {verifyStatus.head_id} (
                    <span className="font-mono">{verifyStatus.head_hash?.slice(0, 16)}...</span>)
                  </p>
                  {verifyStatus.error && (
                    <p className="text-xs font-mono text-rose-300 bg-rose-900/40 p-2 rounded mt-2">
                      Error: {verifyStatus.error}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setVerifyStatus(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {verifyError && (
          <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{verifyError}</span>
            </div>
            <button onClick={() => setVerifyError(null)} className="text-slate-400 hover:text-slate-200">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Anchor Telemetry Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Active Ledger Head</span>
              <Hash className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              #{events[0]?.id || 0}
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-1">
              {events[0]?.row_hash ? `${events[0].row_hash.slice(0, 20)}...` : "Genesis"}
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>External Anchor Checkpoint</span>
              <Anchor className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {latestAnchor ? `#${latestAnchor.head_id}` : "Not Anchored"}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {latestAnchor ? `${latestAnchor.row_count} rows protected` : "Snapshot recommended"}
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Tail-Deletion Protection</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-emerald-400 flex items-center gap-1.5">
              <span>Active</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Guarded against root row-truncation
            </div>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Loaded Log Records</span>
              <Database className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-lg font-bold text-white">
              {events.length}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Cursor-paginated view
            </div>
          </div>
        </div>

        {/* Multi-attribute Filter Toolbar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              Ledger Filters
            </span>
            {(filterAction !== "all" ||
              filterEntityType !== "all" ||
              filterCorrelationId ||
              filterEntityId ||
              filterStartDate ||
              filterEndDate) && (
              <button
                onClick={() => {
                  setFilterAction("all");
                  setFilterEntityType("all");
                  setFilterCorrelationId("");
                  setFilterEntityId("");
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setActiveCursor(undefined);
                }}
                className="text-[11px] text-sky-400 hover:text-sky-300"
              >
                Clear all filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Action Filter */}
            <div>
              <label className="block text-slate-400 mb-1">Action Type</label>
              <select
                value={filterAction}
                onChange={(e) => {
                  setFilterAction(e.target.value);
                  setActiveCursor(undefined);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-slate-700"
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
              <label className="block text-slate-400 mb-1">Entity Type</label>
              <select
                value={filterEntityType}
                onChange={(e) => {
                  setFilterEntityType(e.target.value);
                  setActiveCursor(undefined);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-slate-700"
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
              <label className="block text-slate-400 mb-1">Entity ID (e.g. Contract ID)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter by entity ID..."
                  value={filterEntityId}
                  onChange={(e) => {
                    setFilterEntityId(e.target.value);
                    setActiveCursor(undefined);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 font-mono text-[11px]"
                />
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
              </div>
            </div>

            {/* Correlation ID Search */}
            <div>
              <label className="block text-slate-400 mb-1">Correlation ID</label>
              <input
                type="text"
                placeholder="Incident Correlation UUID..."
                value={filterCorrelationId}
                onChange={(e) => {
                  setFilterCorrelationId(e.target.value);
                  setActiveCursor(undefined);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-700 font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* Timeline Table */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
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
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {logsLoading && events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-500" />
                      Loading tamper-evident ledger...
                    </td>
                  </tr>
                ) : events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No audit events match the specified filters.
                    </td>
                  </tr>
                ) : (
                  events.map((evt) => (
                    <tr
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-400">
                        #{evt.id}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                          <span>{formatTimestamp(evt.created_at)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border ${getActionBadgeColor(
                            evt.action
                          )}`}
                        >
                          {evt.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-200">{evt.entity_type}</span>
                          <span className="text-[11px] text-slate-400 font-mono truncate max-w-[140px]">
                            {evt.entity_id}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[140px]">
                            {evt.actor_label || evt.actor_id || "System Engine"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {evt.correlation_id ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterCorrelationId(evt.correlation_id || "");
                            }}
                            className="text-sky-400 hover:underline cursor-pointer"
                            title={`Filter by correlation ${evt.correlation_id}`}
                          >
                            {evt.correlation_id.slice(0, 8)}...
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-sky-400 transition-colors">
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
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex justify-center">
              <button
                onClick={() => setActiveCursor(logsData.nextCursor || undefined)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all shadow-sm"
              >
                <ArrowDownCircle className="w-4 h-4 text-sky-400" />
                Load Older Records (Before #{logsData.nextCursor})
              </button>
            </div>
          )}
        </div>

        {/* Detail Inspection Drawer */}
        {selectedEvent && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto shadow-2xl p-6 space-y-6 animate-in slide-in-from-right duration-200">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white font-mono">
                      Event #{selectedEvent.id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border ${getActionBadgeColor(
                        selectedEvent.action
                      )}`}
                    >
                      {selectedEvent.action}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 font-mono">
                    Created: {formatTimestamp(selectedEvent.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cryptographic Chain Box */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-2">
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Cryptographic Chaining Details
                </div>
                <div className="text-[11px] font-mono space-y-1.5 text-slate-300">
                  <div className="flex justify-between py-1 border-b border-slate-900">
                    <span className="text-slate-500">Hash Version:</span>
                    <span>v{selectedEvent.hash_version}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 py-1 border-b border-slate-900">
                    <span className="text-slate-500">Previous Hash (prev_hash):</span>
                    <span className="text-slate-400 break-all select-all">{selectedEvent.prev_hash}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 py-1">
                    <span className="text-slate-500">Row Hash (SHA-256 digest):</span>
                    <span className="text-emerald-400 font-semibold break-all select-all">
                      {selectedEvent.row_hash}
                    </span>
                  </div>
                </div>
              </div>

              {/* Event Attributes */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
                  <span className="text-slate-400 block text-[11px]">Entity Type & ID</span>
                  <span className="font-semibold text-slate-200 mt-0.5 block truncate">
                    {selectedEvent.entity_type} : {selectedEvent.entity_id}
                  </span>
                </div>
                <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
                  <span className="text-slate-400 block text-[11px]">Actor & Role</span>
                  <span className="font-semibold text-slate-200 mt-0.5 block truncate">
                    {selectedEvent.actor_label || selectedEvent.actor_id || "System"} ({selectedEvent.actor_role})
                  </span>
                </div>
                {selectedEvent.correlation_id && (
                  <div className="col-span-2 bg-slate-950/60 p-3 rounded-lg border border-slate-800/60 font-mono text-[11px]">
                    <span className="text-slate-400 block text-[11px] font-sans">Correlation ID</span>
                    <span className="text-sky-400 break-all">{selectedEvent.correlation_id}</span>
                  </div>
                )}
              </div>

              {/* Redacted Payloads */}
              <div className="space-y-4 text-xs">
                {selectedEvent.basis && (
                  <div>
                    <h4 className="font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <span>Decision Basis (Why)</span>
                      <span className="text-[10px] text-slate-500 font-mono font-normal">redacted at write-time</span>
                    </h4>
                    <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-slate-300 font-mono text-[11px] overflow-x-auto max-h-48">
                      {JSON.stringify(selectedEvent.basis, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedEvent.before && (
                  <div>
                    <h4 className="font-semibold text-slate-300 mb-1.5">Before Snapshot</h4>
                    <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-slate-300 font-mono text-[11px] overflow-x-auto max-h-48">
                      {JSON.stringify(selectedEvent.before, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedEvent.after && (
                  <div>
                    <h4 className="font-semibold text-slate-300 mb-1.5">After Snapshot / Diff</h4>
                    <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-slate-300 font-mono text-[11px] overflow-x-auto max-h-48">
                      {JSON.stringify(selectedEvent.after, null, 2)}
                    </pre>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold text-slate-300 mb-1.5">Metadata & Attribution</h4>
                  <pre className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-slate-400 font-mono text-[11px] overflow-x-auto max-h-48">
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
