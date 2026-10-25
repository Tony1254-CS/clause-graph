# Community 14

> 32 nodes · cohesion 0.15

## Key Concepts

- **jobs.server.ts** (42 connections) — `src/lib/jobs.server.ts`
- **query()** (26 connections) — `src/lib/db.server.ts`
- **jobs.worker.ts** (23 connections) — `src/lib/jobs.worker.ts`
- **jobs-queue.test.ts** (20 connections) — `src/tests/jobs-queue.test.ts`
- **jobs.types.ts** (14 connections) — `src/lib/jobs.types.ts`
- **processJob()** (7 connections) — `src/lib/jobs.worker.ts`
- **acquireNextJobs()** (6 connections) — `src/lib/jobs.server.ts`
- **JobRecord** (6 connections) — `src/lib/jobs.types.ts`
- **completeJob()** (5 connections) — `src/lib/jobs.server.ts`
- **failJob()** (5 connections) — `src/lib/jobs.server.ts`
- **updateJobProgress()** (5 connections) — `src/lib/jobs.server.ts`
- **JobType** (5 connections) — `src/lib/jobs.types.ts`
- **runWorkerIteration()** (5 connections) — `src/lib/jobs.worker.ts`
- **listJobs()** (4 connections) — `src/lib/jobs.server.ts`
- **startWorkerDaemon()** (4 connections) — `src/lib/jobs.worker.ts`
- **JobFilter** (3 connections) — `src/lib/jobs.types.ts`
- **JobHandler** (3 connections) — `src/lib/jobs.types.ts`
- **JobHandlerContext** (3 connections) — `src/lib/jobs.types.ts`
- **run-worker.ts** (3 connections) — `src/scripts/run-worker.ts`
- **getJobFn** (2 connections) — `src/lib/jobs.functions.ts`
- **cancelJob()** (2 connections) — `src/lib/jobs.server.ts`
- **enqueueJob()** (2 connections) — `src/lib/jobs.server.ts`
- **getJobById()** (2 connections) — `src/lib/jobs.server.ts`
- **getJobQueueMetrics()** (2 connections) — `src/lib/jobs.server.ts`
- **retryJob()** (2 connections) — `src/lib/jobs.server.ts`
- *... and 7 more nodes in this community*

## Relationships

- [Community 16](Community_16.md) (17 shared connections)
- [Community 11](Community_11.md) (15 shared connections)
- [Community 29](Community_29.md) (13 shared connections)
- [Community 3](Community_3.md) (6 shared connections)
- [Community 1](Community_1.md) (4 shared connections)
- [Community 44](Community_44.md) (3 shared connections)
- [Community 13](Community_13.md) (2 shared connections)
- [Community 59](Community_59.md) (1 shared connections)
- [Community 6](Community_6.md) (1 shared connections)
- [Community 27](Community_27.md) (1 shared connections)
- [Community 21](Community_21.md) (1 shared connections)

## Source Files

- `src/lib/db.server.ts`
- `src/lib/jobs.functions.ts`
- `src/lib/jobs.server.ts`
- `src/lib/jobs.types.ts`
- `src/lib/jobs.worker.ts`
- `src/scripts/run-worker.ts`
- `src/tests/jobs-queue.test.ts`

## Audit Trail

- EXTRACTED: 138 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*