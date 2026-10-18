import { useState } from "react";
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
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
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

  const jobs = jobData?.jobs ?? [];

  return (
    <AppShell>
      <div className="flex-1 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--ink)]">
            Background Jobs & Worker Queue
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Distributed task queue monitoring long-running AI extractions, citation re-verification, and batch audits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => auditMutation.mutate()}
            disabled={auditMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] shadow-sm hover:border-[var(--brass)] hover:bg-[color-mix(in_oklab,var(--brass)_8%,transparent)] disabled:opacity-50"
          >
            {auditMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5 text-[var(--brass)]" />}
            Trigger Citation Audit
          </button>
          <button
            onClick={() => evalMutation.mutate()}
            disabled={evalMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--hairline)] bg-[var(--card)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] shadow-sm hover:border-[var(--brass)] hover:bg-[color-mix(in_oklab,var(--brass)_8%,transparent)] disabled:opacity-50"
          >
            {evalMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-[var(--brass)]" />}
            Trigger AI Batch Eval
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Queued</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--ink)]">{metrics?.queuedCount ?? 0}</div>
        </div>

        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Running</span>
            <Activity className="h-4 w-4 text-blue-500 animate-pulse" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--ink)]">{metrics?.runningCount ?? 0}</div>
        </div>

        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Retrying</span>
            <RotateCcw className="h-4 w-4 text-orange-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--ink)]">{metrics?.retryingCount ?? 0}</div>
        </div>

        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--ink)]">{metrics?.completedCount ?? 0}</div>
        </div>

        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Failed</span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--ink)]">{metrics?.failedCount ?? 0}</div>
        </div>

        <div className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">Avg Duration</span>
            <FileText className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--ink)]">
            {metrics?.avgDurationMs ? `${(metrics.avgDurationMs / 1000).toFixed(1)}s` : "0s"}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--card)] p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by job ID, type, or error..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--background)] py-1.5 pl-9 pr-3 text-xs text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[var(--hairline)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="RUNNING">Running</option>
            <option value="RETRYING">Retrying</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[var(--hairline)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--ink)] focus:border-[var(--brass)] focus:outline-none"
          >
            <option value="ALL">All Job Types</option>
            <option value="CONTRACT_EXTRACTION">Contract Extraction</option>
            <option value="CITATION_REVERIFY">Citation Re-verify</option>
            <option value="BATCH_EVAL_RUN">Batch Evaluation</option>
          </select>
        </div>

        <div className="text-xs text-[var(--text-muted)]">
          Auto-refreshing every 4s • {jobData?.totalCount ?? 0} jobs total
        </div>
      </div>

      {/* Main Jobs Queue Table & Detail Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className={selectedJob ? "lg:col-span-7" : "lg:col-span-12"}>
          <div className="overflow-hidden rounded-xl border border-[var(--hairline)] bg-[var(--card)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--hairline)] bg-[color-mix(in_oklab,var(--card)_80%,var(--background))] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Job ID & Type</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Progress</th>
                    <th className="px-4 py-3 font-semibold">Retries</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[var(--text-muted)]">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--brass)]" />
                        <span className="mt-2 block">Loading background queue...</span>
                      </td>
                    </tr>
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-[var(--text-muted)]">
                        <CheckCircle2 className="mx-auto h-8 w-8 text-[var(--text-muted)] opacity-40" />
                        <span className="mt-2 block font-medium">Queue is clear!</span>
                        <span className="text-[11px]">No background jobs match your current filters.</span>
                      </td>
                    </tr>
                  ) : (
                    jobs.map((j) => {
                      const isSelected = selectedJob?.id === j.id;
                      return (
                        <tr
                          key={j.id}
                          onClick={() => setSelectedJob(j)}
                          className={`cursor-pointer transition-colors hover:bg-white/[0.02] ${
                            isSelected ? "bg-[color-mix(in_oklab,var(--brass)_10%,transparent)]" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-mono text-[11px] font-semibold text-[var(--ink)]">
                              {j.id.slice(0, 8)}...
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)]">{j.job_type}</div>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                j.status === "COMPLETED"
                                  ? "bg-emerald-500/10 text-emerald-500"
                                  : j.status === "RUNNING"
                                  ? "bg-blue-500/10 text-blue-500"
                                  : j.status === "RETRYING"
                                  ? "bg-orange-500/10 text-orange-500"
                                  : j.status === "FAILED"
                                  ? "bg-rose-500/10 text-rose-500"
                                  : "bg-amber-500/10 text-amber-500"
                              }`}
                            >
                              {j.status === "RUNNING" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                              {j.status}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="w-24">
                              <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                                <span>{j.progress}%</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-[var(--background)] overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    j.status === "COMPLETED"
                                      ? "bg-emerald-500"
                                      : j.status === "FAILED"
                                      ? "bg-rose-500"
                                      : "bg-[var(--brass)]"
                                  }`}
                                  style={{ width: `${j.progress}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-[11px] text-[var(--text-muted)]">
                            {j.retry_count} / {j.max_retries}
                          </td>

                          <td className="px-4 py-3 text-[11px] text-[var(--text-muted)]">
                            {new Date(j.created_at).toLocaleTimeString()}
                          </td>

                          <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            {j.status === "FAILED" || j.status === "CANCELLED" ? (
                              <button
                                onClick={() => retryMutation.mutate(j.id)}
                                disabled={retryMutation.isPending}
                                className="inline-flex items-center gap-1 rounded border border-[var(--hairline)] px-2 py-1 text-[10px] font-medium text-[var(--ink)] hover:border-[var(--brass)] hover:bg-[color-mix(in_oklab,var(--brass)_10%,transparent)]"
                              >
                                <RotateCcw className="h-3 w-3" /> Retry
                              </button>
                            ) : j.status === "QUEUED" || j.status === "RUNNING" ? (
                              <button
                                onClick={() => cancelMutation.mutate(j.id)}
                                disabled={cancelMutation.isPending}
                                className="inline-flex items-center gap-1 rounded border border-rose-500/30 px-2 py-1 text-[10px] font-medium text-rose-500 hover:bg-rose-500/10"
                              >
                                <XCircle className="h-3 w-3" /> Cancel
                              </button>
                            ) : (
                              <span className="text-[10px] text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Selected Job Inspection Panel */}
        {selectedJob && (
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-[var(--hairline)] bg-[var(--card)] p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-4">
                <div>
                  <h3 className="font-display font-semibold text-[var(--ink)]">Job Details</h3>
                  <div className="font-mono text-xs text-[var(--text-muted)]">{selectedJob.id}</div>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--ink)]"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <span className="text-[var(--text-muted)]">Type:</span>
                  <div className="font-medium text-[var(--ink)]">{selectedJob.job_type}</div>
                </div>

                <div>
                  <span className="text-[var(--text-muted)]">Current Stage:</span>
                  <div className="font-medium text-[var(--ink)]">
                    {selectedJob.progress_stage || "Queued in runner"}
                  </div>
                </div>

                {selectedJob.error_message && (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-rose-400">
                    <div className="font-semibold flex items-center gap-1.5 mb-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Execution Error:
                    </div>
                    <div className="font-mono text-[11px] whitespace-pre-wrap">{selectedJob.error_message}</div>
                  </div>
                )}

                <div>
                  <span className="text-[var(--text-muted)]">Payload:</span>
                  <pre className="mt-1 max-h-36 overflow-auto rounded-lg border border-[var(--hairline)] bg-[var(--background)] p-2 font-mono text-[10px] text-[var(--ink)]">
                    {JSON.stringify(selectedJob.payload, null, 2)}
                  </pre>
                </div>

                {selectedJob.result && (
                  <div>
                    <span className="text-[var(--text-muted)]">Result:</span>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-[var(--hairline)] bg-[var(--background)] p-2 font-mono text-[10px] text-[var(--ink)]">
                      {JSON.stringify(selectedJob.result, null, 2)}
                    </pre>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--hairline)] text-[11px] text-[var(--text-muted)]">
                  <div>Started: {selectedJob.started_at ? new Date(selectedJob.started_at).toLocaleTimeString() : "—"}</div>
                  <div>Finished: {selectedJob.completed_at ? new Date(selectedJob.completed_at).toLocaleTimeString() : "—"}</div>
                  <div>Locked By: {selectedJob.locked_by || "—"}</div>
                  <div>Idempotency Key: {selectedJob.idempotency_key || "—"}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </AppShell>
  );
}
