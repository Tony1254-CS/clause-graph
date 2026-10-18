import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
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
  ChevronLeft,
  User,
  Calendar,
  AlertOctagon,
  RefreshCw,
  FileText,
  CornerDownRight,
  MessageSquare,
  Sparkles,
  GitCompare,
  History,
  FileCode2,
  Table as TableIcon,
  Columns2,
  SlidersHorizontal,
  ArrowRight,
  X,
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
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    icon: Clock,
  },
  IN_REVIEW: {
    label: "In Review",
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    icon: User,
  },
  NEEDS_CORRECTION: {
    label: "Needs Correction",
    badge: "border-purple-500/30 bg-purple-500/10 text-purple-400",
    icon: AlertTriangle,
  },
  APPROVED: {
    label: "Approved",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    icon: XCircle,
  },
};

const RISK_BADGES: Record<ReviewRiskLevel, string> = {
  critical: "border-rose-600/40 bg-rose-600/15 text-rose-300",
  high: "border-rose-500/30 bg-rose-500/10 text-rose-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  low: "border-slate-500/30 bg-slate-500/10 text-slate-300",
};

type ViewMode = "table" | "split";

function ReviewQueuePage() {
  const [initialData, initialStats] = Route.useLoaderData();
  const initialTaskList: ReviewTask[] = Array.isArray(initialData)
    ? initialData
    : initialData?.tasks || [];

  const [tasks, setTasks] = useState<ReviewTask[]>(initialTaskList);
  const [stats, setStats] = useState<ReviewQueueStats>(
    initialStats || {
      totalPending: 0,
      totalInReview: 0,
      totalNeedsCorrection: 0,
      totalApproved: 0,
      totalRejected: 0,
      highRiskCount: 0,
    }
  );

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    initialTaskList[0]?.id || null
  );
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "ALL">("ALL");
  const [riskFilter, setRiskFilter] = useState<ReviewRiskLevel | "ALL">("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Drawer / Inspection open state (for table view modal/drawer)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Inspector Sub-Tabs: "content" | "diff" | "audit"
  const [inspectorTab, setInspectorTab] = useState<"content" | "diff" | "audit">("content");

  // Decision Form State
  const [decisionAction, setDecisionAction] = useState<ReviewDecisionAction | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [proposedCorrection, setProposedCorrection] = useState("");
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Server actions
  const listTasksAction = useServerFn(listReviewTasksFn);
  const getStatsAction = useServerFn(getReviewStatsFn);
  const assignTaskAction = useServerFn(assignReviewTaskFn);
  const submitDecisionAction = useServerFn(submitReviewDecisionFn);

  async function refreshQueue() {
    setIsLoading(true);
    try {
      const [res, newStats] = await Promise.all([
        listTasksAction({ data: { status: "ALL", limit: 50 } }),
        getStatsAction(),
      ]);
      const taskList: ReviewTask[] = Array.isArray(res) ? res : res?.tasks || [];
      setTasks(taskList);
      setStats(newStats);
      if (taskList.length > 0 && !taskList.some((t) => t.id === selectedTaskId)) {
        setSelectedTaskId(taskList[0].id);
      }
    } catch (err) {
      console.error("[Review Queue Refresh Error]", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAssign(taskId: string, currentAssignedTo: string | null) {
    try {
      const isClaim = !currentAssignedTo;
      const updated = await assignTaskAction({
        data: {
          taskId,
          assignToUserId: isClaim ? "CLAIM_ME" : null,
        },
      });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err: any) {
      alert(err.message || "Failed to assign review task");
    }
  }

  async function handleDecisionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTaskId || !decisionAction) return;

    if (!decisionReason || decisionReason.trim().length < 5) {
      setDecisionError("A substantive legal justification (at least 5 characters) is required.");
      return;
    }

    if (decisionAction === "REQUEST_CORRECTION" && (!proposedCorrection || proposedCorrection.trim().length < 5)) {
      setDecisionError("Please provide the proposed corrected statutory language.");
      return;
    }

    setIsSubmittingDecision(true);
    setDecisionError(null);

    try {
      const updated = await submitDecisionAction({
        data: {
          taskId: selectedTaskId,
          action: decisionAction,
          reason: decisionReason.trim(),
          proposedCorrections: proposedCorrection.trim() || undefined,
        },
      });

      setTasks((prev) => prev.map((t) => (t.id === selectedTaskId ? updated : t)));
      setDecisionAction(null);
      setDecisionReason("");
      setProposedCorrection("");
      const newStats = await getStatsAction();
      setStats(newStats);
    } catch (err: any) {
      setDecisionError(err.message || "Failed to submit review determination");
    } finally {
      setIsSubmittingDecision(false);
    }
  }

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, riskFilter, searchTerm]);

  // Close modal when pressing Escape key
  useEffect(() => {
    if (!isDetailDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDetailDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDetailDrawerOpen]);

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

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

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));

  // Ensure current page does not exceed total pages
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedTasks = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return filteredTasks.slice(startIndex, startIndex + pageSize);
  }, [filteredTasks, safeCurrentPage, pageSize]);

  function openTaskDetail(taskId: string) {
    setSelectedTaskId(taskId);
    setDecisionAction(null);
    setDecisionError(null);
    setIsDetailDrawerOpen(true);
  }

  return (
    <AppShell>
      <div className="w-full max-w-[1440px] mx-auto space-y-6">
        
        {/* ── Executive Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Human-in-the-Loop Governance &middot; Consequential Verification
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Compliance Review Queue
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Inspect, verify, approve, or correct AI-generated regulatory outputs flagged for unverified statutes, repealed provisions, or high-risk exposure.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Switcher: Table vs Split-Screen */}
            <div className="flex items-center rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 p-1 shadow-sm font-mono text-xs">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                Table View
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === "split"
                    ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Columns2 className="h-3.5 w-3.5" />
                Split Screen
              </button>
            </div>

            <button
              type="button"
              onClick={refreshQueue}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 px-4 py-2 font-mono text-xs font-medium text-foreground hover:border-[var(--brass)]/50 hover:bg-[var(--surface-raised)] transition-all shadow-[var(--shadow-soft)] hover:shadow-[0_12px_28px_-10px_rgba(94,234,212,0.18)] cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-[var(--brass)] ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── KPI Metric Ribbon with App Brand Glow & Lift ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-[0_18px_36px_-12px_rgba(251,191,36,0.22)] shadow-[var(--shadow-soft)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">Pending Review</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-amber-400 font-mono">
              {stats.totalPending}
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-[0_18px_36px_-12px_rgba(96,165,250,0.22)] shadow-[var(--shadow-soft)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">In Review</span>
              <User className="h-4 w-4 text-blue-400" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-blue-400 font-mono">
              {stats.totalInReview}
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-purple-400/50 hover:shadow-[0_18px_36px_-12px_rgba(192,132,252,0.22)] shadow-[var(--shadow-soft)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">Corrections</span>
              <AlertTriangle className="h-4 w-4 text-purple-400" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-purple-400 font-mono">
              {stats.totalNeedsCorrection}
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-rose-400/50 hover:shadow-[0_18px_36px_-12px_rgba(251,113,133,0.24)] shadow-[var(--shadow-soft)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">High Risk</span>
              <AlertOctagon className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-rose-400 font-mono">
              {stats.highRiskCount}
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4 backdrop-blur-xl transition-all duration-300 ease-out hover:-translate-y-1 hover:border-emerald-400/50 hover:shadow-[0_18px_36px_-12px_rgba(52,211,153,0.22)] shadow-[var(--shadow-soft)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="font-mono text-[10px] uppercase tracking-wider">Approved</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-400 font-mono">
              {stats.totalApproved}
            </div>
          </div>
        </div>

        {/* ── Search & Filter Strip ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5 backdrop-blur-xl shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search citation or response..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-white/5 bg-white/[0.04] text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--brass)] focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[var(--brass)] transition-colors cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="NEEDS_CORRECTION">Needs Correction</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono">
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as any)}
                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-[var(--brass)] transition-colors cursor-pointer"
              >
                <option value="ALL">All Risk Levels</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
                <option value="low">Low Risk</option>
              </select>
            </div>
          </div>

          <div className="text-xs font-mono text-muted-foreground">
            Showing <strong className="text-foreground">{filteredTasks.length}</strong> of {tasks.length} tasks
          </div>
        </div>

        {/* ── VIEW MODE 1: PROPORTIONAL DENSE TABLE (Default & Highly Recommended) ── */}
        {viewMode === "table" ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl shadow-[var(--shadow-lift)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hairline)] bg-white/[0.03] font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="px-6 py-4">Title & Context</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Risk Level</th>
                    <th className="px-4 py-4">Assigned Counsel</th>
                    <th className="px-4 py-4">Created Date</th>
                    <th className="px-6 py-4 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)] text-xs">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-muted-foreground">
                        <CheckCircle2 className="h-9 w-9 text-emerald-400 mx-auto mb-2 opacity-70" />
                        <span className="font-semibold block text-foreground">No Review Tasks Match Filter</span>
                        <span className="text-[11px] block mt-1">Adjust search terms or status filters above.</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedTasks.map((t) => {
                      const statusConf = STATUS_BADGES[t.status];
                      const StatusIcon = statusConf.icon;
                      const isSelected = selectedTask?.id === t.id;

                      return (
                        <tr
                          key={t.id}
                          onClick={() => openTaskDetail(t.id)}
                          className={`group cursor-pointer transition-colors duration-150 ${
                            isSelected
                              ? "bg-[color-mix(in_oklab,var(--brass)_8%,transparent)]"
                              : "hover:bg-white/[0.03]"
                          }`}
                        >
                          {/* Title & Description */}
                          <td className="px-6 py-4 max-w-md">
                            <div className="font-semibold text-foreground group-hover:text-[var(--brass)] transition-colors line-clamp-1">
                              {t.title}
                            </div>
                            <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                              {t.description || t.originalAiResponse.slice(0, 100)}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider ${statusConf.badge}`}
                            >
                              <StatusIcon className="h-2.5 w-2.5" />
                              {statusConf.label}
                            </span>
                          </td>

                          {/* Risk Level */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider ${
                                RISK_BADGES[t.riskLevel]
                              }`}
                            >
                              {t.riskLevel}
                            </span>
                          </td>

                          {/* Assigned Reviewer */}
                          <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                            {t.assignedToName ? (
                              <span className="text-foreground font-medium flex items-center gap-1.5">
                                <User className="h-3 w-3 text-[var(--brass)]" />
                                {t.assignedToName}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60">Unassigned</span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                            {new Date(t.createdAt).toLocaleDateString()}
                          </td>

                          {/* Action Button */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openTaskDetail(t.id);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] font-semibold text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] transition-all cursor-pointer shadow-sm"
                            >
                              Inspect & Act
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Table Pagination Footer ── */}
            {filteredTasks.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-[var(--hairline)] bg-white/[0.02]">
                <div className="text-xs font-mono text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min((safeCurrentPage - 1) * pageSize + 1, filteredTasks.length)}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(safeCurrentPage * pageSize, filteredTasks.length)}
                  </span>{" "}
                  of <span className="font-semibold text-foreground">{filteredTasks.length}</span> entries
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>

                  <div className="flex items-center gap-1 font-mono text-xs">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
                      const isActive = pg === safeCurrentPage;
                      return (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setCurrentPage(pg)}
                          className={`h-7 w-7 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                            isActive
                              ? "border-[var(--brass)] bg-[var(--brass)]/15 text-[var(--brass)] font-bold shadow-sm"
                              : "border-transparent text-muted-foreground hover:border-[var(--hairline)] hover:text-foreground"
                          }`}
                        >
                          {pg}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── VIEW MODE 2: SPLIT SCREEN (With Fixed Height & Inner Scroll) ── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Task Queue List (5 cols, fixed height with scroll) */}
            <div className="lg:col-span-5 space-y-3 max-h-[780px] overflow-y-auto pr-1">
              {filteredTasks.length === 0 ? (
                <div className="rounded-2xl border border-[var(--hairline)] border-dashed bg-[var(--surface-raised)]/40 p-12 text-center text-muted-foreground shadow-[var(--shadow-soft)]">
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
                      onClick={() => {
                        setSelectedTaskId(t.id);
                        setDecisionAction(null);
                        setDecisionError(null);
                      }}
                      className={`group relative overflow-hidden cursor-pointer rounded-2xl border p-4.5 transition-all duration-300 ease-out ${
                        isSelected
                          ? "border-[var(--brass)] bg-[var(--surface-raised)] shadow-[0_16px_36px_-10px_rgba(94,234,212,0.22)] -translate-y-0.5"
                          : "border-[var(--hairline)] bg-[var(--surface-raised)]/50 hover:border-white/20 hover:bg-[var(--surface-raised)]/80 shadow-[var(--shadow-soft)] hover:-translate-y-0.5"
                      }`}
                    >
                      <div
                        className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent transition-opacity duration-300 ${
                          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                        }`}
                      />

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider ${statusConf.badge}`}
                            >
                              <StatusIcon className="h-2.5 w-2.5" />
                              {statusConf.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider ${
                                RISK_BADGES[t.riskLevel]
                              }`}
                            >
                              {t.riskLevel}
                            </span>
                          </div>

                          <h3 className="mt-2.5 text-sm font-semibold text-foreground line-clamp-1 group-hover:text-[var(--brass)] transition-colors">
                            {t.title}
                          </h3>

                          {t.description && (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              {t.description}
                            </p>
                          )}
                        </div>

                        <ChevronRight
                          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                            isSelected
                              ? "text-[var(--brass)] translate-x-1"
                              : "text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5"
                          }`}
                        />
                      </div>

                      <div className="mt-3.5 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                        <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                        <span className={t.assignedTo ? "text-[var(--brass)] font-semibold" : ""}>
                          {t.assignedToName ? `Reviewer: ${t.assignedToName}` : "Unassigned"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Column: Inline Panel in Split Mode */}
            <div className="lg:col-span-7">
              {selectedTask ? (
                <DetailInspector
                  task={selectedTask}
                  inspectorTab={inspectorTab}
                  setInspectorTab={setInspectorTab}
                  handleAssign={handleAssign}
                  decisionAction={decisionAction}
                  setDecisionAction={setDecisionAction}
                  decisionReason={decisionReason}
                  setDecisionReason={setDecisionReason}
                  proposedCorrection={proposedCorrection}
                  setProposedCorrection={setProposedCorrection}
                  decisionError={decisionError}
                  setDecisionError={setDecisionError}
                  isSubmittingDecision={isSubmittingDecision}
                  handleDecisionSubmit={handleDecisionSubmit}
                />
              ) : (
                <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/30 p-12 text-center text-muted-foreground shadow-[var(--shadow-soft)]">
                  <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Select a review task on the left to inspect evidence and submit determinations.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MODAL / SLIDE-OVER DRAWER (When in Table View) ── */}
        {viewMode === "table" && isDetailDrawerOpen && selectedTask && typeof document !== "undefined" && createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setIsDetailDrawerOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--hairline)] bg-[var(--shell-bg)] p-6 sm:p-8 shadow-[var(--shadow-lift)] space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* User-friendly Close Button with clear contrast, border, and Esc hint */}
              <button
                type="button"
                onClick={() => setIsDetailDrawerOpen(false)}
                className="absolute top-5 right-5 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/25 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-all duration-150 shadow-md cursor-pointer group active:scale-95"
                aria-label="Close details inspector"
                title="Close (or press Esc)"
              >
                <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground/80 group-hover:text-foreground">Close</span>
                <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
              </button>

              <DetailInspector
                task={selectedTask}
                inspectorTab={inspectorTab}
                setInspectorTab={setInspectorTab}
                handleAssign={handleAssign}
                decisionAction={decisionAction}
                setDecisionAction={setDecisionAction}
                decisionReason={decisionReason}
                setDecisionReason={setDecisionReason}
                proposedCorrection={proposedCorrection}
                setProposedCorrection={setProposedCorrection}
                decisionError={decisionError}
                setDecisionError={setDecisionError}
                isSubmittingDecision={isSubmittingDecision}
                handleDecisionSubmit={async (e) => {
                  await handleDecisionSubmit(e);
                  setIsDetailDrawerOpen(false);
                }}
              />
            </div>
          </div>,
          document.body
        )}

      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Task Detail Inspector & Action Panel Component
// ─────────────────────────────────────────────────────────────────────────────

interface DetailInspectorProps {
  task: ReviewTask;
  inspectorTab: "content" | "diff" | "audit";
  setInspectorTab: (t: "content" | "diff" | "audit") => void;
  handleAssign: (taskId: string, currentAssignedTo: string | null) => Promise<void>;
  decisionAction: ReviewDecisionAction | null;
  setDecisionAction: (a: ReviewDecisionAction | null) => void;
  decisionReason: string;
  setDecisionReason: (r: string) => void;
  proposedCorrection: string;
  setProposedCorrection: (c: string) => void;
  decisionError: string | null;
  setDecisionError: (e: string | null) => void;
  isSubmittingDecision: boolean;
  handleDecisionSubmit: (e: React.FormEvent) => Promise<void>;
}

function DetailInspector({
  task,
  inspectorTab,
  setInspectorTab,
  handleAssign,
  decisionAction,
  setDecisionAction,
  decisionReason,
  setDecisionReason,
  proposedCorrection,
  setProposedCorrection,
  decisionError,
  setDecisionError,
  isSubmittingDecision,
  handleDecisionSubmit,
}: DetailInspectorProps) {
  return (
    <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl shadow-[var(--shadow-lift)] overflow-hidden">
      
      {/* Task Header & Claim Button */}
      <div className="p-6 border-b border-[var(--hairline)] bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono border uppercase tracking-wider ${
                  STATUS_BADGES[task.status].badge
                }`}
              >
                {STATUS_BADGES[task.status].label}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono border uppercase tracking-wider ${
                  RISK_BADGES[task.riskLevel]
                }`}
              >
                {task.riskLevel} Risk
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Trigger: <strong className="text-foreground">{task.triggerType}</strong>
              </span>
            </div>

            <h2 className="mt-3 text-lg font-display font-semibold text-foreground">
              {task.title}
            </h2>

            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Created {new Date(task.createdAt).toLocaleString()} by{" "}
              {task.createdByName || "System Engine"}
            </p>
          </div>

          {/* Claim/Release Controls */}
          <div className="shrink-0">
            {task.assignedTo ? (
              <div className="text-right">
                <span className="text-[11px] font-mono text-muted-foreground block">
                  Assigned Reviewer:
                </span>
                <span className="text-xs font-semibold text-[var(--brass)] font-mono block">
                  {task.assignedToName || task.assignedToEmail}
                </span>
                {task.status !== "APPROVED" && task.status !== "REJECTED" && (
                  <button
                    type="button"
                    onClick={() => handleAssign(task.id, task.assignedTo || null)}
                    className="mt-1 text-[11px] font-mono text-muted-foreground hover:text-rose-400 hover:underline cursor-pointer"
                  >
                    Release Task
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleAssign(task.id, null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brass)]/40 bg-[var(--brass)]/10 px-4 py-2 font-mono text-xs font-semibold text-[var(--brass)] hover:bg-[var(--brass)]/20 transition-all shadow-[var(--glow-brass)] cursor-pointer"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Claim Task
              </button>
            )}
          </div>
        </div>

        {/* Inspector Tabs Navigation */}
        <div className="flex items-center gap-4 mt-6 border-b border-[var(--hairline)] text-xs font-mono">
          <button
            type="button"
            onClick={() => setInspectorTab("content")}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              inspectorTab === "content"
                ? "border-[var(--brass)] text-[var(--brass)] font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileCode2 className="h-3.5 w-3.5" />
            Content & Warnings
          </button>

          <button
            type="button"
            onClick={() => setInspectorTab("diff")}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              inspectorTab === "diff"
                ? "border-[var(--brass)] text-[var(--brass)] font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <GitCompare className="h-3.5 w-3.5" />
            Side-by-Side Diff {task.correctedContent && <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />}
          </button>

          <button
            type="button"
            onClick={() => setInspectorTab("audit")}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
              inspectorTab === "audit"
                ? "border-[var(--brass)] text-[var(--brass)] font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Decision Audit ({task.decisionHistory?.length || 0})
          </button>
        </div>
      </div>

      {/* Tab Body */}
      <div className="p-6 space-y-6">
        {inspectorTab === "content" && (
          <div className="space-y-5">
            {/* Statutory Warnings */}
            {task.warningsSnapshot && task.warningsSnapshot.length > 0 && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-2 shadow-[0_12px_24px_-8px_rgba(225,82,75,0.18)]">
                <div className="flex items-center gap-2 text-rose-400 font-mono text-xs font-bold uppercase tracking-wider">
                  <AlertOctagon className="h-4 w-4" />
                  Triggered Statutory Citations / Risk Warnings
                </div>
                <ul className="list-disc pl-5 space-y-1.5 text-xs text-rose-200/90 leading-relaxed font-sans">
                  {task.warningsSnapshot.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preserved Original AI Output */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Preserved Original AI Output
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/60 border border-white/5 rounded px-2 py-0.5">
                  SHA-256 Verified Snapshot
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/50 p-4 max-h-[260px] overflow-y-auto text-xs font-mono text-foreground/90 whitespace-pre-wrap leading-relaxed shadow-inner">
                {task.originalAiResponse}
              </div>
            </div>
          </div>
        )}

        {inspectorTab === "diff" && (
          <div className="space-y-4">
            {task.correctedContent ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-rose-400">
                      - Original Output
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">Flagged</span>
                  </div>
                  <div className="rounded-xl border border-rose-500/30 bg-rose-950/15 p-3.5 text-xs font-mono text-rose-200/90 whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed">
                    {task.originalAiResponse}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-emerald-400">
                      + Corrected Counsel Provision
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400/80">Amended</span>
                  </div>
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-3.5 text-xs font-mono text-emerald-200/90 whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed">
                    {task.correctedContent}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center border border-[var(--hairline)] rounded-xl bg-white/[0.02]">
                <GitCompare className="h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-2" />
                <p className="text-xs text-muted-foreground">
                  No corrective language has been proposed yet. Submit a determination with <strong>"Correct"</strong> to generate a side-by-side diff.
                </p>
              </div>
            )}
          </div>
        )}

        {inspectorTab === "audit" && (
          <div className="space-y-3">
            {task.decisionHistory && task.decisionHistory.length > 0 ? (
              <div className="space-y-2.5">
                {task.decisionHistory.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs space-y-2 shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px]">
                      <span className="font-semibold text-foreground">
                        {d.reviewerName || d.reviewerEmail || "Reviewer"} &middot;{" "}
                        <span className="text-[var(--brass)] uppercase">{d.action}</span>
                      </span>
                      <span>{new Date(d.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-foreground/90 leading-relaxed font-sans">
                      {d.reason}
                    </p>
                    {d.proposedCorrections && (
                      <div className="mt-2 text-purple-300 font-mono text-[11px] bg-purple-950/30 p-2.5 rounded-lg border border-purple-500/20">
                        <strong>Proposed Substitution:</strong> {d.proposedCorrections}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border border-[var(--hairline)] rounded-xl bg-white/[0.02]">
                <History className="h-8 w-8 mx-auto text-muted-foreground opacity-50 mb-2" />
                <p className="text-xs text-muted-foreground">No prior review decisions recorded for this task.</p>
              </div>
            )}
          </div>
        )}

        {/* Decision Action Form (Only available if task is not in terminal state) */}
        {task.status !== "APPROVED" && task.status !== "REJECTED" ? (
          <div className="pt-5 border-t border-[var(--hairline)] space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-wider text-foreground font-semibold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[var(--brass)]" />
                Submit Review Determination
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                Audited & Non-Repudiable
              </span>
            </div>

            {decisionAction === null ? (
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setDecisionAction("APPROVE")}
                  className="group flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-[0_12px_24px_-8px_rgba(52,211,153,0.22)] transition-all cursor-pointer"
                >
                  <CheckCircle2 className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  <span className="font-mono text-xs font-semibold">Approve</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDecisionAction("REQUEST_CORRECTION")}
                  className="group flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 hover:border-purple-500/50 hover:shadow-[0_12px_24px_-8px_rgba(192,132,252,0.22)] transition-all cursor-pointer"
                >
                  <AlertTriangle className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  <span className="font-mono text-xs font-semibold">Correct</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDecisionAction("REJECT")}
                  className="group flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 hover:shadow-[0_12px_24px_-8px_rgba(251,113,133,0.22)] transition-all cursor-pointer"
                >
                  <XCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  <span className="font-mono text-xs font-semibold">Reject</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleDecisionSubmit} className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <span className="font-mono text-xs font-semibold text-[var(--brass)] uppercase">
                    Executing Action: {decisionAction}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDecisionAction(null);
                      setDecisionError(null);
                    }}
                    className="font-mono text-xs text-muted-foreground hover:underline cursor-pointer"
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
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-foreground focus:outline-none focus:border-[var(--brass)] transition-colors"
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
                      className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-foreground focus:outline-none focus:border-purple-400 transition-colors"
                      required
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-2">
                  <p className="text-[11px] text-muted-foreground/80 max-w-sm">
                    * Approvals record reviewer audit determination and enforce statutory traceability.
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
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 flex items-center justify-between text-xs font-mono text-emerald-400">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Task finalized with terminal decision: {task.status}
            </span>
            <span className="text-muted-foreground">
              Completed {task.completedAt ? new Date(task.completedAt).toLocaleDateString() : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
