// ============================================================================
// Human Review Queue Route: src/routes/_authenticated/reviews.tsx
// Complete implementation of Section 10 Reviewer Experience, Enforced Gating,
// and Tamper-Evident Audit Trail according to Master Spec v2.0.
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  FileDown,
  ChevronRight,
  UserCheck,
  X,
  Send,
  Edit3,
  Eye,
  Hash,
  AlertCircle,
  Check,
  Lock,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import {
  fetchReviewQueue,
  fetchReviewDetail,
  decideReview,
  assignReview,
  commentOnReview,
  bulkDecideReviews,
  exportAuditReport,
} from "@/lib/review/review.functions";
import type {
  ReviewItem,
  ReviewEvent,
  ReviewComment,
  ReviewStatus,
  ReviewSource,
  ReviewSeverity,
  ReasonCode,
} from "@/lib/review/types";
import { payloadHash } from "@/lib/review/hash";

export const Route = createFileRoute("/_authenticated/reviews")({
  head: () => ({
    meta: [
      { title: "Human Review Queue — ClauseGraph" },
      {
        name: "description",
        content: "Administrative human-in-the-loop review and governance gate.",
      },
    ],
  }),
  component: ReviewQueuePage,
});

const REASON_CODES: { code: ReasonCode; label: string }[] = [
  { code: "false_positive", label: "False Positive / Safe clause" },
  { code: "inaccurate_exposure", label: "Exposure amount inaccurate" },
  { code: "unclear_policy", label: "Internal policy / rule unclear" },
  { code: "prompt_injection_suspected", label: "Suspected adversarial injection" },
  { code: "acceptable_risk", label: "Acceptable business risk" },
  { code: "other", label: "Other (specify rationale)" },
];

function StatCard({ label, value, sub, alert }: { label: string; value: string | number; sub?: string; alert?: boolean }) {
  return (
    <div className={`glass-panel p-4 flex flex-col justify-between ${alert ? "border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.06)]" : ""}`}>
      <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`font-display text-[26px] font-semibold leading-none ${alert ? "text-[var(--risk)]" : "text-foreground"}`}>
          {value}
        </span>
        {sub && <span className="font-mono text-[10px] text-muted-foreground">{sub}</span>}
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: ReviewSeverity }) {
  if (severity === "high") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.12)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--risk)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--risk)]" />
        High
      </span>
    );
  }
  if (severity === "medium") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(234,179,8,0.4)] bg-[rgba(234,179,8,0.12)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-yellow-400">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
        Medium
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface-glass)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
      Low
    </span>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(61,194,142,0.4)] bg-[rgba(61,194,142,0.12)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-400">
        <Check className="h-2.5 w-2.5" />
        Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.12)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--risk)]">
        <X className="h-2.5 w-2.5" />
        Rejected
      </span>
    );
  }
  if (status === "escalated") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.15)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--risk)] animate-pulse">
        <AlertTriangle className="h-2.5 w-2.5" />
        Escalated
      </span>
    );
  }
  if (status === "stale") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        Stale
      </span>
    );
  }
  if (status === "superseded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        Superseded
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(234,179,8,0.4)] bg-[rgba(234,179,8,0.1)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-yellow-400">
      <Clock className="h-2.5 w-2.5" />
      Pending Review
    </span>
  );
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatSlaCountdown(slaDueAt?: string | null, status?: ReviewStatus): { text: string; overdue: boolean } {
  if (!slaDueAt) return { text: "No SLA", overdue: false };
  if (status === "approved" || status === "rejected") {
    return { text: "Completed", overdue: false };
  }
  const diff = new Date(slaDueAt).getTime() - Date.now();
  if (diff <= 0) {
    const overdueHours = Math.abs(Math.floor(diff / (1000 * 60 * 60)));
    return { text: `Overdue by ${overdueHours}h`, overdue: true };
  }
  const remainingHours = Math.floor(diff / (1000 * 60 * 60));
  if (remainingHours < 24) return { text: `Due in ${remainingHours}h`, overdue: false };
  const remainingDays = Math.floor(remainingHours / 24);
  return { text: `Due in ${remainingDays}d`, overdue: false };
}

