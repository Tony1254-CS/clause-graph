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

    // Log contract.uploaded audit event (§5)
    try {
      const { logAuditEvent } = await import("./audit/audit.server");
      await logAuditEvent({
        orgId,
        action: "contract.uploaded",
        entityType: "contract",
        entityId: contractId,
        actorId: userId,
        actorRole: (context.role as any) || "member",
        after: {
          name: data.name,
          counterparty: data.counterparty,
          value: data.value,
          source_file_url: data.sourceFilePath,
        },
      });
    } catch (auditErr) {
      console.warn("[upload.functions] audit log error on upload:", auditErr);
    }

    // Fire-and-forget the AI extraction; the client polls extraction_status.
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

    // Log contract.deleted audit event (§5)
    try {
      const { logAuditEvent } = await import("./audit/audit.server");
      await logAuditEvent({
        orgId: context.orgId,
        action: "contract.deleted",
        entityType: "contract",
        entityId: data.id,
        actorId: context.userId,
        actorRole: (context.role as any) || "member",
      });
    } catch (auditErr) {
      console.warn("[upload.functions] audit log error on delete:", auditErr);
    }

    return { ok: true };
  });
