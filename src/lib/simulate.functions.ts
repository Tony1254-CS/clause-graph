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

    // Citation Verification Step: Extract and verify references without modifying original text
    try {
      const { verifyCitations, mapDbRegulationToMetadata } = await import("./citation-verifier");
      const dbMetadata = (regRows ?? []).map((r: any) =>
        mapDbRegulationToMetadata({
          id: r.id,
          title: r.title,
          jurisdiction: r.jurisdiction,
          summary: r.summary,
          obligations: r.obligations,
        })
      );
      // Verify both input regulation text and AI-generated summary/amendments
      const combinedTextToVerify = [
        data.regulationText,
        result.summary ?? "",
        ...result.impacts.map((i) => i.suggested_amendment),
      ].join("\n\n");

      result.citation_verification = verifyCitations(combinedTextToVerify, dbMetadata);
    } catch (verifyErr) {
      console.error("[simulate] citation verification error", verifyErr);
    }

    // Persist for audit history in PostgreSQL (best-effort)
    let persistedRunId: string | undefined = undefined;
    if (orgId) {
      try {
        const insertRes = await query<{ id: string }>(
          `INSERT INTO public.simulation_runs (org_id, input_regulation_text, result_json, triggered_by, run_type)
           VALUES ($1, $2, $3::jsonb, $4, $5)
           RETURNING id`,
          [
            orgId,
            data.regulationText,
            JSON.stringify(result),
            userId,
            data.runType,
          ]
        );
        persistedRunId = insertRes?.[0]?.id;
      } catch (insertErr) {
        console.error("[simulate] persist error", insertErr);
      }
    }

    // Auto Review Trigger: Automatically enqueue for human review if risk rules fired
    if (orgId && result.citation_verification?.requiresHumanReview) {
      try {
        const { createReviewTaskIfTriggered } = await import("./review.server");
        const triggerType =
          result.citation_verification.repealedCount > 0
            ? "REPEALED_CITATION"
            : result.citation_verification.supersededCount > 0
              ? "SUPERSEDED_CITATION"
              : "UNVERIFIED_CITATION";

        const warnings = result.citation_verification.findings
          .map((f) => f.warningMessage)
          .filter((w): w is string => Boolean(w));

        await createReviewTaskIfTriggered({
          orgId,
          triggerType,
          riskLevel: result.citation_verification.highestRisk,
          title: `Simulation Audit: ${result.summary?.slice(0, 80) || "Regulatory blast radius review"}`,
          description: `Flagged automatically: ${result.citation_verification.repealedCount} repealed, ${result.citation_verification.supersededCount} superseded, or unverified legal references detected.`,
          sourceType: "simulation",
          sourceId: persistedRunId,
          originalAiResponse: JSON.stringify(result),
          citationsSnapshot: result.citation_verification.findings,
          warningsSnapshot: warnings,
          createdBy: userId,
        });
      } catch (reviewQueueErr) {
        console.error("[simulate] auto review task creation failed:", reviewQueueErr);
      }
    }

    return result;
  });
