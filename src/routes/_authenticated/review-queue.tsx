import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  Clock,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Filter,
  Search,
  ExternalLink,
  ChevronRight,
  User,
  Calendar,
  AlertOctagon,
  RefreshCw,
  FileText,
  CornerDownRight,
  MessageSquare,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { RouteError } from "@/components/clausegraph/RouteError";
import {
  listReviewTasksFn,
  getReviewStatsFn,
  assignReviewTaskFn,
  submitReviewDecisionFn,
} from "@/lib/review.functions";
import type {
  ReviewDecisionAction,
  ReviewQueueStats,
  ReviewRiskLevel,
  ReviewStatus,
  ReviewTask,
} from "@/lib/review.types";

export const Route = createFileRoute("/_authenticated/review-queue")({
  head: () => ({
    meta: [
      { title: "Human Review Queue — ClauseGraph" },
      {
        name: "description",
        content:
          "Human-in-the-loop compliance review queue for unverified citations, superseded acts, and critical legal flags.",
      },
    ],
  }),
  loader: async () => {
    return Promise.all([
      listReviewTasksFn({ data: { status: "ALL", limit: 50 } }),
      getReviewStatsFn(),
    ]);
  },
  component: ReviewQueuePage,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Review Queue unavailable" error={error} reset={reset} />
  ),
});

const STATUS_BADGES: Record<
  ReviewStatus,
  { label: string; badge: string; icon: typeof Clock }
> = {
  PENDING_REVIEW: {
    label: "Pending Review",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: Clock,
  },
  IN_REVIEW: {
    label: "In Review",
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    icon: User,
  },
  APPROVED: {
    label: "Approved",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    badge: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    icon: XCircle,
  },
  NEEDS_CORRECTION: {
    label: "Needs Correction",
    badge: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    icon: AlertTriangle,
  },
};

