import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";
import { buildDeterministicActionPlan } from "./action-plan-fallback";
import type { ActionPlan, ActionPlanInput } from "./action-plan-types";

export const generateActionPlan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: ActionPlanInput) => {
    if (!input || typeof input !== "object") throw new Error("Invalid input");
    const text = String(input.regulationText ?? "").trim();
    if (!text) throw new Error("Regulation text required");
    if (!Array.isArray(input.impacts)) throw new Error("Impacts required");
    return {
      regulationText: text.slice(0, 20000),
      summary: input.summary,
      impacts: input.impacts,
      sources: input.sources,
    };
  })
  .handler(async ({ data, context }): Promise<ActionPlan> => {
    const { orgId } = context;
    const { query } = await import("./db.server");
    const { coerceActionPlan } = await import("./action-plan.server");
    const { chatCompletion, resolveAiProvider } = await import("./ai.server");

    // Server-side entitlement gate: action plans drawn on monthly allowance
    if (orgId) {
      try {
        await query(`SELECT assert_within_quota($1, 'generate_action_plan')`, [orgId]);
      } catch (quotaErr) {
        throw new Error(quotaErr instanceof Error ? quotaErr.message : "Quota exceeded");
      }
    }

    const provider = resolveAiProvider();
    if (provider.kind === "none") {
      return buildDeterministicActionPlan(data);
    }

    const system = `You are a senior compliance officer drafting a remediation action plan for legal review. Return STRICT JSON only:
{
  "policy_draft": string,
  "amendments": [{"contract_id": string, "contract_name": string, "suggestion": string, "rationale": string, "clause_quote": string, "citation": string}],
  "tech_fixes": [{"priority": "P0"|"P1"|"P2", "title": string, "detail": string}]
}
Rules:
- policy_draft is ONE paragraph of proposed internal policy language (4–6 sentences).
- amendments MUST cover every impacted contract from the input, using its exact contract_id.
- Each amendment suggestion is one sentence of proposed contract language; rationale is one short sentence.
- If clause_quote is available in the input, include it.
- tech_fixes are 3–6 prioritized operational/engineering steps.
- Nothing is presented as final. All output is a draft for legal review.
- Output JSON only, no code fences, no prose.`;

    const user = `PROPOSED REGULATION / STATUTORY REQUIREMENT:
${data.regulationText}

SIMULATION SUMMARY:
${data.summary ?? "(none)"}

IMPACTED CONTRACTS WITH EVIDENCE:
${JSON.stringify(data.impacts)}

SOURCES / LEGAL INSTRUMENTS:
${JSON.stringify(data.sources ?? [])}`;

    try {
      const content = await chatCompletion({
        model: "gpt-4o",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      if (!content) return buildDeterministicActionPlan(data);

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return buildDeterministicActionPlan(data);
      }
      const plan = coerceActionPlan(parsed, data.sources);
      if (!plan) return buildDeterministicActionPlan(data);
      return plan;
    } catch (err) {
      console.error("[action-plan] exception", err);
      return buildDeterministicActionPlan(data);
    }
  });
