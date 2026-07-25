import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runContractExtraction } from "./upload.server";

export const startContractExtraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
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
    const { supabase, userId } = context;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile?.org_id) throw new Error("Organization not found");

    // Enforce plan quota (Free 3, Pro 50, Team unlimited)
    const { error: quotaErr } = await supabase.rpc("assert_within_quota", {
      _org: profile.org_id,
      _action: "upload_contract",
    });
    if (quotaErr) throw new Error(quotaErr.message);

    const { data: inserted, error: iErr } = await supabase
      .from("contracts")
      .insert({
        org_id: profile.org_id,
        name: data.name,
        counterparty: data.counterparty,
        value: data.value,
        extraction_status: "processing",
        is_sample: false,
        uploaded_by: userId,
        source_file_url: data.sourceFilePath,
      })
      .select("id")
      .single();
    if (iErr) throw iErr;
    const contractId = inserted.id;

    // Fire-and-forget the AI extraction; the client polls extraction_status.
    // If even the failure-write inside the pipeline throws, mark the row failed
    // here so the UI never polls a contract that is stuck on "processing".
    void runContractExtraction(contractId, data.rawText).catch(async (err) => {
      console.error("extraction failed", contractId, err);
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("contracts")
          .update({
            extraction_status: "failed",
            extraction_error: "Extraction could not be completed. Try uploading again.",
          })
          .eq("id", contractId)
          .eq("extraction_status", "processing");
      } catch (e) {
        console.error("extraction status write failed", contractId, e);
      }
    });


    return { id: contractId };
  });

export const deleteContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    const id = String(input?.id ?? "");
    if (!id) throw new Error("id required");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // RLS gates the delete to the caller's org; sample rows are protected by policy.
    const { error } = await supabase.from("contracts").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