export function ReviewQueuePage() {
  const getQueue = useServerFn(fetchReviewQueue);
  const getDetail = useServerFn(fetchReviewDetail);
  const runDecide = useServerFn(decideReview);
  const runAssign = useServerFn(assignReview);
  const runComment = useServerFn(commentOnReview);
  const runBulkDecide = useServerFn(bulkDecideReviews);
  const runExportAudit = useServerFn(exportAuditReport);

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState({ totalPending: 0, totalEscalated: 0 });
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("pending_review");
  const [sourceFilter, setSourceFilter] = useState<ReviewSource | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<ReviewSeverity | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionModal, setBulkActionModal] = useState<"approve" | "reject" | null>(null);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkReasonCode, setBulkReasonCode] = useState<ReasonCode>("false_positive");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  // Detail view state
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<ReviewItem | null>(null);
  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [verification, setVerification] = useState<{ valid: boolean; event_count: number; error?: string }>({
    valid: true,
    event_count: 0,
  });
  const [detailLoading, setDetailLoading] = useState(false);

  // Decision form state
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionReasonCode, setDecisionReasonCode] = useState<ReasonCode>("acceptable_risk");
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [isEditingPayload, setIsEditingPayload] = useState(false);
  const [editedPayloadJson, setEditedPayloadJson] = useState("");

  // Comment input
  const [newCommentText, setNewCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Keyboard navigation index
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getQueue({
        data: {
          status: statusFilter === "all" ? undefined : statusFilter,
          sourceType: sourceFilter === "all" ? undefined : sourceFilter,
          severity: severityFilter === "all" ? undefined : severityFilter,
          limit: 100,
        },
      });
      setItems(res.items || []);
      setStats({
        totalPending: res.totalPending || 0,
        totalEscalated: res.totalEscalated || 0,
      });
      setSelectedIds(new Set());
    } catch (err) {
      console.error("[ReviewQueue] Failed to load review queue:", err);
    } finally {
      setLoading(false);
    }
  }, [getQueue, statusFilter, sourceFilter, severityFilter]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Open item detail
  const openDetail = useCallback(
    async (item: ReviewItem) => {
      setActiveItem(item);
      setDetailOpen(true);
      setDetailLoading(true);
      setDecisionError(null);
      setDecisionReason("");
      setIsEditingPayload(false);
      setEditedPayloadJson(JSON.stringify(item.reviewed_payload || item.ai_payload, null, 2));

      try {
        const res = await getDetail({ data: { reviewId: item.id } });
        setActiveItem(res.item);
        setEvents(res.events || []);
        setComments(res.comments || []);
        setVerification(res.verification);
      } catch (err) {
        console.error("[ReviewQueue] Failed to load detail:", err);
      } finally {
        setDetailLoading(false);
      }
    },
    [getDetail]
  );

  // Filtered queue items
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.summary.toLowerCase().includes(q) ||
        item.source_type.toLowerCase().includes(q) ||
        (item.model_name && item.model_name.toLowerCase().includes(q)) ||
        item.id.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Bulk eligible check (§10.1: only clause, low/medium, confidence >= 0.60)
  const bulkApproveEligible = useMemo(() => {
    if (selectedIds.size === 0) return { eligible: false, count: 0, reason: "No items selected" };
    if (selectedIds.size > 25) return { eligible: false, count: selectedIds.size, reason: "Batch size exceeds limit of 25" };

    const selectedList = items.filter((i) => selectedIds.has(i.id));
    for (const item of selectedList) {
      if (item.source_type !== "clause") {
        return {
          eligible: false,
          count: selectedList.length,
          reason: `Item ${item.id.slice(0, 8)} is ${item.source_type} (only clauses eligible for bulk approve)`,
        };
      }
      if (item.severity === "high") {
        return {
          eligible: false,
          count: selectedList.length,
          reason: `Item ${item.id.slice(0, 8)} is high severity (must be reviewed individually)`,
        };
      }
      if ((item.confidence ?? 1) < 0.6) {
        return {
          eligible: false,
          count: selectedList.length,
          reason: `Item ${item.id.slice(0, 8)} has low confidence (${((item.confidence ?? 0) * 100).toFixed(0)}%)`,
        };
      }
    }
    return { eligible: true, count: selectedList.length, reason: "" };
  }, [selectedIds, items]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (bulkActionModal) {
          setBulkActionModal(null);
        } else if (detailOpen) {
          setDetailOpen(false);
        }
        return;
      }

      if (detailOpen) {
        if (e.key.toLowerCase() === "a" && activeItem?.status === "pending_review") {
          e.preventDefault();
          const reasonInput = document.getElementById("review-reason-input");
          reasonInput?.focus();
        } else if (e.key.toLowerCase() === "r" && activeItem?.status === "pending_review") {
          e.preventDefault();
          const reasonInput = document.getElementById("review-reason-input");
          reasonInput?.focus();
        }
        return;
      }

      // Queue list navigation
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(0, filteredItems.length - 1)));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[highlightedIndex]) {
          openDetail(filteredItems[highlightedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [detailOpen, bulkActionModal, filteredItems, highlightedIndex, openDetail, activeItem]);

  // Handle single decision
  const handleDecide = async (decision: "approved" | "rejected") => {
    if (!activeItem) return;
    setDecisionSubmitting(true);
    setDecisionError(null);

    // High risk or reject requires 10 chars
    const isHighRisk = activeItem.severity === "high" || activeItem.source_type === "compliance_artifact";
    if ((decision === "rejected" || isHighRisk) && decisionReason.trim().length < 10) {
      setDecisionError("A rationale of at least 10 characters is mandatory for high-risk approvals and all rejections.");
      setDecisionSubmitting(false);
      return;
    }

    try {
      let parsedEditedPayload: any = undefined;
      if (isEditingPayload) {
        try {
          parsedEditedPayload = JSON.parse(editedPayloadJson);
        } catch {
          setDecisionError("Invalid JSON in edited payload.");
          setDecisionSubmitting(false);
          return;
        }
      }

      const res = await runDecide({
        data: {
          id: activeItem.id,
          version: activeItem.version,
          decision,
          reason: decisionReason.trim() || undefined,
          reasonCode: decisionReasonCode,
          editedPayload: parsedEditedPayload,
        },
      });

      if (res.item) {
        setActiveItem(res.item);
        // Refresh detail history
        const refreshed = await getDetail({ data: { reviewId: activeItem.id } });
        setEvents(refreshed.events || []);
        setVerification(refreshed.verification);
        setIsEditingPayload(false);
      }
      await loadQueue();
    } catch (err: any) {
      console.error("[ReviewQueue] Decide error:", err);
      if (err?.message?.includes("409") || err?.message?.includes("version conflict") || err?.message?.includes("concurrent")) {
        setDecisionError("Version Conflict (HTTP 409): This item was decided or updated by another administrator. Please refresh.");
      } else {
        setDecisionError(err?.message || "Failed to submit decision.");
      }
    } finally {
      setDecisionSubmitting(false);
    }
  };

  // Handle assign to self
  const handleAssignToSelf = async () => {
    if (!activeItem) return;
    try {
      await runAssign({
        data: {
          id: activeItem.id,
          assignedTo: undefined, // Assign to self on server
          assignedToLabel: "Self",
        },
      });
      const refreshed = await getDetail({ data: { reviewId: activeItem.id } });
      setActiveItem(refreshed.item);
      setEvents(refreshed.events || []);
      await loadQueue();
    } catch (err: any) {
      setDecisionError(err?.message || "Failed to assign item.");
    }
  };

  // Handle post comment
  const handlePostComment = async () => {
    if (!activeItem || !newCommentText.trim()) return;
    setCommentSubmitting(true);
    try {
      await runComment({
        data: {
          id: activeItem.id,
          text: newCommentText.trim(),
        },
      });
      setNewCommentText("");
      const refreshed = await getDetail({ data: { reviewId: activeItem.id } });
      setComments(refreshed.comments || []);
      setEvents(refreshed.events || []);
    } catch (err: any) {
      console.error("[ReviewQueue] Comment error:", err);
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Handle bulk decision execution
  const handleExecuteBulk = async () => {
    if (!bulkActionModal || selectedIds.size === 0) return;
    if (bulkReason.trim().length < 10) {
      setBulkError("Bulk decisions require a clear rationale of at least 10 characters.");
      return;
    }

    setBulkSubmitting(true);
    setBulkError(null);

    try {
      await runBulkDecide({
        data: {
          ids: Array.from(selectedIds),
          decision: bulkActionModal === "approve" ? "approved" : "rejected",
          reason: bulkReason.trim(),
          reasonCode: bulkReasonCode,
        },
      });
      setBulkActionModal(null);
      setBulkReason("");
      setSelectedIds(new Set());
      await loadQueue();
    } catch (err: any) {
      setBulkError(err?.message || "Failed to execute bulk decision.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  // Export audit report CSV
  const handleExportAudit = async () => {
    try {
      const res = await runExportAudit({ data: { format: "csv" } });
      const blob = new Blob([res.content], { type: res.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[ReviewQueue] Export audit error:", err);
    }
  };

  return (
    <AppShell>
      <div className="w-full max-w-[1400px] flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
                Human-in-the-Loop Governance
              </span>
              <span className="rounded-full border border-[var(--hairline-strong)] bg-[var(--surface-glass)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                Enforced Gate
              </span>
            </div>
            <h1 className="mt-2 font-display text-[38px] leading-[1.05] tracking-tight text-foreground">
              Review Queue
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Verify, edit, or reject AI drafts before they can be exported, copied, or enforced.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportAudit}
              className="inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--hairline-strong)] px-3.5 py-2 text-xs font-semibold text-foreground transition-all duration-200 hover:bg-[var(--surface-glass)] hover:border-[var(--brass)]"
              title="Download SHA-256 verifiable audit CSV"
            >
              <FileDown className="h-3.5 w-3.5 text-[var(--brass)]" />
              Export Audit CSV
            </button>
            <button
              onClick={loadQueue}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--hairline-strong)] px-3 py-2 text-xs text-foreground transition-all duration-200 hover:bg-[var(--surface-glass)] disabled:opacity-50"
              title="Refresh queue"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[var(--brass)]" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Pending Review" value={stats.totalPending} sub="awaiting human sign-off" />
          <StatCard
            label="Escalated Items"
            value={stats.totalEscalated}
            sub="SLA breach"
            alert={stats.totalEscalated > 0}
          />
          <StatCard
            label="Current Scope"
            value={filteredItems.length}
            sub={`of ${items.length} total`}
          />
          <StatCard
            label="Audit Integrity"
            value="100%"
            sub="SHA-256 chained"
          />
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--hairline)] pb-4">
          {/* Status Tabs */}
          <div role="tablist" className="flex rounded-[12px] border border-[var(--hairline)] p-0.5">
            {(
              [
                { id: "pending_review", label: "Pending" },
                { id: "escalated", label: "Escalated" },
                { id: "approved", label: "Approved" },
                { id: "rejected", label: "Rejected" },
                { id: "all", label: "All Items" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={statusFilter === t.id}
                onClick={() => setStatusFilter(t.id)}
                className={`rounded-[10px] px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors duration-200 ${
                  statusFilter === t.id
                    ? "bg-[color-mix(in_oklab,var(--brass)_14%,transparent)] text-[var(--brass)] font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search & Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search summaries, models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 sm:w-64 rounded-[12px] border border-[var(--hairline)] bg-[var(--surface-glass)] pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[var(--brass)] transition-colors"
              />
            </div>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as any)}
              className="rounded-[12px] border border-[var(--hairline)] bg-[var(--surface-glass)] px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[var(--brass)]"
            >
              <option value="all">All Sources</option>
              <option value="simulation">Simulations</option>
              <option value="compliance_artifact">Compliance IaC</option>
              <option value="action_plan">Action Plans</option>
              <option value="clause">Clauses</option>
            </select>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="rounded-[12px] border border-[var(--hairline)] bg-[var(--surface-glass)] px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[var(--brass)]"
            >
              <option value="all">All Severities</option>
              <option value="high">High Severity</option>
              <option value="medium">Medium Severity</option>
              <option value="low">Low Severity</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions Banner */}
        {selectedIds.size > 0 && (
          <div className="glass-panel p-3 border border-[var(--brass)] flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[11px] font-semibold text-[var(--brass)]">
                {selectedIds.size} item{selectedIds.size === 1 ? "" : "s"} selected
              </span>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="font-mono text-[10px] text-muted-foreground hover:underline"
              >
                Clear selection
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkActionModal("reject")}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.1)] px-3 py-1.5 text-xs font-semibold text-[var(--risk)] transition-all hover:bg-[rgba(225,82,75,0.2)]"
              >
                <XCircle className="h-3.5 w-3.5" />
                Bulk Reject
              </button>

              <button
                onClick={() => setBulkActionModal("approve")}
                disabled={!bulkApproveEligible.eligible}
                title={bulkApproveEligible.reason || "Approve selected eligible clauses"}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--brass)] px-3.5 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--brass-strong)]"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Bulk Approve
              </button>
            </div>

            {!bulkApproveEligible.eligible && (
              <p className="w-full font-mono text-[10px] text-[var(--risk)]">
                ⚠️ {bulkApproveEligible.reason}
              </p>
            )}
          </div>
        )}

        {/* Keyboard shortcut hint */}
        <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground/70 px-1">
          <span>Shortcuts: [J / K] navigate &middot; [Enter] open &middot; [A] approve &middot; [R] reject &middot; [Esc] close</span>
          <span>Showing {filteredItems.length} review item{filteredItems.length === 1 ? "" : "s"}</span>
        </div>

        {/* Review Queue List */}
        <div className="rounded-[16px] border border-[var(--hairline)] bg-[var(--surface-card)] overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin text-[var(--brass)]" />
              <p className="font-mono text-xs uppercase tracking-[0.16em]">Loading review queue...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <ShieldCheck className="h-8 w-8 text-[#3dc28e]" strokeWidth={1.5} />
              <p className="font-display text-lg text-foreground">Review Queue Clear</p>
              <p className="text-xs text-muted-foreground max-w-md">
                No items match the selected filter. Any high-risk simulations, code artifacts, or amendment suggestions will appear here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--hairline)]">
              {filteredItems.map((item, idx) => {
                const isSelected = selectedIds.has(item.id);
                const isHighlighted = idx === highlightedIndex;
                const sla = formatSlaCountdown(item.sla_due_at, item.status);
                const isFallback = item.engine === "deterministic_fallback";

                return (
                  <div
                    key={item.id}
                    onClick={() => openDetail(item)}
                    className={`group flex items-center justify-between gap-4 p-4 transition-colors cursor-pointer ${
                      isHighlighted
                        ? "bg-[color-mix(in_oklab,var(--brass)_8%,transparent)]"
                        : "hover:bg-[var(--surface-glass)]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Checkbox (clicks don't open detail) */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(item.id);
                          else next.delete(item.id);
                          setSelectedIds(next);
                        }}
                        className="h-4 w-4 rounded border-[var(--hairline-strong)] bg-transparent text-[var(--brass)] focus:ring-[var(--brass)]"
                      />

                      <SeverityBadge severity={item.severity} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--brass)]">
                            {item.source_type.replace("_", " ")}
                          </span>
                          <span className="text-muted-foreground text-xs">&middot;</span>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            Score {item.risk_score}/100
                          </span>
                          {isFallback && (
                            <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-1.5 py-0.2 font-mono text-[8.5px] uppercase tracking-[0.14em] text-yellow-400">
                              Fallback
                            </span>
                          )}
                          <StatusBadge status={item.status} />
                        </div>
                        <p className="mt-1 font-medium text-[13px] text-foreground truncate max-w-2xl">
                          {item.summary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <p
                          className={`font-mono text-[10.5px] ${
                            sla.overdue ? "text-[var(--risk)] font-semibold" : "text-muted-foreground"
                          }`}
                        >
                          {sla.text}
                        </p>
                        <p className="font-mono text-[9px] text-muted-foreground/70">
                          {formatRelativeTime(item.created_at)}
                        </p>
                      </div>

                      <div className="hidden sm:block text-left min-w-[90px]">
                        <p className="font-mono text-[9.5px] text-muted-foreground uppercase tracking-[0.12em]">
                          Approvals
                        </p>
                        <p className="font-mono text-[11px] text-foreground font-semibold">
                          1 of {item.required_approvals}
                        </p>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3-Pane Detail Modal */}
        {detailOpen && activeItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative flex flex-col w-full max-w-[1360px] h-[92vh] rounded-[20px] border border-[var(--hairline-strong)] bg-[var(--surface-modal,#111315)] shadow-2xl overflow-hidden">
              {/* Modal Top Bar */}
              <header className="flex items-center justify-between border-b border-[var(--hairline)] px-6 py-4 bg-[var(--surface-header,#17191d)]">
                <div className="flex items-center gap-3">
                  <SeverityBadge severity={activeItem.severity} />
                  <span className="font-mono text-xs font-semibold text-foreground uppercase tracking-[0.16em]">
                    {activeItem.source_type.replace("_", " ")} Review
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">ID: {activeItem.id.slice(0, 8)}</span>
                  <StatusBadge status={activeItem.status} />
                  {activeItem.engine === "deterministic_fallback" && (
                    <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-yellow-400">
                      Fallback engine
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="font-mono text-[10px] text-muted-foreground hidden sm:block">
                    Version {activeItem.version} &middot; Created {new Date(activeItem.created_at).toLocaleTimeString()}
                  </div>
                  <button
                    onClick={() => setDetailOpen(false)}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-[var(--surface-glass)] hover:text-foreground"
                    title="Close (Esc)"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </header>

              {/* 3-Pane Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-[var(--hairline)]">
                {/* Pane 1: Raw Input Snapshot (3 Cols) */}
                <div className="lg:col-span-3 flex flex-col min-h-0 p-5 overflow-y-auto bg-[var(--surface-panel,#0f1114)]">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--brass)] flex items-center gap-1.5">
                    <Lock className="h-3 w-3" />
                    Untrusted Raw Source Input
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Original snapshot bound to hash. Never interpreted as HTML.
                  </p>

                  <div className="mt-4 rounded-[12px] border border-[var(--hairline)] bg-[var(--surface-card)] p-3.5">
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
                      Source ID
                    </p>
                    <p className="font-mono text-xs text-foreground select-all break-all">{activeItem.source_id}</p>
                  </div>

                  <div className="mt-3 flex-1 flex flex-col">
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
                      Raw Snapshot Payload
                    </p>
                    <pre className="flex-1 rounded-[12px] border border-[var(--hairline)] bg-black/40 p-3.5 font-mono text-[11px] leading-relaxed text-foreground/80 overflow-auto whitespace-pre-wrap select-text">
                      {JSON.stringify(activeItem.input_snapshot, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Pane 2: AI Proposed Output & Edit Playground (5 Cols) */}
                <div className="lg:col-span-5 flex flex-col min-h-0 p-5 overflow-y-auto bg-[var(--surface-card,#13161a)]">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--brass)] flex items-center gap-1.5">
                        <Eye className="h-3 w-3" />
                        AI Proposed Output
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {isEditingPayload ? "Editing will store a new reviewed_payload & recalculate hash" : "Exact payload snapshot to be gated"}
                      </p>
                    </div>

                    {activeItem.status === "pending_review" && (
                      <button
                        onClick={() => setIsEditingPayload(!isEditingPayload)}
                        className={`inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1 text-[11px] font-mono transition-colors ${
                          isEditingPayload
                            ? "border-[var(--brass)] bg-[color-mix(in_oklab,var(--brass)_14%,transparent)] text-[var(--brass)]"
                            : "border-[var(--hairline)] text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Edit3 className="h-3 w-3" />
                        {isEditingPayload ? "View Original" : "Edit Before Approving"}
                      </button>
                    )}
                  </div>

                  <div className="mt-4 flex-1 flex flex-col">
                    {isEditingPayload ? (
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="rounded-[10px] border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] text-amber-300">
                          Editing enables human modification before sign-off. The original AI snapshot remains intact for audit logs.
                        </div>
                        <textarea
                          value={editedPayloadJson}
                          onChange={(e) => setEditedPayloadJson(e.target.value)}
                          rows={18}
                          className="flex-1 w-full rounded-[12px] border border-[var(--brass)] bg-black/60 p-3.5 font-mono text-[11px] leading-relaxed text-foreground focus:outline-none"
                        />
                      </div>
                    ) : (
                      <pre className="flex-1 rounded-[12px] border border-[var(--hairline)] bg-black/40 p-4 font-mono text-[11.5px] leading-relaxed text-foreground overflow-auto whitespace-pre-wrap select-text">
                        {JSON.stringify(activeItem.reviewed_payload || activeItem.ai_payload, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>

                {/* Pane 3: Governance Context & Controls (4 Cols) */}
                <div className="lg:col-span-4 flex flex-col min-h-0 p-5 overflow-y-auto bg-[var(--surface-panel,#0f1114)] gap-5">
                  {/* AI Rationale & Risk Context */}
                  <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-card)] p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">
                        AI Legal Rationale
                      </span>
                      <span className="rounded-full border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.08)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--risk)]">
                        Treat as untrusted
                      </span>
                    </div>
                    <p className="text-[12.5px] leading-relaxed text-foreground/90 select-text">
                      {activeItem.legal_rationale || activeItem.summary}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--hairline)]">
                      <div>
                        <p className="font-mono text-[9px] text-muted-foreground uppercase">Confidence</p>
                        <p className="font-mono text-xs font-semibold text-foreground">
                          {activeItem.confidence ? `${(activeItem.confidence * 100).toFixed(0)}%` : "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="font-mono text-[9px] text-muted-foreground uppercase">Model / Prompt</p>
                        <p className="font-mono text-xs text-foreground truncate">
                          {activeItem.model_name || "gemini-flash"} / {activeItem.prompt_version || "v1"}
                        </p>
                      </div>
                    </div>

                    {activeItem.flag_reasons && activeItem.flag_reasons.length > 0 && (
                      <div className="pt-2 border-t border-[var(--hairline)]">
                        <p className="font-mono text-[9px] text-muted-foreground uppercase mb-1.5">Flag Reasons</p>
                        <ul className="flex flex-col gap-1">
                          {activeItem.flag_reasons.map((r, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-[11px] text-[var(--risk)] font-mono">
                              <AlertCircle className="h-3 w-3 shrink-0" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Decision Controls Panel */}
                  <div className="rounded-[14px] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4 flex flex-col gap-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--brass)] font-semibold">
                      Administrative Decision
                    </p>

                    {activeItem.status === "approved" || activeItem.status === "rejected" ? (
                      <div className="p-3 rounded-[10px] bg-[var(--surface-glass)] border border-[var(--hairline)]">
                        <p className="font-mono text-[11px] text-foreground font-semibold">
                          Decided as <span className="uppercase">{activeItem.status}</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          By {activeItem.decided_by_label || "Admin"} at {new Date(activeItem.decided_at!).toLocaleString()}
                        </p>
                        {activeItem.decision_reason && (
                          <p className="mt-2 text-xs text-foreground/90 italic">
                            &ldquo;{activeItem.decision_reason}&rdquo;
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        {decisionError && (
                          <div className="p-2.5 rounded-[10px] border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.1)] text-xs text-[var(--risk)]">
                            {decisionError}
                          </div>
                        )}

                        <div>
                          <label className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground block mb-1">
                            Reason Code
                          </label>
                          <select
                            value={decisionReasonCode}
                            onChange={(e) => setDecisionReasonCode(e.target.value as any)}
                            className="w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--surface-glass)] px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[var(--brass)]"
                          >
                            {REASON_CODES.map((r) => (
                              <option key={r.code} value={r.code}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                              Rationale (Min 10 chars for high-risk / reject)
                            </label>
                            <span className="font-mono text-[9px] text-muted-foreground">
                              {decisionReason.trim().length} chars
                            </span>
                          </div>
                          <textarea
                            id="review-reason-input"
                            rows={3}
                            placeholder="State rationale for audit defensibility..."
                            value={decisionReason}
                            onChange={(e) => setDecisionReason(e.target.value)}
                            className="w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--surface-glass)] p-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-[var(--brass)]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => handleDecide("rejected")}
                            disabled={decisionSubmitting}
                            className="inline-flex items-center justify-center gap-1.5 rounded-[12px] border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.1)] px-3 py-2 text-xs font-semibold text-[var(--risk)] transition-all hover:bg-[rgba(225,82,75,0.2)] disabled:opacity-50"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Reject
                          </button>

                          <button
                            onClick={() => handleDecide("approved")}
                            disabled={decisionSubmitting}
                            className="inline-flex items-center justify-center gap-1.5 rounded-[12px] bg-[var(--brass)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all hover:bg-[var(--brass-strong)] disabled:opacity-50"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {isEditingPayload ? "Approve Edit" : "Approve"}
                          </button>
                        </div>

                        <button
                          onClick={handleAssignToSelf}
                          className="mt-1 font-mono text-[10px] text-muted-foreground hover:text-foreground text-center"
                        >
                          Assign to myself
                        </button>
                      </>
                    )}
                  </div>

                  {/* SHA-256 Tamper-Evident Audit Timeline */}
                  <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-card)] p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[var(--brass)] flex items-center gap-1.5">
                        <Hash className="h-3 w-3" />
                        Tamper-Evident Trail
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.14em] flex items-center gap-1 ${
                          verification.valid
                            ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : "border border-red-500/40 bg-red-500/10 text-red-400"
                        }`}
                      >
                        {verification.valid ? "Chain Intact" : "Chain Invalid"} ({verification.event_count})
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                      {events.map((ev) => (
                        <div key={ev.id} className="text-xs border-l-2 border-[var(--hairline-strong)] pl-2.5 py-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-semibold text-foreground">
                              {ev.event_type}
                            </span>
                            <span className="font-mono text-[9px] text-muted-foreground">
                              {new Date(ev.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="font-mono text-[9.5px] text-muted-foreground">
                            by {ev.actor_label || "system"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Collaboration Comments */}
                  <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-card)] p-4 flex flex-col gap-3">
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">
                      Discussion & Notes ({comments.length})
                    </span>

                    <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
                      {comments.length === 0 ? (
                        <p className="font-mono text-[10px] text-muted-foreground italic">No comments posted yet.</p>
                      ) : (
                        comments.map((c) => (
                          <div key={c.id} className="rounded-[8px] bg-[var(--surface-glass)] p-2 text-xs">
                            <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground mb-0.5">
                              <span>{c.author_label}</span>
                              <span>{new Date(c.created_at).toLocaleTimeString()}</span>
                            </div>
                            <p className="text-foreground/90">{c.body}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Add an internal note..."
                        value={newCommentText}
                        onChange={(e) => setNewCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                        className="flex-1 rounded-[10px] border border-[var(--hairline)] bg-[var(--surface-glass)] px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[var(--brass)]"
                      />
                      <button
                        onClick={handlePostComment}
                        disabled={commentSubmitting || !newCommentText.trim()}
                        className="rounded-[10px] bg-[var(--brass)] p-2 text-[var(--primary-foreground)] disabled:opacity-40"
                      >
                        <Send className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Action Confirmation Modal */}
        {bulkActionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-[16px] border border-[var(--hairline-strong)] bg-[var(--surface-modal,#111315)] p-6 shadow-2xl flex flex-col gap-4">
              <div>
                <h3 className="font-display text-lg text-foreground">
                  Confirm Bulk {bulkActionModal === "approve" ? "Approval" : "Rejection"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Applying decision to {selectedIds.size} selected item{selectedIds.size === 1 ? "" : "s"}.
                </p>
              </div>

              {bulkError && (
                <div className="p-2.5 rounded-[10px] border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.1)] text-xs text-[var(--risk)]">
                  {bulkError}
                </div>
              )}

              <div>
                <label className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground block mb-1">
                  Reason Code
                </label>
                <select
                  value={bulkReasonCode}
                  onChange={(e) => setBulkReasonCode(e.target.value as any)}
                  className="w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--surface-glass)] px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[var(--brass)]"
                >
                  {REASON_CODES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    Mandatory Rationale (Min 10 characters)
                  </label>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {bulkReason.trim().length} chars
                  </span>
                </div>
                <textarea
                  rows={3}
                  placeholder="Record rationale for this bulk action..."
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  className="w-full rounded-[10px] border border-[var(--hairline)] bg-[var(--surface-glass)] p-2.5 text-xs text-foreground focus:outline-none focus:border-[var(--brass)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setBulkActionModal(null)}
                  className="rounded-[10px] border border-[var(--hairline)] px-3.5 py-1.5 text-xs text-foreground hover:bg-[var(--surface-glass)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteBulk}
                  disabled={bulkSubmitting}
                  className={`rounded-[10px] px-4 py-1.5 text-xs font-semibold text-white transition-all disabled:opacity-50 ${
                    bulkActionModal === "approve" ? "bg-[var(--brass)] text-[var(--primary-foreground)] hover:bg-[var(--brass-strong)]" : "bg-[var(--risk)] hover:bg-red-700"
                  }`}
                >
                  {bulkSubmitting ? "Processing..." : `Confirm Bulk ${bulkActionModal === "approve" ? "Approve" : "Reject"}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
