import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  Play,
  RotateCcw,
  Search,
  XCircle,
  FileText,
  ShieldAlert,
  Loader2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  X,
  Layers,
  Terminal,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  listJobsFn,
  getJobMetricsFn,
  retryJobFn,
  cancelJobFn,
  enqueueCitationAuditFn,
  enqueueBatchEvalFn,
} from "@/lib/jobs.functions";
import type { JobRecord, JobStatus, JobType } from "@/lib/jobs.types";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => ({
    meta: [
      { title: "Background Jobs & Queue — ClauseGraph" },
      {
        name: "description",
        content: "Distributed job queue monitoring contract extractions, citation audits, and batch evaluations.",
      },
    ],
  }),
  component: BackgroundJobsPage,
});

function BackgroundJobsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedJob, setSelectedJob] = useState<JobRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Poll metrics and jobs every 4 seconds
  const { data: metrics } = useQuery({
    queryKey: ["job-metrics"],
    queryFn: () => getJobMetricsFn(),
    refetchInterval: 4000,
  });

  const { data: jobData, isLoading } = useQuery({
    queryKey: ["jobs-list", statusFilter, typeFilter, search],
    queryFn: () =>
      listJobsFn({
        data: {
          status: statusFilter === "ALL" ? undefined : (statusFilter as JobStatus),
          jobType: typeFilter === "ALL" ? undefined : (typeFilter as JobType),
          search: search || undefined,
          limit: 100,
        },
      }),
    refetchInterval: 4000,
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => retryJobFn({ data: { jobId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs-list"] });
      queryClient.invalidateQueries({ queryKey: ["job-metrics"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => cancelJobFn({ data: { jobId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs-list"] });
      queryClient.invalidateQueries({ queryKey: ["job-metrics"] });
    },
  });

  const auditMutation = useMutation({
    mutationFn: () => enqueueCitationAuditFn({ data: {} }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs-list"] });
      queryClient.invalidateQueries({ queryKey: ["job-metrics"] });
    },
  });

  const evalMutation = useMutation({
    mutationFn: () => enqueueBatchEvalFn({ data: { mode: "offline" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs-list"] });
      queryClient.invalidateQueries({ queryKey: ["job-metrics"] });
    },
  });

  const jobs = useMemo(() => jobData?.jobs ?? [], [jobData]);

  // Reset pagination on filter/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter, search]);

  // Close modal when pressing Escape key
  useEffect(() => {
    if (!selectedJob) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedJob(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedJob]);

  const totalPages = Math.max(1, Math.ceil(jobs.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedJobs = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return jobs.slice(startIndex, startIndex + pageSize);
  }, [jobs, safeCurrentPage, pageSize]);

  return (
    <AppShell>
      <div className="w-full max-w-[1440px] mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end pb-4 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[var(--brass)] animate-pulse shadow-[0_0_8px_rgba(94,234,212,0.6)]" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Asynchronous Task Orchestration &middot; Distributed Pipeline
              </p>
            </div>
            <h1 className="mt-2 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Background Jobs & Worker Queue
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Real-time monitoring for long-running AI contract extractions, citation re-verification, and batch audits.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => auditMutation.mutate()}
              disabled={auditMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 px-3.5 py-2 font-mono text-xs font-semibold text-foreground shadow-[var(--shadow-soft)] hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] disabled:opacity-50 transition-all cursor-pointer"
            >
              {auditMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 text-[var(--brass)]" />
              )}
              Trigger Citation Audit
            </button>
            <button
              onClick={() => evalMutation.mutate()}
              disabled={evalMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--brass)]/40 bg-[var(--brass)]/10 px-3.5 py-2 font-mono text-xs font-semibold text-[var(--brass)] shadow-[var(--glow-brass)] hover:bg-[var(--brass)]/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {evalMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-[var(--brass)]" />
              )}
              Trigger AI Batch Eval
            </button>
          </div>
        </div>

        {/* KPI Metrics Strip */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Queued</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-foreground">{metrics?.queuedCount ?? 0}</div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Running</span>
              <Activity className="h-4 w-4 text-sky-400 animate-pulse" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-foreground">{metrics?.runningCount ?? 0}</div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Retrying</span>
              <RotateCcw className="h-4 w-4 text-orange-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-foreground">{metrics?.retryingCount ?? 0}</div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Completed</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-foreground">{metrics?.completedCount ?? 0}</div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Failed</span>
              <AlertCircle className="h-4 w-4 text-rose-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-foreground">{metrics?.failedCount ?? 0}</div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Avg Duration</span>
              <FileText className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-foreground">
              {metrics?.avgDurationMs ? `${(metrics.avgDurationMs / 1000).toFixed(1)}s` : "0s"}
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5 backdrop-blur-xl shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search job ID, type, or error..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-white/5 bg-white/[0.04] text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--brass)] focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono">
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
                <SelectTrigger className="h-8 rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-xs text-foreground hover:bg-white/[0.06] hover:border-[var(--brass)]/40 focus:ring-1 focus:ring-[var(--brass)] cursor-pointer">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="border border-[var(--hairline)] bg-[var(--surface-raised)]/95 backdrop-blur-xl text-foreground font-mono text-xs shadow-xl">
                  <SelectItem value="ALL" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">All Statuses</SelectItem>
                  <SelectItem value="QUEUED" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">Queued</SelectItem>
                  <SelectItem value="RUNNING" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">Running</SelectItem>
                  <SelectItem value="RETRYING" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">Retrying</SelectItem>
                  <SelectItem value="COMPLETED" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">Completed</SelectItem>
                  <SelectItem value="FAILED" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">Failed</SelectItem>
                  <SelectItem value="CANCELLED" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-mono">
              <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val)}>
                <SelectTrigger className="h-8 rounded-xl border border-white/10 bg-black/40 px-3 font-mono text-xs text-foreground hover:bg-white/[0.06] hover:border-[var(--brass)]/40 focus:ring-1 focus:ring-[var(--brass)] cursor-pointer">
                  <SelectValue placeholder="All Job Types" />
                </SelectTrigger>
                <SelectContent className="border border-[var(--hairline)] bg-[var(--surface-raised)]/95 backdrop-blur-xl text-foreground font-mono text-xs shadow-xl">
                  <SelectItem value="ALL" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">All Job Types</SelectItem>
                  <SelectItem value="CONTRACT_EXTRACTION" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">Contract Extraction</SelectItem>
                  <SelectItem value="CITATION_REVERIFY" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">Citation Re-verify</SelectItem>
                  <SelectItem value="BATCH_EVAL_RUN" className="cursor-pointer hover:bg-white/[0.08] focus:bg-[var(--brass)]/20 focus:text-foreground">Batch Evaluation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-xs font-mono text-muted-foreground">
            Auto-refreshing every 4s &middot; <strong className="text-foreground">{jobs.length}</strong> tasks in queue
          </div>
        </div>

        {/* ── Proportional Jobs Table ── */}
        <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl shadow-[var(--shadow-lift)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--hairline)] bg-white/[0.03] font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="px-6 py-4">Job ID & Task Type</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Execution Progress</th>
                  <th className="px-4 py-4">Retries</th>
                  <th className="px-4 py-4">Created Time</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hairline)] text-xs">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--brass)]" />
                      <span className="mt-2 block font-mono text-xs">Loading asynchronous queue...</span>
                    </td>
                  </tr>
                ) : jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-14 text-center text-muted-foreground">
                      <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-400 opacity-70" />
                      <span className="mt-2 block font-semibold text-foreground">Queue is Clear</span>
                      <span className="text-[11px] block mt-0.5">No background tasks match current search or filters.</span>
                    </td>
                  </tr>
                ) : (
                  paginatedJobs.map((j) => {
                    const isSelected = selectedJob?.id === j.id;
                    return (
                      <tr
                        key={j.id}
                        onClick={() => setSelectedJob(j)}
                        className={`group cursor-pointer transition-colors duration-150 ${
                          isSelected
                            ? "bg-[color-mix(in_oklab,var(--brass)_8%,transparent)]"
                            : "hover:bg-white/[0.03]"
                        }`}
                      >
                        {/* ID & Type */}
                        <td className="px-6 py-4">
                          <div className="font-mono text-[11px] font-semibold text-foreground group-hover:text-[var(--brass)] transition-colors">
                            {j.id.slice(0, 10)}...
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <Layers className="h-3 w-3 opacity-60" />
                            {j.job_type}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider ${
                              j.status === "COMPLETED"
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                : j.status === "RUNNING"
                                ? "bg-sky-500/15 border-sky-500/30 text-sky-300"
                                : j.status === "RETRYING"
                                ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                                : j.status === "FAILED"
                                ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                                : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                            }`}
                          >
                            {j.status === "RUNNING" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                            {j.status}
                          </span>
                        </td>

                        {/* Progress */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="w-28">
                            <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                              <span>{j.progress}%</span>
                              <span className="truncate max-w-[80px]">{j.progress_stage || "Processing"}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  j.status === "COMPLETED"
                                    ? "bg-emerald-400"
                                    : j.status === "FAILED"
                                    ? "bg-rose-500"
                                    : "bg-[var(--brass)]"
                                }`}
                                style={{ width: `${j.progress}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Retries */}
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {j.retry_count} / {j.max_retries}
                        </td>

                        {/* Created Date */}
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {new Date(j.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-2">
                            {j.status === "FAILED" || j.status === "CANCELLED" ? (
                              <button
                                onClick={() => retryMutation.mutate(j.id)}
                                disabled={retryMutation.isPending}
                                className="inline-flex items-center gap-1 rounded-xl border border-[var(--hairline)] bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-semibold text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] transition-all cursor-pointer shadow-sm"
                              >
                                <RotateCcw className="h-3 w-3" /> Retry
                              </button>
                            ) : j.status === "QUEUED" || j.status === "RUNNING" ? (
                              <button
                                onClick={() => cancelMutation.mutate(j.id)}
                                disabled={cancelMutation.isPending}
                                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition-all cursor-pointer shadow-sm"
                              >
                                <XCircle className="h-3 w-3" /> Cancel
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => setSelectedJob(j)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.04] px-3 py-1 font-mono text-[11px] font-semibold text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] transition-all cursor-pointer shadow-sm"
                            >
                              Details
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Table Pagination Footer ── */}
          {jobs.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-[var(--hairline)] bg-white/[0.02]">
              <div className="text-xs font-mono text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {Math.min((safeCurrentPage - 1) * pageSize + 1, jobs.length)}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-foreground">
                  {Math.min(safeCurrentPage * pageSize, jobs.length)}
                </span>{" "}
                of <span className="font-semibold text-foreground">{jobs.length}</span> entries
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

        {/* ── Full Details Modal via React Portal ── */}
        {selectedJob && typeof document !== "undefined" && createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setSelectedJob(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--hairline)] bg-[var(--shell-bg)] p-6 sm:p-8 shadow-[var(--shadow-lift)] space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* User-friendly Close Button with clear contrast, border, and Esc hint */}
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="absolute top-5 right-5 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/25 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-all duration-150 shadow-md cursor-pointer group active:scale-95"
                aria-label="Close job details"
                title="Close (or press Esc)"
              >
                <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground/80 group-hover:text-foreground">Close</span>
                <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
              </button>

              {/* Modal Header */}
              <div className="border-b border-[var(--hairline)] pb-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider ${
                      selectedJob.status === "COMPLETED"
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                        : selectedJob.status === "RUNNING"
                        ? "bg-sky-500/15 border-sky-500/30 text-sky-300"
                        : selectedJob.status === "RETRYING"
                        ? "bg-orange-500/15 border-orange-500/30 text-orange-300"
                        : selectedJob.status === "FAILED"
                        ? "bg-rose-500/15 border-rose-500/30 text-rose-300"
                        : "bg-amber-500/15 border-amber-500/30 text-amber-300"
                    }`}
                  >
                    {selectedJob.status === "RUNNING" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                    {selectedJob.status}
                  </span>
                  <span className="font-mono text-xs text-[var(--brass)]">{selectedJob.job_type}</span>
                </div>
                <h2 className="mt-2 text-xl font-display font-semibold text-foreground">
                  Job Execution Inspector
                </h2>
                <div className="mt-1 font-mono text-xs text-muted-foreground break-all">
                  ID: {selectedJob.id}
                </div>
              </div>

              {/* Modal Body */}
              <div className="space-y-5 text-xs">
                {/* Stage & Progress */}
                <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/50 p-4 space-y-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-muted-foreground">Current Stage:</span>
                    <span className="font-semibold text-foreground">{selectedJob.progress_stage || "Queued in runner"}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        selectedJob.status === "COMPLETED"
                          ? "bg-emerald-400"
                          : selectedJob.status === "FAILED"
                          ? "bg-rose-500"
                          : "bg-[var(--brass)]"
                      }`}
                      style={{ width: `${selectedJob.progress}%` }}
                    />
                  </div>
                  <div className="text-right font-mono text-[11px] text-muted-foreground">
                    {selectedJob.progress}% completed
                  </div>
                </div>

                {/* Error Banner */}
                {selectedJob.error_message && (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-300">
                    <div className="font-semibold flex items-center gap-1.5 mb-1.5 text-xs">
                      <AlertCircle className="h-4 w-4" />
                      Execution Error Diagnostic:
                    </div>
                    <div className="font-mono text-[11px] whitespace-pre-wrap bg-black/40 p-3 rounded-xl border border-rose-500/20">
                      {selectedJob.error_message}
                    </div>
                  </div>
                )}

                {/* Payload */}
                <div>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground mb-1.5">
                    <Terminal className="h-3.5 w-3.5 text-[var(--brass)]" />
                    Invocation Payload:
                  </div>
                  <pre className="max-h-48 overflow-auto rounded-2xl border border-[var(--hairline)] bg-black/40 p-3.5 font-mono text-[11px] text-foreground">
                    {JSON.stringify(selectedJob.payload, null, 2)}
                  </pre>
                </div>

                {/* Result */}
                {selectedJob.result && (
                  <div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground mb-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      Execution Result Output:
                    </div>
                    <pre className="max-h-56 overflow-auto rounded-2xl border border-[var(--hairline)] bg-black/40 p-3.5 font-mono text-[11px] text-foreground">
                      {JSON.stringify(selectedJob.result, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[var(--hairline)] font-mono text-[11px]">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                    <span className="text-muted-foreground block text-[10px] uppercase">Started</span>
                    <span className="font-semibold text-foreground">
                      {selectedJob.started_at ? new Date(selectedJob.started_at).toLocaleTimeString() : "—"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                    <span className="text-muted-foreground block text-[10px] uppercase">Finished</span>
                    <span className="font-semibold text-foreground">
                      {selectedJob.completed_at ? new Date(selectedJob.completed_at).toLocaleTimeString() : "—"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                    <span className="text-muted-foreground block text-[10px] uppercase">Locked By</span>
                    <span className="font-semibold text-foreground truncate block">
                      {selectedJob.locked_by || "—"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                    <span className="text-muted-foreground block text-[10px] uppercase">Retries</span>
                    <span className="font-semibold text-foreground">
                      {selectedJob.retry_count} / {selectedJob.max_retries}
                    </span>
                  </div>
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
