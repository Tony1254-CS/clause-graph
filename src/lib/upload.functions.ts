import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";

export const startContractExtraction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: {
    name: string;
    counterparty: string;
    value: number;
    rawText: string;
    sourceFilePath?: string | null;
  }) => {
    const name = String(input?.name ?? "").trim();
    const counterparty = String(input?.counterparty ?? "").trim();
    const value = Number(input?.value ?? 0);
    const rawText = String(input?.rawText ?? "").trim();
    if (!name) throw new Error("Contract name required");
    if (!counterparty) throw new Error("Counterparty required");
    if (!Number.isFinite(value) || value < 0) throw new Error("Valid contract value required");
    if (rawText.length < 40) throw new Error("Contract text too short");
    if (rawText.length > 120_000) throw new Error("Contract text too long");
    return {
      name,
      counterparty,
      value,
      rawText,
      sourceFilePath: input?.sourceFilePath ?? null,
    };
  })
  .handler(async ({ data, context }) => {
    const { userId, orgId } = context;
    const { query, queryOne } = await import("./db.server");
    const { runContractExtraction } = await import("./upload.server");

    if (!orgId) throw new Error("Organization not found");

    // Enforce plan quota (Free 3, Pro 50, Team unlimited)
    try {
      await query(`SELECT assert_within_quota($1, 'upload_contract')`, [orgId]);
    } catch (quotaErr) {
      throw new Error(quotaErr instanceof Error ? quotaErr.message : "Upload quota exceeded");
    }

    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO public.contracts 
        (org_id, name, counterparty, value, extraction_status, is_sample, uploaded_by, source_file_url)
       VALUES ($1, $2, $3, $4, 'processing', false, $5, $6)
       RETURNING id`,
      [
        orgId,
        data.name,
        data.counterparty,
        data.value,
        userId,
        data.sourceFilePath,
      ]
    );

    if (!inserted) throw new Error("Failed to create contract record");
    const contractId = inserted.id;

    // Enqueue background extraction job with idempotency and transaction safety
    try {
      const { enqueueJob } = await import("./jobs.server");
      await enqueueJob({
        orgId,
        createdBy: userId,
        jobType: "CONTRACT_EXTRACTION",
        priority: "high",
        payload: { contractId, rawText: data.rawText },
        idempotencyKey: `contract-extract-${contractId}`,
      });
    } catch (queueErr) {
      console.warn("[upload.functions] queue insert error, falling back to synchronous execution:", queueErr);
      // Resilient fallback: execute extraction directly if queue unreachable
      void runContractExtraction(contractId, data.rawText).catch(async (err) => {
        console.error("[upload.functions] extraction failed", contractId, err);
        try {
          await query(
            `UPDATE public.contracts 
             SET extraction_status = 'failed', extraction_error = 'Extraction could not be completed. Try uploading again.'
             WHERE id = $1 AND extraction_status = 'processing'`,
            [contractId]
          );
        } catch (e) {
          console.error("extraction status write failed", contractId, e);
        }
      });
    }

    return { id: contractId };
  });

export const deleteContract = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { id: string }) => {
    const id = String(input?.id ?? "");
    if (!id) throw new Error("id required");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { query } = await import("./db.server");
    // Only non-sample contracts belonging to user's org can be deleted
    await query(
      `DELETE FROM public.contracts WHERE id = $1 AND org_id = $2 AND is_sample = false`,
      [data.id, context.orgId]
    );
    return { ok: true };
  });
