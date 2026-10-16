import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";

export const startContractExtraction = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (input: {
      name: string;
      counterparty: string;
      value: number;
      rawText?: string | null;
      fileBase64?: string | null;
      fileName?: string | null;
      sourceFilePath?: string | null;
    }) => {
      const name = String(input?.name ?? "").trim();
      const counterparty = String(input?.counterparty ?? "").trim();
      const value = Number(input?.value ?? 0);
      const rawText = input?.rawText ? String(input.rawText).trim() : null;
      const fileBase64 = input?.fileBase64 ? String(input.fileBase64).trim() : null;
      const fileName = input?.fileName ? String(input.fileName).trim() : null;

      if (!name) throw new Error("Contract name required");
      if (!counterparty) throw new Error("Counterparty required");
      if (!Number.isFinite(value) || value < 0) throw new Error("Valid contract value required");
      if (!rawText && !fileBase64) throw new Error("Contract text or file is required");

      return {
        name,
        counterparty,
        value,
        rawText,
        fileBase64,
        fileName,
        sourceFilePath: input?.sourceFilePath ?? fileName ?? null,
      };
    },
  )
  .handler(async ({ data, context }) => {
    const { userId, orgId } = context;
    const { query, queryOne } = await import("./db.server");
    const { extractTextFromFile, runContractExtraction } = await import("./upload.server");
    const { enqueueJob } = await import("./jobs.server");

    if (!orgId) throw new Error("Organization not found");

    // Enforce plan quota (Free 3, Pro 50, Team unlimited)
    try {
      await query(`SELECT assert_within_quota($1, 'upload_contract')`, [orgId]);
    } catch (quotaErr) {
      throw new Error(quotaErr instanceof Error ? quotaErr.message : "Upload quota exceeded");
    }

    // Extract text from uploaded binary file (PDF/DOCX/TXT) or use provided raw text
    let contractText = data.rawText || "";
    if (data.fileBase64 && data.fileName) {
      const buffer = Buffer.from(data.fileBase64, "base64");
      contractText = await extractTextFromFile(buffer, data.fileName);
    }

    if (contractText.length < 40) {
      throw new Error("Extracted contract text is too short to contain legal clauses");
    }

    const inserted = await queryOne<{ id: string }>(
      `INSERT INTO public.contracts 
        (org_id, name, counterparty, value, extraction_status, is_sample, uploaded_by, source_file_url)
       VALUES ($1, $2, $3, $4, 'processing', false, $5, $6)
       RETURNING id`,
      [orgId, data.name, data.counterparty, data.value, userId, data.sourceFilePath],
    );

    if (!inserted) throw new Error("Failed to create contract record");
    const contractId = inserted.id;

    // Enqueue durable background job in Postgres jobs table
    try {
      await enqueueJob(
        "ingest:contract",
        { contractId, textLength: contractText.length, fileName: data.fileName },
        { orgId },
      );
    } catch (jobErr) {
      console.warn(
        "[upload.functions] Failed to record durable job, processing synchronously",
        jobErr,
      );
    }

    // Asynchronously segment clauses and update contract status
    void runContractExtraction(contractId, contractText).catch(async (err) => {
      console.error("[upload.functions] extraction failed", contractId, err);
      try {
        await query(
          `UPDATE public.contracts 
           SET extraction_status = 'failed', extraction_error = 'Extraction could not be completed. Try uploading again.'
           WHERE id = $1 AND extraction_status = 'processing'`,
          [contractId],
        );
      } catch (e) {
        console.error("extraction status write failed", contractId, e);
      }
    });

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
      [data.id, context.orgId],
    );
    return { ok: true };
  });
