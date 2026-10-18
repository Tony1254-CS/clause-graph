/**
 * Background Job Worker Registry & Execution Engine
 *
 * Implements registered job handlers for:
 * 1. CONTRACT_EXTRACTION: Clause segmentation, ontology linking, and database storage.
 * 2. CITATION_REVERIFY: Re-verifying stored contracts and clauses against updated authoritative corpus.
 * 3. BATCH_EVAL_RUN: Running the AI evaluation benchmark harness asynchronously.
 */

import type { JobHandler, JobHandlerContext, JobRecord, JobType } from "./jobs.types";
import {
  acquireNextJobs,
  completeJob,
  failJob,
  PermanentJobError,
  updateJobProgress,
} from "./jobs.server";

// Handlers map
const HANDLERS: Partial<Record<JobType, JobHandler>> = {
  // ── 1. CONTRACT_EXTRACTION ──────────────────────────────────────────
  CONTRACT_EXTRACTION: async (payload: { contractId: string; rawText: string }, ctx) => {
    if (!payload?.contractId || !payload?.rawText) {
      throw new PermanentJobError("Invalid contract extraction payload: contractId and rawText required");
    }

    await ctx.updateProgress(15, "Loading regulatory ontology");
    const { query, transaction } = await import("./db.server");
    const { chatCompletion } = await import("./ai.server");

    const regs = await query<{
      id: string;
      jurisdiction: string;
      title: string;
      summary: string;
    }>(`SELECT id, jurisdiction, title, summary FROM public.regulations`);

    const ontology = (regs ?? []).map((r) => ({
      id: r.id,
      jurisdiction: r.jurisdiction,
      title: r.title,
      summary: r.summary,
    }));

    await ctx.updateProgress(35, "Segmenting clauses via AI engine");

    const systemPrompt = `You are a contracts analyst. Given a contract's raw text and a regulatory ontology, do TWO things:
1. Segment the contract into distinct clauses (numbered sections, obligations, definitions — merge tiny fragments; typical contract yields 5-20 clauses).
2. For each clause, list the IDs of any regulations in the ontology it plausibly cites or is governed by (linked_regs). Only include IDs that exist in the ontology. Empty array is fine.

Return STRICT JSON only:
{"clauses":[{"text":string,"linked_regs":string[]}]}`;

    const content = await chatCompletion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `REGULATORY ONTOLOGY:\n${JSON.stringify(ontology)}\n\nCONTRACT TEXT:\n${payload.rawText}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      timeoutMs: 90_000,
    });

    if (!content) {
      throw new Error("AI extraction returned empty response (transient failure)");
    }

    await ctx.updateProgress(70, "Persisting extracted clauses");

    let parsed: { clauses?: Array<{ text: string; linked_regs?: string[] }> };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Failed to parse AI extraction JSON");
    }

    const validRegIds = new Set(ontology.map((r) => r.id));
    const clauses = (parsed.clauses ?? [])
      .filter((c) => c && typeof c.text === "string" && c.text.trim().length > 0)
      .map((c) => ({
        text: c.text.trim(),
        linked_regs: (c.linked_regs ?? []).filter((id) => validRegIds.has(id)),
      }));

    if (clauses.length === 0) {
      throw new PermanentJobError("No legal clauses could be extracted from contract text");
    }

    // Persist extracted clauses and mark complete
    await transaction(async (client) => {
      // Clear any prior extraction attempts
      await client.query(`DELETE FROM public.clauses WHERE contract_id = $1::uuid`, [payload.contractId]);

      for (let idx = 0; idx < clauses.length; idx++) {
        const c = clauses[idx];
        await client.query(
          `INSERT INTO public.clauses (contract_id, text, linked_regs, position, confidence)
           VALUES ($1::uuid, $2, $3, $4, 0.95)`,
          [payload.contractId, c.text, c.linked_regs, idx]
        );
      }

      await client.query(
        `UPDATE public.contracts 
         SET extraction_status = 'complete', extraction_error = null 
         WHERE id = $1::uuid`,
        [payload.contractId]
      );
    });

    await ctx.updateProgress(100, "Extraction complete");
    return { extractedClauseCount: clauses.length, contractId: payload.contractId };
  },

  // ── 2. CITATION_REVERIFY ───────────────────────────────────────────
  CITATION_REVERIFY: async (payload: { contractId?: string }, ctx) => {
    await ctx.updateProgress(20, "Scanning contract clauses");
    const { query } = await import("./db.server");
    const { verifyCitations, mapDbRegulationToMetadata } = await import("./citation-verifier");

    const regRows = await query(`SELECT id, jurisdiction, title, summary, obligations FROM public.regulations`);
    const dbMetadata = (regRows ?? []).map((r: any) =>
      mapDbRegulationToMetadata({
        id: r.id,
        title: r.title,
        jurisdiction: r.jurisdiction,
        summary: r.summary,
        obligations: r.obligations,
      })
    );

    let whereClause = "WHERE c.org_id = $1::uuid";
    const params: unknown[] = [ctx.orgId];
    if (payload?.contractId) {
      whereClause += " AND cl.contract_id = $2::uuid";
      params.push(payload.contractId);
    }

    const clauses = await query<{ id: string; text: string; contract_id: string }>(
      `SELECT cl.id, cl.text, cl.contract_id
       FROM public.clauses cl
       JOIN public.contracts c ON c.id = cl.contract_id
       ${whereClause}`,
      params
    );

    await ctx.updateProgress(50, `Auditing citations across ${clauses?.length ?? 0} clauses`);

    let totalVerified = 0;
    let staleFound = 0;

    for (const cl of clauses ?? []) {
      const summary = verifyCitations(cl.text, dbMetadata);
      totalVerified += summary.verifiedCount;
      if (summary.hasStaleCitations) {
        staleFound++;
      }
    }

    await ctx.updateProgress(100, "Citation audit complete");
    return {
      auditedClauses: clauses?.length ?? 0,
      verifiedCount: totalVerified,
      staleFindingsCount: staleFound,
    };
  },

  // ── 3. BATCH_EVAL_RUN ─────────────────────────────────────────────
  BATCH_EVAL_RUN: async (payload: { mode?: "offline" | "live" }, ctx) => {
    await ctx.updateProgress(10, "Initializing evaluation suite");
    const { runEvaluationHarness } = await import("./eval.runner");

    await ctx.updateProgress(40, "Running benchmark test cases");
    const report = await runEvaluationHarness({
      mode: payload?.mode ?? "offline",
      outputDir: "reports/eval",
    });

    await ctx.updateProgress(100, "Evaluation complete");
    return {
      passRate: report.summary.pass_rate,
      totalTestCases: report.summary.total_test_cases,
      passedTestCases: report.summary.passed_test_cases,
      citationF1: report.summary.citation_f1_avg,
      staleAccuracy: report.summary.stale_detection_f1,
      unsupportedClaimRate: report.summary.unsupported_claim_rate,
    };
  },

  // ── 4. LEGAL_SOURCE_CHECK ──────────────────────────────────────────
  LEGAL_SOURCE_CHECK: async (payload: { sourceId: string; mockPayload?: any }, ctx) => {
    if (!payload?.sourceId) {
      throw new PermanentJobError("Invalid source check payload: sourceId required");
    }

    await ctx.updateProgress(15, `Checking authoritative legal source ${payload.sourceId}`);
    const { executeLegalSourceCheck } = await import("./document-update.server");

    const result = await executeLegalSourceCheck(payload.sourceId, payload.mockPayload);

    await ctx.updateProgress(100, `Completed source check for ${payload.sourceId}`);
    return result;
  },

  // ── 5. SYSTEM_BACKUP_RUN ───────────────────────────────────────────
  SYSTEM_BACKUP_RUN: async (payload: { orgId: string; runRestoreTest?: boolean; createdBy?: string }, ctx) => {
    if (!payload?.orgId) {
      throw new PermanentJobError("Invalid backup run payload: orgId required");
    }

    await ctx.updateProgress(20, "Generating ACID database & storage snapshot");
    const { createSystemBackup, runIsolatedRestoreTest } = await import("./document-update.server");

    const backup = await createSystemBackup(payload.orgId, "SCHEDULED", payload.createdBy);

    let restoreResult = null;
    if (payload.runRestoreTest) {
      await ctx.updateProgress(70, "Executing isolated restore test verification");
      restoreResult = await runIsolatedRestoreTest(backup.id);
    }

    await ctx.updateProgress(100, "Backup and integrity check completed");
    return {
      backupId: backup.id,
      storagePath: backup.storage_path,
      sha256: backup.sha256_checksum,
      fileSizeBytes: backup.file_size_bytes,
      restoreResult,
    };
  },
};

/**
 * Execute a single background job safely
 */
export async function processJob(job: JobRecord): Promise<void> {
  const handler = HANDLERS[job.job_type];
  if (!handler) {
    await failJob(
      job.id,
      new PermanentJobError(`No registered handler for job type: ${job.job_type}`),
      true
    );
    return;
  }

  const ctx: JobHandlerContext = {
    jobId: job.id,
    orgId: job.org_id,
    attempt: (job.retry_count || 0) + 1,
    updateProgress: (p, stage) => updateJobProgress(job.id, p, stage),
  };

  try {
    const result = await handler(job.payload, ctx);
    await completeJob(job.id, result);
  } catch (err) {
    const isPermanent = err instanceof PermanentJobError;
    await failJob(job.id, err, isPermanent);
  }
}

/**
 * Worker polling tick: acquire next batch and process sequentially/concurrently
 */
export async function runWorkerIteration(
  workerId = `worker-${process.pid}`,
  batchSize = 2
): Promise<number> {
  const jobs = await acquireNextJobs(workerId, batchSize);
  if (jobs.length === 0) return 0;

  // Process batch
  await Promise.allSettled(jobs.map((job) => processJob(job)));
  return jobs.length;
}

/**
 * Long-running worker daemon loop
 */
export async function startWorkerDaemon(
  workerId = `worker-${process.pid}-${Date.now().toString(36)}`,
  pollIntervalMs = 2000
): Promise<() => void> {
  let isRunning = true;
  console.log(`[Worker] Started background worker ${workerId} (interval: ${pollIntervalMs}ms)`);

  const loop = async () => {
    while (isRunning) {
      try {
        const count = await runWorkerIteration(workerId);
        if (count === 0) {
          await new Promise((res) => setTimeout(res, pollIntervalMs));
        }
      } catch (err) {
        console.error("[Worker Loop Exception]:", err);
        await new Promise((res) => setTimeout(res, pollIntervalMs));
      }
    }
  };

  void loop();

  return () => {
    console.log(`[Worker] Stopping worker ${workerId}...`);
    isRunning = false;
  };
}
