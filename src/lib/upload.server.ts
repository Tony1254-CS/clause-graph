import { query, queryOne, transaction } from "./db.server";
import { chatCompletion } from "./ai.server";

type ExtractedClause = { text: string; linked_regs: string[] };

const SYSTEM = `You are a contracts analyst. Given a contract's raw text and a regulatory ontology, do TWO things:
1. Segment the contract into distinct clauses (numbered sections, obligations, definitions — merge tiny fragments; typical contract yields 5-20 clauses).
2. For each clause, list the IDs of any regulations in the ontology it plausibly cites or is governed by (linked_regs). Only include IDs that exist in the ontology. Empty array is fine.

Return STRICT JSON only:
{"clauses":[{"text":string,"linked_regs":string[]}]}`;

export async function runContractExtraction(contractId: string, rawText: string) {
  try {
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

    const content = await chatCompletion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `REGULATORY ONTOLOGY:\n${JSON.stringify(ontology)}\n\nCONTRACT TEXT:\n${rawText}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      timeoutMs: 90_000,
    });

    if (!content) throw new Error("AI extraction returned empty response");
    const parsed = JSON.parse(content) as { clauses?: ExtractedClause[] };
    const validRegIds = new Set(ontology.map((r) => r.id));
    const clauses: ExtractedClause[] = (parsed.clauses ?? [])
      .filter((c) => c && typeof c.text === "string" && c.text.trim().length > 0)
      .map((c) => ({
        text: c.text.trim(),
        linked_regs: (c.linked_regs ?? []).filter((id) => validRegIds.has(id)),
      }));

    if (clauses.length === 0) throw new Error("No clauses extracted");

    // Insert extracted clauses in a transaction
    await transaction(async (client) => {
      for (let idx = 0; idx < clauses.length; idx++) {
        const c = clauses[idx];
        await client.query(
          `INSERT INTO public.clauses (contract_id, text, linked_regs, position, confidence)
           VALUES ($1, $2, $3, $4, 0.9)`,
          [contractId, c.text, c.linked_regs, idx]
        );
      }

      await client.query(
        `UPDATE public.contracts 
         SET extraction_status = 'complete', extraction_error = null 
         WHERE id = $1`,
        [contractId]
      );
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[upload.server] Extraction failed:", contractId, msg);
    await query(
      `UPDATE public.contracts 
       SET extraction_status = 'failed', extraction_error = $1 
       WHERE id = $2`,
      [msg.slice(0, 500), contractId]
    );
  }
}