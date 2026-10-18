#!/usr/bin/env node
/**
 * Standalone Background Worker Process for ClauseGraph
 *
 * Usage:
 *   node --env-file=.env --import tsx src/scripts/run-worker.ts [--concurrency=2] [--interval=2000]
 */

import { startWorkerDaemon } from "../lib/jobs.worker.js";

async function main() {
  const args = process.argv.slice(2);
  const concurrencyArg = args.find((a) => a.startsWith("--concurrency="));
  const intervalArg = args.find((a) => a.startsWith("--interval="));

  const concurrency = concurrencyArg ? parseInt(concurrencyArg.split("=")[1], 10) : 2;
  const intervalMs = intervalArg ? parseInt(intervalArg.split("=")[1], 10) : 2000;
  const workerId = `worker-node-${process.pid}-${Date.now().toString(36)}`;

  console.log("===============================================================");
  console.log("          ClauseGraph Background Worker Process                ");
  console.log("===============================================================");
  console.log(`Worker ID      : ${workerId}`);
  console.log(`Concurrency    : ${concurrency} jobs per poll`);
  console.log(`Poll Interval  : ${intervalMs} ms`);
  console.log("Status         : Listening for QUEUED & RETRYING background jobs...");
  console.log("---------------------------------------------------------------");

  const stopDaemon = await startWorkerDaemon(workerId, intervalMs);

  const shutdown = () => {
    console.log("\n[Worker] Graceful shutdown initiated. Releasing active resources...");
    stopDaemon();
    setTimeout(() => {
      console.log("[Worker] Exited cleanly.");
      process.exit(0);
    }, 500);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[Worker Fatal Exception]:", err);
  process.exit(1);
});
