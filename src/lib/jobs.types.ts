/**
 * Canonical Types for ClauseGraph Background Job Queue
 */

export type JobStatus =
  | "QUEUED"
  | "RUNNING"
  | "RETRYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type JobType =
  | "CONTRACT_EXTRACTION"
  | "CITATION_REVERIFY"
  | "BATCH_EVAL_RUN"
  | "REGULATION_INDEX"
  | "LEGAL_SOURCE_CHECK"
  | "SYSTEM_BACKUP_RUN";

export type JobPriority = "low" | "normal" | "high" | "critical";

export interface JobRecord<TPayload = unknown, TResult = unknown> {
  id: string;
  org_id: string;
  created_by?: string | null;
  job_type: JobType;
  status: JobStatus;
  priority: JobPriority;
  payload: TPayload;
  result?: TResult | null;
  progress: number; // 0 to 100
  progress_stage?: string | null;
  error_message?: string | null;
  error_stack?: string | null;
  error_code?: string | null;
  retry_count: number;
  max_retries: number;
  idempotency_key?: string | null;
  locked_by?: string | null;
  locked_at?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  next_run_at: string;
}

export interface EnqueueJobOptions<TPayload = unknown> {
  orgId: string;
  jobType: JobType;
  payload: TPayload;
  createdBy?: string | null;
  priority?: JobPriority;
  maxRetries?: number;
  idempotencyKey?: string | null;
  runAt?: Date;
}

export interface JobFilter {
  status?: JobStatus;
  jobType?: JobType;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface JobQueueMetrics {
  queuedCount: number;
  runningCount: number;
  retryingCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  avgDurationMs: number;
  failureRate: number; // 0.0 to 1.0
}

export interface JobHandlerContext {
  jobId: string;
  orgId: string;
  attempt: number;
  updateProgress: (progress: number, stage?: string) => Promise<void>;
  signal?: AbortSignal;
}

export type JobHandler<TPayload = any, TResult = any> = (
  payload: TPayload,
  ctx: JobHandlerContext
) => Promise<TResult>;
