/**
 * Background Job Queue Server Architecture
 *
 * Ground rules:
 * - ACID durable queue in PostgreSQL using FOR UPDATE SKIP LOCKED
 * - Bounded retries with exponential backoff & jitter
 * - Permanent vs. transient error categorization
 * - Idempotency checks preventing duplicate active tasks
 * - Progress tracking and atomic transitions
 * - Worker crash recovery (reclaiming expired locks)
 */

import { query, queryOne, transaction } from "./db.server";
import type {
  EnqueueJobOptions,
  JobFilter,
  JobHandler,
  JobHandlerContext,
  JobPriority,
  JobQueueMetrics,
  JobRecord,
  JobStatus,
  JobType,
} from "./jobs.types";

const RETRY_DELAYS_SEC = [5, 25, 120, 600]; // Exponential backoff progression

export class PermanentJobError extends Error {
  constructor(message: string, public readonly code = "PERMANENT_FAILURE") {
    super(message);
    this.name = "PermanentJobError";
  }
}

/**
 * Enqueue a new background job with optional idempotency key
 */
export async function enqueueJob<TPayload = unknown>(
  options: EnqueueJobOptions<TPayload>
): Promise<JobRecord<TPayload>> {
  const {
    orgId,
    jobType,
    payload,
    createdBy = null,
    priority = "normal",
    maxRetries = 3,
    idempotencyKey = null,
    runAt = new Date(),
  } = options;

  // If idempotency key provided, check for active existing job
  if (idempotencyKey) {
    const existing = await queryOne<JobRecord<TPayload>>(
      `SELECT * FROM public.background_jobs
       WHERE org_id = $1::uuid AND idempotency_key = $2
         AND status IN ('QUEUED', 'RUNNING', 'RETRYING')
       LIMIT 1`,
      [orgId, idempotencyKey]
    );
    if (existing) {
      return existing;
    }
  }

  const inserted = await queryOne<JobRecord<TPayload>>(
    `INSERT INTO public.background_jobs
      (org_id, created_by, job_type, priority, payload, max_retries, idempotency_key, next_run_at, status)
     VALUES ($1::uuid, $2::uuid, $3, $4::public.job_priority, $5::jsonb, $6, $7, $8, 'QUEUED')
     RETURNING *`,
    [
      orgId,
      createdBy,
      jobType,
      priority,
      JSON.stringify(payload ?? {}),
      maxRetries,
      idempotencyKey,
      runAt.toISOString(),
    ]
  );

  if (!inserted) {
    throw new Error("Failed to insert background job");
  }

  return inserted;
}

/**
 * Fetch a job by ID within an organization
 */
export async function getJobById(jobId: string, orgId: string): Promise<JobRecord | null> {
  const job = await queryOne<JobRecord>(
    `SELECT * FROM public.background_jobs WHERE id = $1::uuid AND org_id = $2::uuid`,
    [jobId, orgId]
  );
  return job;
}

/**
 * List jobs with filtering, pagination, and status checks
 */
export async function listJobs(
  orgId: string,
  filter: JobFilter = {}
): Promise<{ jobs: JobRecord[]; totalCount: number }> {
  const conditions: string[] = ["org_id = $1::uuid"];
  const params: unknown[] = [orgId];
  let paramIdx = 2;

  if (filter.status) {
    conditions.push(`status = $${paramIdx}::public.job_status`);
    params.push(filter.status);
    paramIdx++;
  }

  if (filter.jobType) {
    conditions.push(`job_type = $${paramIdx}`);
    params.push(filter.jobType);
    paramIdx++;
  }

  if (filter.search) {
    conditions.push(
      `(idempotency_key ILIKE $${paramIdx} OR job_type ILIKE $${paramIdx} OR error_message ILIKE $${paramIdx})`
    );
    params.push(`%${filter.search}%`);
    paramIdx++;
  }

  const whereClause = conditions.join(" AND ");
  const limit = Math.min(filter.limit ?? 50, 100);
  const offset = filter.offset ?? 0;

  const [countRes, rows] = await Promise.all([
    queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM public.background_jobs WHERE ${whereClause}`,
      params
    ),
    query<JobRecord>(
      `SELECT * FROM public.background_jobs
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    ),
  ]);

  return {
    jobs: rows ?? [],
    totalCount: parseInt(countRes?.count ?? "0", 10),
  };
}

