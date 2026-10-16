// scripts/worker.ts
// Durable background worker polling jobs with FOR UPDATE SKIP LOCKED (Phase 4 T4.1)

import { processNextJob, type JobRecord } from "../src/lib/jobs.server";
import {
  fetchFederalRegisterDocuments,
  ingestFederalRegisterDocuments,
} from "../src/lib/sources/federal-register.server";
import { syncEcfrSections } from "../src/lib/sources/ecfr.server";
import { syncEurLexEvents } from "../src/lib/sources/eurlex.server";
import { syncBdCuratedEvents } from "../src/lib/sources/bd-curated.server";

export async function handleJob(job: JobRecord): Promise<void> {
  console.log(
    `[Worker] Executing job ${job.id} (kind: ${job.kind}, attempt: ${job.attempts}/${job.max_attempts})`,
  );

  switch (job.kind) {
    case "ingest:federal-register": {
      const docs = await fetchFederalRegisterDocuments();
      const res = await ingestFederalRegisterDocuments(docs);
      console.log(
        `[Worker] Federal Register ingested: ${res.newEventsCount} new, ${res.updatedEventsCount} updated`,
      );
      break;
    }

    case "ingest:ecfr": {
      const res = await syncEcfrSections();
      console.log(`[Worker] eCFR synced: ${res.length} sections`);
      break;
    }

    case "ingest:eurlex": {
      const res = await syncEurLexEvents();
      console.log(`[Worker] EUR-Lex synced: ${res.newEvents} new events`);
      break;
    }

    case "ingest:bd-curated": {
      const res = await syncBdCuratedEvents();
      console.log(`[Worker] BD Curated synced: ${res.newEvents} new events`);
      break;
    }

    case "test:failing_job": {
      throw new Error("Simulated transient failure for job retry and dead-letter testing");
    }

    default:
      console.warn(`[Worker] Unknown job kind: ${job.kind}`);
  }
}

/**
 * Runs one poll iteration across available queued jobs.
 */
export async function pollOnce(): Promise<boolean> {
  return await processNextJob(handleJob);
}

/**
 * Main worker loop. Runs continuously until SIGINT/SIGTERM.
 */
async function startWorker() {
  const once = process.argv.includes("--once");
  console.log(
    `[Worker] Started ClauseGraph background worker (mode: ${once ? "single-run" : "continuous loop"})`,
  );

  if (once) {
    let processed = 0;
    while (await pollOnce()) {
      processed++;
    }
    console.log(`[Worker] Finished processing ${processed} queued jobs.`);
    process.exit(0);
  }

  let running = true;
  process.on("SIGINT", () => {
    console.log("[Worker] Shutting down...");
    running = false;
  });
  process.on("SIGTERM", () => {
    console.log("[Worker] Shutting down...");
    running = false;
  });

  while (running) {
    try {
      const didWork = await pollOnce();
      if (!didWork) {
        // Sleep 3 seconds before next poll when queue is empty
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (err) {
      console.error("[Worker] Polling loop error:", err);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  process.exit(0);
}

// Execute if run directly from CLI
if (process.argv[1]?.endsWith("worker.ts") || process.argv[1]?.endsWith("worker.js")) {
  startWorker().catch((err) => {
    console.error("[Worker] Fatal error:", err);
    process.exit(1);
  });
}
