// src/lib/jobs.server.ts
// Durable Postgres-backed job queue with SKIP LOCKED, exponential backoff, and dead-lettering (Phase 4 T4.1)

import type pg from "pg";
import { query, transaction } from "./db.server";

export interface JobRecord<T = Record<string, unknown>> {
  id: string;
  kind: string;
  payload: T;
  org_id: string | null;
  status: "queued" | "running" | "succeeded" | "failed" | "dead";
  attempts: number;
  max_attempts: number;
  run_after: string;
  locked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Enqueues a job to be processed asynchronously by the worker.
 */
export async function enqueueJob<T = Record<string, unknown>>(
  kind: string,
  payload: T,
  options?: {
    orgId?: string | null;
    runAfter?: Date;
    maxAttempts?: number;
  },
): Promise<string> {
  const orgId = options?.orgId || null;
  const runAfter = options?.runAfter ? options.runAfter.toISOString() : new Date().toISOString();
  const maxAttempts = options?.maxAttempts ?? 3;

  const rows = await query<{ id: string }>(
    `INSERT INTO public.jobs (kind, payload, org_id, run_after, max_attempts, status)
     VALUES ($1, $2::jsonb, $3, $4, $5, 'queued')
     RETURNING id`,
    [kind, JSON.stringify(payload), orgId, runAfter, maxAttempts],
  );

  return rows[0].id;
}

/**
 * Atomically locks and claims the next available queued job using SELECT FOR UPDATE SKIP LOCKED.
 */
export async function claimNextJob(client: pg.PoolClient): Promise<JobRecord | null> {
  const res = await client.query<JobRecord>(
    `SELECT id, kind, payload, org_id, status, attempts, max_attempts,
            run_after, locked_at, last_error, created_at, updated_at
     FROM public.jobs
     WHERE status = 'queued' AND run_after <= now()
     ORDER BY id ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED`,
  );

  if (res.rows.length === 0) return null;

  const job = res.rows[0];
  const newAttempts = job.attempts + 1;

  await client.query(
    `UPDATE public.jobs
     SET status = 'running',
         attempts = $1,
         locked_at = now(),
         updated_at = now()
     WHERE id = $2`,
    [newAttempts, job.id],
  );

  return {
    ...job,
    attempts: newAttempts,
    status: "running",
  };
}

/**
 * Marks a claimed job as succeeded.
 */
export async function completeJob(client: pg.PoolClient, jobId: string | number): Promise<void> {
  await client.query(
    `UPDATE public.jobs
     SET status = 'succeeded',
         updated_at = now()
     WHERE id = $1`,
    [jobId],
  );
}

/**
 * Marks a job as failed, calculating exponential backoff or sending to dead-letter queue.
 */
export async function failJob(
  client: pg.PoolClient,
  jobId: string | number,
  errorMessage: string,
): Promise<{ dead: boolean; attempts: number }> {
  const current = await client.query<{ attempts: number; max_attempts: number }>(
    `SELECT attempts, max_attempts FROM public.jobs WHERE id = $1`,
    [jobId],
  );

  if (current.rows.length === 0) {
    throw new Error(`Job ${jobId} not found`);
  }

  const { attempts, max_attempts } = current.rows[0];
  const isDead = attempts >= max_attempts;

  if (isDead) {
    await client.query(
      `UPDATE public.jobs
       SET status = 'dead',
           last_error = $1,
           updated_at = now()
       WHERE id = $2`,
      [errorMessage, jobId],
    );
    return { dead: true, attempts };
  }

  // Exponential backoff: attempt 1 -> 15s, attempt 2 -> 45s, attempt 3 -> 135s
  const backoffSeconds = Math.pow(3, attempts) * 5;

  await client.query(
    `UPDATE public.jobs
     SET status = 'queued',
         last_error = $1,
         run_after = now() + ($2 || ' seconds')::interval,
         updated_at = now()
     WHERE id = $3`,
    [errorMessage, backoffSeconds, jobId],
  );

  return { dead: false, attempts };
}

/**
 * Helper to process a single job with automated lifecycle management.
 */
export async function processNextJob(handler: (job: JobRecord) => Promise<void>): Promise<boolean> {
  return await transaction(async (client) => {
    const job = await claimNextJob(client);
    if (!job) return false;

    try {
      await handler(job);
      await completeJob(client, job.id);
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await failJob(client, job.id, errMsg);
      return true;
    }
  });
}