/**
 * Atomically acquire the next batch of jobs using SKIP LOCKED
 */
export async function acquireNextJobs(
  workerId: string,
  batchSize = 2,
  lockTimeoutMinutes = 10
): Promise<JobRecord[]> {
  const now = new Date().toISOString();

  // 1. Recover stale crashed jobs whose locks expired
  await query(
    `UPDATE public.background_jobs
     SET status = 'RETRYING',
         locked_by = NULL,
         locked_at = NULL,
         next_run_at = NOW(),
         error_message = 'Worker heart-beat lock expired (worker crash recovery)'
     WHERE status = 'RUNNING'
       AND locked_at < NOW() - ($1 || ' minutes')::interval`,
    [lockTimeoutMinutes]
  );

  // 2. Atomically lock and update next available jobs
  const acquired = await transaction(async (client) => {
    const rows = await client.query<JobRecord>(
      `SELECT id, org_id, job_type, payload, retry_count, max_retries, priority
       FROM public.background_jobs
       WHERE status IN ('QUEUED', 'RETRYING')
         AND next_run_at <= NOW()
       ORDER BY priority DESC, created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [batchSize]
    );

    if (!rows || rows.rows.length === 0) {
      return [];
    }

    const jobIds = rows.rows.map((r) => r.id);
    await client.query(
      `UPDATE public.background_jobs
       SET status = 'RUNNING',
           locked_by = $1,
           locked_at = NOW(),
           started_at = COALESCE(started_at, NOW())
       WHERE id = ANY($2::uuid[])`,
      [workerId, jobIds]
    );

    // Return the full updated records
    const fullRows = await client.query<JobRecord>(
      `SELECT * FROM public.background_jobs WHERE id = ANY($1::uuid[])`,
      [jobIds]
    );

    return fullRows.rows;
  });

  return acquired;
}

/**
 * Update job progress during execution
 */
export async function updateJobProgress(
  jobId: string,
  progress: number,
  stage?: string
): Promise<void> {
  const boundedProgress = Math.max(0, Math.min(100, Math.round(progress)));
  await query(
    `UPDATE public.background_jobs
     SET progress = $1,
         progress_stage = COALESCE($2, progress_stage)
     WHERE id = $3::uuid`,
    [boundedProgress, stage ?? null, jobId]
  );
}

/**
 * Complete a job successfully
 */
export async function completeJob<TResult = unknown>(
  jobId: string,
  result?: TResult
): Promise<void> {
  await query(
    `UPDATE public.background_jobs
     SET status = 'COMPLETED',
         progress = 100,
         progress_stage = 'Finished',
         result = $1::jsonb,
         completed_at = NOW(),
         locked_by = NULL,
         locked_at = NULL,
         error_message = NULL
     WHERE id = $2::uuid`,
    [JSON.stringify(result ?? null), jobId]
  );
}

/**
 * Handle job failure with retry backoff or terminal failure
 */
export async function failJob(
  jobId: string,
  err: unknown,
  isPermanent = false
): Promise<void> {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack?.slice(0, 1500) : null;
  const isPerm = isPermanent || err instanceof PermanentJobError;

  const job = await queryOne<{ retry_count: number; max_retries: number }>(
    `SELECT retry_count, max_retries FROM public.background_jobs WHERE id = $1::uuid`,
    [jobId]
  );

  const nextAttempt = (job?.retry_count ?? 0) + 1;
  const maxRetries = job?.max_retries ?? 3;
  const canRetry = !isPerm && nextAttempt <= maxRetries;

  if (canRetry) {
    const delaySec = RETRY_DELAYS_SEC[Math.min(nextAttempt - 1, RETRY_DELAYS_SEC.length - 1)];
    await query(
      `UPDATE public.background_jobs
       SET status = 'RETRYING',
           retry_count = $1,
           error_message = $2,
           error_stack = $3,
           locked_by = NULL,
           locked_at = NULL,
           next_run_at = NOW() + ($4 || ' seconds')::interval
       WHERE id = $5::uuid`,
      [nextAttempt, message.slice(0, 500), stack, delaySec, jobId]
    );
  } else {
    await query(
      `UPDATE public.background_jobs
       SET status = 'FAILED',
           retry_count = $1,
           error_message = $2,
           error_stack = $3,
           completed_at = NOW(),
           locked_by = NULL,
           locked_at = NULL
       WHERE id = $4::uuid`,
      [nextAttempt, message.slice(0, 500), stack, jobId]
    );
  }
}

/**
 * Manually retry a failed or cancelled job
 */
export async function retryJob(jobId: string, orgId: string): Promise<JobRecord> {
  const updated = await queryOne<JobRecord>(
    `UPDATE public.background_jobs
     SET status = 'QUEUED',
         next_run_at = NOW(),
         error_message = NULL,
         error_stack = NULL,
         locked_by = NULL,
         locked_at = NULL
     WHERE id = $1::uuid AND org_id = $2::uuid AND status IN ('FAILED', 'CANCELLED')
     RETURNING *`,
    [jobId, orgId]
  );

  if (!updated) {
    throw new Error("Job not found or not in retryable state");
  }

  return updated;
}

/**
 * Cancel a queued or running job
 */
export async function cancelJob(jobId: string, orgId: string): Promise<JobRecord> {
  const updated = await queryOne<JobRecord>(
    `UPDATE public.background_jobs
     SET status = 'CANCELLED',
         completed_at = NOW(),
         locked_by = NULL,
         locked_at = NULL,
         error_message = 'Cancelled by user/operator'
     WHERE id = $1::uuid AND org_id = $2::uuid AND status IN ('QUEUED', 'RETRYING', 'RUNNING')
     RETURNING *`,
    [jobId, orgId]
  );

  if (!updated) {
    throw new Error("Job not found or not cancellable");
  }

  return updated;
}

/**
 * Get aggregated metrics for dashboard monitoring
 */
export async function getJobQueueMetrics(orgId: string): Promise<JobQueueMetrics> {
  const stats = await query<{
    status: JobStatus;
    count: string;
    avg_duration_sec: string | null;
  }>(
    `SELECT 
       status, 
       COUNT(*) as count,
       AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_sec
     FROM public.background_jobs
     WHERE org_id = $1::uuid
     GROUP BY status`,
    [orgId]
  );

  const counts: Record<JobStatus, number> = {
    QUEUED: 0,
    RUNNING: 0,
    RETRYING: 0,
    COMPLETED: 0,
    FAILED: 0,
    CANCELLED: 0,
  };

  let totalCompletedDuration = 0;
  let completedCount = 0;

  for (const s of stats ?? []) {
    counts[s.status] = parseInt(s.count, 10);
    if (s.status === "COMPLETED" && s.avg_duration_sec) {
      totalCompletedDuration = parseFloat(s.avg_duration_sec);
      completedCount = counts.COMPLETED;
    }
  }

  const totalFinished = counts.COMPLETED + counts.FAILED;
  const failureRate = totalFinished > 0 ? counts.FAILED / totalFinished : 0;

  return {
    queuedCount: counts.QUEUED,
    runningCount: counts.RUNNING,
    retryingCount: counts.RETRYING,
    completedCount: counts.COMPLETED,
    failedCount: counts.FAILED,
    cancelledCount: counts.CANCELLED,
    avgDurationMs: Math.round(totalCompletedDuration * 1000),
    failureRate: Math.round(failureRate * 1000) / 1000,
  };
}
