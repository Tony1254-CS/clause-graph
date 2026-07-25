import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ExtractedClause = { text: string; linked_regs: string[] };

const SYSTEM = `You are a contracts analyst. Given a contract's raw text and a regulatory ontology, do TWO things:
1. Segment the contract into distinct clauses (numbered sections, obligations, definitions — merge tiny fragments; typical contract yields 5-20 clauses).
2. For each clause, list the IDs of any regulations in the ontology it plausibly cites or is governed by (linked_regs). Only include IDs that exist in the ontology. Empty array is fine.

Return STRICT JSON only:
{"clauses":[{"text":string,"linked_regs":string[]}]}`;

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
    void runExtraction(contractId, data.rawText).catch((err) => {
      console.error("extraction failed", contractId, err);
    });

    return { id: contractId };
  });

async function runExtraction(contractId: string, rawText: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const { data: regs } = await supabaseAdmin
      .from("regulations")
      .select("id, jurisdiction, title, summary");
    const ontology = (regs ?? []).map((r) => ({
      id: r.id,
      jurisdiction: r.jurisdiction,
      title: r.title,
      summary: r.summary,
    }));

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90_000);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `REGULATORY ONTOLOGY:\n${JSON.stringify(ontology)}\n\nCONTRACT TEXT:\n${rawText}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI gateway ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(content) as { clauses?: ExtractedClause[] };
    const validRegIds = new Set(ontology.map((r) => r.id));
    const clauses: ExtractedClause[] = (parsed.clauses ?? [])
      .filter((c) => c && typeof c.text === "string" && c.text.trim().length > 0)
      .map((c) => ({
        text: c.text.trim(),
        linked_regs: (c.linked_regs ?? []).filter((id) => validRegIds.has(id)),
      }));

    if (clauses.length === 0) throw new Error("No clauses extracted");

    const clauseRows = clauses.map((c, idx) => ({
      contract_id: contractId,
      text: c.text,
      linked_regs: c.linked_regs,
      position: idx,
      confidence: 0.9,
    }));
    const { error: clErr } = await supabaseAdmin.from("clauses").insert(clauseRows);
    if (clErr) throw clErr;

    await supabaseAdmin
      .from("contracts")
      .update({ extraction_status: "complete", extraction_error: null })
      .eq("id", contractId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("contracts")
      .update({ extraction_status: "failed", extraction_error: msg.slice(0, 500) })
      .eq("id", contractId);
  }
}

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