const RISK_BADGES: Record<ReviewRiskLevel, string> = {
  high: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

function ReviewQueuePage() {
  const [initialData, initialStats] = Route.useLoaderData();
  const [tasks, setTasks] = useState<ReviewTask[]>(initialData?.tasks || []);
  const [stats, setStats] = useState<ReviewQueueStats>(
    initialStats || {
      totalPending: 0,
      totalInReview: 0,
      totalApproved: 0,
      totalRejected: 0,
      totalNeedsCorrection: 0,
      highRiskCount: 0,
    }
  );

  // Filter states
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "ALL">("ALL");
  const [riskFilter, setRiskFilter] = useState<ReviewRiskLevel | "ALL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Selected task detail view
  const [selectedTask, setSelectedTask] = useState<ReviewTask | null>(
    tasks.length > 0 ? tasks[0] : null
  );

  // Decision Modal/Action states
  const [decisionAction, setDecisionAction] = useState<ReviewDecisionAction | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [proposedCorrection, setProposedCorrection] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const runList = useServerFn(listReviewTasksFn);
  const runStats = useServerFn(getReviewStatsFn);
  const runAssign = useServerFn(assignReviewTaskFn);
  const runDecision = useServerFn(submitReviewDecisionFn);

  async function refreshQueue() {
    setIsLoading(true);
    try {
      const [res, st] = await Promise.all([
        runList({
          data: {
            status: statusFilter,
            riskLevel: riskFilter,
            search: searchTerm,
            limit: 50,
          },
        }),
        runStats(),
      ]);
      setTasks(res.tasks);
      setStats(st);
      if (selectedTask) {
        const updated = res.tasks.find((t) => t.id === selectedTask.id);
        if (updated) setSelectedTask(updated);
      }
    } catch (err) {
      console.error("Failed to refresh queue:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAssign(taskId: string, assigneeId: string | null) {
    try {
      const updated = await runAssign({ data: { taskId, assigneeId } });
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      if (selectedTask?.id === updated.id) {
        setSelectedTask(updated);
      }
      const st = await runStats();
      setStats(st);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Assignment failed");
    }
  }

  async function handleDecisionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTask || !decisionAction) return;
    if (!decisionReason.trim()) {
      setDecisionError("Substantive legal justification or reason is required.");
      return;
    }

    setIsSubmittingDecision(true);
    setDecisionError(null);
    try {
      const updated = await runDecision({
        data: {
          taskId: selectedTask.id,
          action: decisionAction,
          reason: decisionReason,
          proposedCorrections: proposedCorrection || undefined,
        },
      });

      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setSelectedTask(updated);
      setDecisionAction(null);
      setDecisionReason("");
      setProposedCorrection("");

      const st = await runStats();
      setStats(st);
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "Decision submission failed");
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (riskFilter !== "ALL" && t.riskLevel !== riskFilter) return false;
      if (
        searchTerm &&
        !t.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !t.originalAiResponse.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, statusFilter, riskFilter, searchTerm]);

  return (
    <AppShell>
      <div className="w-full max-w-[1440px] mx-auto space-y-6">
        {/* Header and KPI strip */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Human-in-the-Loop Governance &middot; Consequential Review
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Compliance Review Queue
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Inspect, verify, approve, or correct AI-generated regulatory outputs flagged for unverified statutes, repealed provisions, or high-risk exposure.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2.5 flex-wrap font-mono text-xs">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2">
              <span className="block text-[10px] uppercase text-muted-foreground">Pending</span>
              <span className="text-sm font-semibold text-amber-400">{stats.totalPending}</span>
            </div>
            <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-3.5 py-2">
              <span className="block text-[10px] uppercase text-muted-foreground">In Review</span>
              <span className="text-sm font-semibold text-blue-400">{stats.totalInReview}</span>
            </div>
            <div className="rounded-xl border border-purple-500/25 bg-purple-500/10 px-3.5 py-2">
              <span className="block text-[10px] uppercase text-muted-foreground">Corrections</span>
              <span className="text-sm font-semibold text-purple-400">{stats.totalNeedsCorrection}</span>
            </div>
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2">
              <span className="block text-[10px] uppercase text-muted-foreground">High Risk</span>
              <span className="text-sm font-semibold text-rose-400">{stats.highRiskCount}</span>
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2">
              <span className="block text-[10px] uppercase text-muted-foreground">Approved</span>
              <span className="text-sm font-semibold text-emerald-400">{stats.totalApproved}</span>
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search title or text..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-white/5 bg-white/[0.04] text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--hairline-strong)] focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="NEEDS_CORRECTION">Needs Correction</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            {/* Risk Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as any)}
                className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="low">Low Risk</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={refreshQueue}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 font-mono text-xs text-foreground hover:bg-white/[0.08] transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
            Refresh Queue
          </button>
        </div>

        {/* 2-Column Split: Left = Task Queue List, Right = Active Review & Decision Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Tasks List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            {filteredTasks.length === 0 ? (
              <div className="rounded-2xl border border-[var(--hairline)] border-dashed bg-[var(--surface-raised)]/40 p-12 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3 opacity-80" />
                <h3 className="font-display text-base font-semibold text-foreground">
                  No Review Tasks Pending
                </h3>
                <p className="mt-1 text-xs max-w-xs mx-auto">
                  All automated AI responses adhere to citation rules or have already been signed off by legal review.
                </p>
              </div>
            ) : (
              filteredTasks.map((t) => {
                const isSelected = selectedTask?.id === t.id;
                const statusConf = STATUS_BADGES[t.status];
                const StatusIcon = statusConf.icon;

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTask(t)}
                    className={`cursor-pointer rounded-2xl border p-4.5 transition-all duration-200 ${
                      isSelected
                        ? "border-[var(--brass)] bg-[var(--surface-raised)] shadow-[0_4px_24px_-6px_rgba(94,234,212,0.2)]"
                        : "border-[var(--hairline)] bg-[var(--surface-raised)]/40 hover:border-white/20 hover:bg-[var(--surface-raised)]/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider ${statusConf.badge}`}
                          >
                            <StatusIcon className="h-2.5 w-2.5" />
                            {statusConf.label}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider ${
                              RISK_BADGES[t.riskLevel]
                            }`}
                          >
                            {t.riskLevel} risk
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground uppercase">
                            {t.sourceType}
                          </span>
                        </div>

                        <h3 className="mt-2 text-sm font-semibold text-foreground line-clamp-1">
                          {t.title}
                        </h3>

                        {t.description && (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                            {t.description}
                          </p>
                        )}
                      </div>

                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition-transform ${
                          isSelected ? "text-[var(--brass)] translate-x-0.5" : "text-muted-foreground"
                        }`}
                      />
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                      <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                      <span>
                        {t.assignedToName ? `Assigned: ${t.assignedToName}` : "Unassigned"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Detailed Review & Human Decision Panel (7 cols) */}
          <div className="lg:col-span-7">
            {selectedTask ? (
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-6 backdrop-blur-xl space-y-6">
                
                {/* Task Header & Quick Assignment */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[var(--hairline)]">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono border uppercase tracking-wider ${
                          STATUS_BADGES[selectedTask.status].badge
                        }`}
                      >
                        {STATUS_BADGES[selectedTask.status].label}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-mono border uppercase tracking-wider ${
                          RISK_BADGES[selectedTask.riskLevel]
                        }`}
                      >
                        {selectedTask.riskLevel} Risk
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        Trigger: {selectedTask.triggerType}
                      </span>
                    </div>

                    <h2 className="mt-3 text-lg font-display font-semibold text-foreground">
                      {selectedTask.title}
                    </h2>

                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Created {new Date(selectedTask.createdAt).toLocaleString()} by{" "}
                      {selectedTask.createdByName || "System Engine"}
                    </p>
                  </div>

                  {/* Assignment Controls */}
                  <div className="shrink-0">
                    {selectedTask.assignedTo ? (
                      <div className="text-right">
                        <span className="text-[11px] font-mono text-muted-foreground block">
                          Current Reviewer:
                        </span>
                        <span className="text-xs font-semibold text-[var(--brass)] font-mono block">
                          {selectedTask.assignedToName || selectedTask.assignedToEmail}
                        </span>
                        {selectedTask.status !== "APPROVED" && selectedTask.status !== "REJECTED" && (
                          <button
                            type="button"
                            onClick={() => handleAssign(selectedTask.id, null)}
                            className="mt-1 text-[10px] font-mono text-muted-foreground hover:underline"
                          >
                            Release Task
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAssign(selectedTask.id, selectedTask.assignedTo || null)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--brass)]/40 bg-[var(--brass)]/10 px-3.5 py-1.5 font-mono text-xs font-semibold text-[var(--brass)] hover:bg-[var(--brass)]/20 transition-all cursor-pointer"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Claim Task
                      </button>
                    )}
                  </div>
                </div>

                {/* Statutory Warnings & Trigger Reasons */}
                {selectedTask.warningsSnapshot && selectedTask.warningsSnapshot.length > 0 && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold uppercase tracking-wider">
                      <AlertOctagon className="h-4 w-4" />
                      Triggered Verification Warnings
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-rose-200/90 leading-relaxed">
                      {selectedTask.warningsSnapshot.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preserved Original AI Response Content */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                      Preserved Original AI Output
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      Immutable Audit Snapshot
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-black/40 p-4 max-h-[220px] overflow-y-auto text-xs font-mono text-foreground/90 whitespace-pre-wrap leading-relaxed">
                    {selectedTask.originalAiResponse}
                  </div>
                </div>

                {/* Subsequent Corrections (if any were submitted) */}
                {selectedTask.correctedContent && (
                  <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-purple-400 block font-bold">
                      Reviewer Corrected Output
                    </span>
                    <div className="text-xs text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed">
                      {selectedTask.correctedContent}
                    </div>
                  </div>
                )}

                {/* Decision Audit Trail History */}
                {selectedTask.decisionHistory && selectedTask.decisionHistory.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-[var(--hairline)]">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground block">
                      Prior Review Decisions ({selectedTask.decisionHistory.length})
                    </span>
                    <div className="space-y-2.5">
                      {selectedTask.decisionHistory.map((d) => (
                        <div
                          key={d.id}
                          className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px]">
                            <span className="font-semibold text-foreground">
                              {d.reviewerName || d.reviewerEmail || "Reviewer"} &middot;{" "}
                              <span className="text-[var(--brass)]">{d.action}</span>
                            </span>
                            <span>{new Date(d.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-foreground/90 leading-relaxed font-sans">
                            {d.reason}
                          </p>
                          {d.proposedCorrections && (
                            <p className="text-purple-300 font-mono text-[11px] bg-purple-950/30 p-2 rounded border border-purple-500/20">
                              Proposed: {d.proposedCorrections}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reviewer Decision Action Form (Only available if task is not in terminal state) */}
                {selectedTask.status !== "APPROVED" && selectedTask.status !== "REJECTED" ? (
                  <div className="pt-4 border-t border-[var(--hairline)] space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs uppercase tracking-wider text-foreground font-semibold">
                        Make Human Review Determination
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Actions enforce role-based access
                      </span>
                    </div>

                    {decisionAction === null ? (
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setDecisionAction("APPROVE")}
                          className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-mono text-xs font-semibold">Approve</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDecisionAction("REQUEST_CORRECTION")}
                          className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all cursor-pointer"
                        >
                          <AlertTriangle className="h-5 w-5" />
                          <span className="font-mono text-xs font-semibold">Correct</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDecisionAction("REJECT")}
                          className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer"
                        >
                          <XCircle className="h-5 w-5" />
                          <span className="font-mono text-xs font-semibold">Reject</span>
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleDecisionSubmit} className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-white/5">
                          <span className="font-mono text-xs font-semibold text-[var(--brass)] uppercase">
                            Executing Determination: {decisionAction}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setDecisionAction(null);
                              setDecisionError(null);
                            }}
                            className="font-mono text-xs text-muted-foreground hover:underline"
                          >
                            Cancel
                          </button>
                        </div>

                        {decisionError && (
                          <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400 text-xs">
                            {decisionError}
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-mono text-muted-foreground mb-1">
                            Substantive Legal Justification / Reason *
                          </label>
                          <textarea
                            rows={3}
                            value={decisionReason}
                            onChange={(e) => setDecisionReason(e.target.value)}
                            placeholder="Detail statutory grounds, precedent, or verification evidence for this review determination..."
                            className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-foreground focus:outline-none focus:border-[var(--brass)]"
                            required
                          />
                        </div>

                        {decisionAction === "REQUEST_CORRECTION" && (
                          <div>
                            <label className="block text-xs font-mono text-muted-foreground mb-1">
                              Mandatory Corrected Statutory Language
                            </label>
                            <textarea
                              rows={3}
                              value={proposedCorrection}
                              onChange={(e) => setProposedCorrection(e.target.value)}
                              placeholder="Input the amended or corrected language to substitute for the flagged AI response..."
                              className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-foreground focus:outline-none focus:border-purple-400"
                              required
                            />
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <p className="text-[11px] text-muted-foreground/80 max-w-sm">
                            * Approvals record reviewer audit determination and do not guarantee statutory infallibility.
                          </p>

                          <button
                            type="submit"
                            disabled={isSubmittingDecision}
                            className="rounded-full bg-[var(--brass)] px-5 py-2 font-mono text-xs font-semibold uppercase tracking-wider text-[var(--primary-foreground)] shadow-[var(--glow-brass)] hover:bg-[var(--brass-strong)] disabled:opacity-40 transition-all cursor-pointer"
                          >
                            {isSubmittingDecision ? "Submitting Audit..." : "Confirm Decision"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3.5 flex items-center justify-between text-xs font-mono text-emerald-400">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Task finalized with terminal decision: {selectedTask.status}
                    </span>
                    <span className="text-muted-foreground">
                      Completed {selectedTask.completedAt ? new Date(selectedTask.completedAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/30 p-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-xs">Select a review task on the left to inspect evidence and submit determinations.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
