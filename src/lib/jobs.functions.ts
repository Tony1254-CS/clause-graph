import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";
import type { JobFilter, JobRecord, JobStatus, JobType } from "./jobs.types";

/**
 * List background jobs for caller's organization
 */
export const listJobsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input?: JobFilter) => {
    return {
      status: input?.status,
      jobType: input?.jobType,
      search: input?.search ? String(input.search).slice(0, 100) : undefined,
      limit: input?.limit ? Math.min(Number(input.limit), 100) : 50,
      offset: input?.offset ? Math.max(0, Number(input.offset)) : 0,
    };
  })
  .handler(async ({ data, context }) => {
    const { listJobs } = await import("./jobs.server");
    return listJobs(context.orgId, data);
  });

/**
 * Get single background job by ID
 */
export const getJobFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: { jobId: string }) => {
    const id = String(input?.jobId ?? "").trim();
    if (!id) throw new Error("jobId is required");
    return { jobId: id };
  })
  .handler(async ({ data, context }): Promise<JobRecord> => {
    const { getJobById } = await import("./jobs.server");
    const job = await getJobById(data.jobId, context.orgId);
    if (!job) throw new Error("Job not found or access denied");
    return job;
  });

/**
 * Enqueue a citation re-verification background job
 */
export const enqueueCitationAuditFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input?: { contractId?: string }) => {
    return {
      contractId: input?.contractId ? String(input.contractId) : undefined,
    };
  })
  .handler(async ({ data, context }): Promise<JobRecord> => {
    const { enqueueJob } = await import("./jobs.server");
    const key = data.contractId
      ? `audit::contract::${data.contractId}`
      : `audit::org::${context.orgId}::${Math.floor(Date.now() / 60000)}`;

    return enqueueJob({
      orgId: context.orgId,
      createdBy: context.userId,
      jobType: "CITATION_REVERIFY",
      priority: "normal",
      payload: { contractId: data.contractId },
      idempotencyKey: key,
    });
  });

/**
 * Enqueue a batch AI evaluation background job
 */
export const enqueueBatchEvalFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input?: { mode?: "offline" | "live" }) => {
    const mode = input?.mode === "live" ? "live" : "offline";
    return { mode };
  })
  .handler(async ({ data, context }): Promise<JobRecord> => {
    const { enqueueJob } = await import("./jobs.server");
    const key = `eval::${data.mode}::${Math.floor(Date.now() / 300000)}`;

    return enqueueJob({
      orgId: context.orgId,
      createdBy: context.userId,
      jobType: "BATCH_EVAL_RUN",
      priority: "normal",
      payload: { mode: data.mode },
      idempotencyKey: key,
    });
  });

/**
 * Retry a failed or cancelled job
 */
export const retryJobFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { jobId: string }) => {
    const id = String(input?.jobId ?? "").trim();
    if (!id) throw new Error("jobId is required");
    return { jobId: id };
  })
  .handler(async ({ data, context }): Promise<JobRecord> => {
    const { retryJob } = await import("./jobs.server");
    return retryJob(data.jobId, context.orgId);
  });

/**
 * Cancel an active job
 */
export const cancelJobFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { jobId: string }) => {
    const id = String(input?.jobId ?? "").trim();
    if (!id) throw new Error("jobId is required");
    return { jobId: id };
  })
  .handler(async ({ data, context }): Promise<JobRecord> => {
    const { cancelJob } = await import("./jobs.server");
    return cancelJob(data.jobId, context.orgId);
  });

/**
 * Get job queue metrics for dashboard
 */
export const getJobMetricsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { getJobQueueMetrics } = await import("./jobs.server");
    return getJobQueueMetrics(context.orgId);
  });
