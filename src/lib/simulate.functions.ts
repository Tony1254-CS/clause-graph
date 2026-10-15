import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";
import { fallbackSimulation } from "./simulate-fallback";
import type { SimulationResult, SimulateInput } from "./simulate-types";

export const simulateImpact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: SimulateInput) => {
    const text = String(input?.regulationText ?? "").trim();
    if (!text) throw new Error("Regulation text is required");
    if (text.length > 20000) throw new Error("Regulation text too long");
    const rt = input?.runType;
    const runType: "reactive" | "forecast" | "what_if" =
      rt === "forecast" || rt === "what_if" ? rt : "reactive";
    const regulationId = input?.regulationId ? String(input.regulationId) : undefined;
    return { regulationText: text, runType, regulationId };
  })
  .handler(async ({ data, context }): Promise<SimulationResult> => {
    const { userId, orgId } = context;
    const { query } = await import("./db.server");
    const { coerceImpacts } = await import("./simulate.server");
    const { chatCompletion } = await import("./ai.server");

    // Enforce simulation quota against caller's org in PostgreSQL
    if (orgId) {
      try {
        await query(`SELECT assert_within_quota($1, 'run_simulation')`, [orgId]);
      } catch (quotaErr) {
        throw new Error(quotaErr instanceof Error ? quotaErr.message : "Quota exceeded");
      }
    }

    const [contractRows, regRows] = await Promise.all([
      query<{
        id: string;
        name: string;
        counterparty: string;
        value: number | string;
        clauses: Array<{ text: string; linked_regs: string[] | null }> | null;
      }>(
        `SELECT 
          c.id, c.name, c.counterparty, c.value,
          COALESCE(
            json_agg(
              json_build_object('text', cl.text, 'linked_regs', cl.linked_regs)
            ) FILTER (WHERE cl.id IS NOT NULL),
            '[]'::json
          ) AS clauses
         FROM public.contracts c
         LEFT JOIN public.clauses cl ON cl.contract_id = c.id
         WHERE c.org_id = $1
         GROUP BY c.id`,
        [orgId]
      ),
      query(
        `SELECT id, jurisdiction, title, summary, obligations FROM public.regulations`
      ),
    ]);

    const contracts = contractRows ?? [];
    const validIds = new Set(contracts.map((c) => c.id));

    if (contracts.length === 0) return { ...fallbackSimulation };

    const contractContext = contracts.map((c) => ({
      id: c.id,
      name: c.name,
      counterparty: c.counterparty,
      value: typeof c.value === "string" ? Number(c.value) : c.value,
      clauses: (c.clauses ?? []).map((cl) => ({
        text: cl.text,
        linked_regs: cl.linked_regs ?? [],
      })),
    }));

    const system = `You are a legal compliance analyst. Given a proposed regulation and a portfolio of contracts, identify which contracts are materially impacted. Return STRICT JSON only, matching this schema:
{"summary": string, "impacts": [{"contract_id": string, "severity": "low"|"medium"|"high", "suggested_amendment": string}]}
Rules:
- contract_id MUST match an id from the provided contracts list.
- Include only contracts with a real, defensible impact (skip contracts that are clearly unaffected).
- suggested_amendment MUST be exactly one sentence of amendment language.
- summary is one sentence describing the regulation's overall thrust.
- Output JSON only, no prose, no code fences.`;

    const user = `PROPOSED REGULATION:
${data.regulationText}

REGULATORY ONTOLOGY (for cross-reference):
${JSON.stringify(regRows ?? [])}

CONTRACT PORTFOLIO:
${JSON.stringify(contractContext)}`;

    let result: SimulationResult = { ...fallbackSimulation };
    try {
      const content = await chatCompletion({
        model: "gpt-4o",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      if (content) {
        try {
          const parsed = JSON.parse(content);
          const impacts = coerceImpacts(parsed, validIds);
          if (impacts && impacts.length > 0) {
            const summary =
              typeof (parsed as { summary?: unknown }).summary === "string"
                ? (parsed as { summary: string }).summary
                : undefined;
            result = { impacts, summary, fallback: false };
          }
        } catch {
          /* fallback */
        }
      }
    } catch (err) {
      console.error("[simulate] exception", err);
    }

    // Persist for audit history in PostgreSQL (best-effort)
    if (orgId) {
      try {
        await query(
          `INSERT INTO public.simulation_runs (org_id, input_regulation_text, result_json, triggered_by, run_type)
           VALUES ($1, $2, $3::jsonb, $4, $5)`,
          [
            orgId,
            data.regulationText,
            JSON.stringify(result),
            userId,
            data.runType,
          ]
        );
      } catch (insertErr) {
        console.error("[simulate] persist error", insertErr);
      }
    }

    return result;
  });
