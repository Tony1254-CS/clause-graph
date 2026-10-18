import test from "node:test";
import assert from "node:assert/strict";

import {
  enqueueJob,
  getJobById,
  listJobs,
  acquireNextJobs,
  updateJobProgress,
  completeJob,
  failJob,
  retryJob,
  cancelJob,
  getJobQueueMetrics,
  PermanentJobError,
} from "../lib/jobs.server.js";
import { runWorkerIteration } from "../lib/jobs.worker.js";
import { query } from "../lib/db.server.js";

async function getTestOrg() {
  const users = await query<{ id: string; org_id: string }>(
    `SELECT u.id, p.org_id FROM auth.users u JOIN public.profiles p ON p.id = u.id LIMIT 1`
  );
  if (!users || users.length === 0) {
    throw new Error("No test users found in database");
  }
  return { userId: users[0].id, orgId: users[0].org_id };
}

test("Background Jobs: Enqueue and idempotency deduplication", async () => {
  const { userId, orgId } = await getTestOrg();
  const idempotencyKey = `dedup-test-${Date.now()}`;

  // 1. Enqueue job
  const job1 = await enqueueJob({
    orgId,
    createdBy: userId,
    jobType: "CITATION_REVERIFY",
    priority: "high",
    payload: { sample: true },
    idempotencyKey,
  });

  assert.ok(job1.id);
  assert.equal(job1.status, "QUEUED");
  assert.equal(job1.priority, "high");

  // 2. Enqueue duplicate with identical idempotency key while active
  const job2 = await enqueueJob({
    orgId,
    createdBy: userId,
    jobType: "CITATION_REVERIFY",
    priority: "high",
    payload: { sample: true },
    idempotencyKey,
  });

  assert.equal(job1.id, job2.id, "Must return existing active job record for duplicate idempotency key");
});

test("Background Jobs: Worker acquisition with SKIP LOCKED and progress tracking", async () => {
  const { userId, orgId } = await getTestOrg();

  const job = await enqueueJob({
    orgId,
    createdBy: userId,
    jobType: "CITATION_REVERIFY",
    priority: "critical",
    payload: { contractId: "sample" },
  });

  const workerId = `test-worker-${Date.now()}`;
  const acquired = await acquireNextJobs(workerId, 5);

  assert.ok(acquired.length > 0);
  const matched = acquired.find((j) => j.id === job.id);
  assert.ok(matched, "Should acquire newly enqueued job");
  assert.equal(matched?.status, "RUNNING");
  assert.equal(matched?.locked_by, workerId);

  // Update progress
  await updateJobProgress(job.id, 50, "Halfway through audit");
  const inProgress = await getJobById(job.id, orgId);
  assert.equal(inProgress?.progress, 50);
  assert.equal(inProgress?.progress_stage, "Halfway through audit");

  // Complete job
  await completeJob(job.id, { auditedCount: 15 });
  const completed = await getJobById(job.id, orgId);
  assert.equal(completed?.status, "COMPLETED");
  assert.equal(completed?.progress, 100);
  assert.equal((completed?.result as any)?.auditedCount, 15);
});

test("Background Jobs: Bounded retries and exponential backoff on transient errors", async () => {
  const { userId, orgId } = await getTestOrg();

  const job = await enqueueJob({
    orgId,
    createdBy: userId,
    jobType: "CONTRACT_EXTRACTION",
    maxRetries: 2,
    payload: { contractId: "retry-test", rawText: "sample" },
  });

  // 1. Simulate first transient failure
  await failJob(job.id, new Error("Temporary network timeout"));
  const retry1 = await getJobById(job.id, orgId);
  assert.equal(retry1?.status, "RETRYING");
  assert.equal(retry1?.retry_count, 1);
  assert.ok(retry1?.next_run_at);

  // 2. Simulate second transient failure (reaches max retries)
  await failJob(job.id, new Error("API rate limited"));
  const retry2 = await getJobById(job.id, orgId);
  assert.equal(retry2?.status, "RETRYING");
  assert.equal(retry2?.retry_count, 2);

  // 3. Third failure exceeds maxRetries (2) -> transitions to FAILED
  await failJob(job.id, new Error("Final timeout"));
  const terminal = await getJobById(job.id, orgId);
  assert.equal(terminal?.status, "FAILED");
  assert.ok(terminal?.error_message?.includes("Final timeout"));
});

test("Background Jobs: Permanent failures fail immediately without retrying", async () => {
  const { userId, orgId } = await getTestOrg();

  const job = await enqueueJob({
    orgId,
    createdBy: userId,
    jobType: "CONTRACT_EXTRACTION",
    maxRetries: 3,
    payload: {},
  });

  await failJob(job.id, new PermanentJobError("Invalid contract payload format"));
  const failed = await getJobById(job.id, orgId);
  assert.equal(failed?.status, "FAILED");
  assert.equal(failed?.retry_count, 1);
  assert.ok(failed?.error_message?.includes("Invalid contract payload"));
});

test("Background Jobs: Manual operator retry and cancellation", async () => {
  const { userId, orgId } = await getTestOrg();

  // Create job and cancel it
  const job = await enqueueJob({
    orgId,
    createdBy: userId,
    jobType: "BATCH_EVAL_RUN",
    payload: { mode: "offline" },
  });

  const cancelled = await cancelJob(job.id, orgId);
  assert.equal(cancelled.status, "CANCELLED");

  // Re-queue cancelled job
  const retried = await retryJob(job.id, orgId);
  assert.equal(retried.status, "QUEUED");
});

test("Background Jobs: Worker iteration processes registered handlers", async () => {
  const { userId, orgId } = await getTestOrg();

  // Enqueue evaluation job
  const job = await enqueueJob({
    orgId,
    createdBy: userId,
    jobType: "BATCH_EVAL_RUN",
    payload: { mode: "offline" },
  });

  // Run worker tick
  const processedCount = await runWorkerIteration(`test-daemon-${Date.now()}`, 5);
  assert.ok(processedCount > 0, "Worker iteration should pick up and process job");

  const completed = await getJobById(job.id, orgId);
  assert.equal(completed?.status, "COMPLETED");
  assert.ok(completed?.result);
});

test("Background Jobs: Aggregates queue depth and duration metrics", async () => {
  const { orgId } = await getTestOrg();
  const metrics = await getJobQueueMetrics(orgId);

  assert.equal(typeof metrics.queuedCount, "number");
  assert.equal(typeof metrics.runningCount, "number");
  assert.equal(typeof metrics.completedCount, "number");
  assert.equal(typeof metrics.failedCount, "number");
  assert.equal(typeof metrics.failureRate, "number");
});

test.after(async () => {
  const { getPool } = await import("../lib/db.server.js");
  await getPool().end();
});
