type ExtractedClause = { text: string; linked_regs: string[] };

const SYSTEM = `You are a contracts analyst. Given a contract's raw text and a regulatory ontology, do TWO things:
1. Segment the contract into distinct clauses (numbered sections, obligations, definitions — merge tiny fragments; typical contract yields 5-20 clauses).
2. For each clause, list the IDs of any regulations in the ontology it plausibly cites or is governed by (linked_regs). Only include IDs that exist in the ontology. Empty array is fine.

Return STRICT JSON only:
{"clauses":[{"text":string,"linked_regs":string[]}]}`;

export async function runContractExtraction(contractId: string, rawText: string) {
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