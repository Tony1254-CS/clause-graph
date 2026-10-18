import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";
import { fallbackActionPlan } from "./action-plan-fallback";
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
    };
  })
  .handler(async ({ data, context }): Promise<ActionPlan> => {
    const { orgId } = context;
    const { query } = await import("./db.server");
    const { coerceActionPlan } = await import("./action-plan.server");
    const { chatCompletion } = await import("./ai.server");

    // Server-side entitlement gate: action plans drawn on monthly allowance
    if (orgId) {
      try {
        await query(`SELECT assert_within_quota($1, 'generate_action_plan')`, [orgId]);
      } catch (quotaErr) {
        throw new Error(quotaErr instanceof Error ? quotaErr.message : "Quota exceeded");
      }
    }

    const system = `You are a senior compliance officer drafting a remediation action plan for legal review. Return STRICT JSON only:
{
  "policy_draft": string,
  "amendments": [{"contract_id": string, "contract_name": string, "suggestion": string, "rationale": string}],
  "tech_fixes": [{"priority": "P0"|"P1"|"P2", "title": string, "detail": string}]
}
Rules:
- policy_draft is ONE paragraph of proposed internal policy language (4–6 sentences).
- amendments MUST cover every impacted contract from the input, using its exact contract_id.
- Each amendment suggestion is one sentence of proposed contract language; rationale is one short sentence.
- tech_fixes are 3–6 prioritized operational/engineering steps.
- Nothing is presented as final. All output is a draft for legal review.
- Output JSON only, no code fences, no prose.`;

    const user = `PROPOSED REGULATION:
${data.regulationText}

SIMULATION SUMMARY:
${data.summary ?? "(none)"}

IMPACTED CONTRACTS:
${JSON.stringify(data.impacts)}`;

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

      if (!content) return { ...fallbackActionPlan };

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return { ...fallbackActionPlan };
      }
      let finalPlan = plan ?? { ...fallbackActionPlan };

      // Verify citations in generated policy draft and amendments
      try {
        const { verifyCitations, mapDbRegulationToMetadata } = await import("./citation-verifier");
        const regRows = await query(
          `SELECT id, jurisdiction, title, summary, obligations FROM public.regulations`
        );
        const dbMetadata = (regRows ?? []).map((r: any) =>
          mapDbRegulationToMetadata({
            id: r.id,
            title: r.title,
            jurisdiction: r.jurisdiction,
            summary: r.summary,
            obligations: r.obligations,
          })
        );
        const textToAudit = [
          data.regulationText,
          finalPlan.policy_draft,
          ...finalPlan.amendments.map((a) => `${a.suggestion} ${a.rationale}`),
        ].join("\n\n");

        finalPlan.citation_verification = verifyCitations(textToAudit, dbMetadata);

        // Auto Review Trigger: Automatically enqueue for human review if risk rules fired
        if (orgId && finalPlan.citation_verification?.requiresHumanReview) {
          try {
            const { createReviewTaskIfTriggered } = await import("./review.server");
            const triggerType =
              finalPlan.citation_verification.repealedCount > 0
                ? "REPEALED_CITATION"
                : finalPlan.citation_verification.supersededCount > 0
                  ? "SUPERSEDED_CITATION"
                  : "UNVERIFIED_CITATION";

            const warnings = finalPlan.citation_verification.findings
              .map((f) => f.warningMessage)
              .filter((w): w is string => Boolean(w));

            await createReviewTaskIfTriggered({
              orgId,
              triggerType,
              riskLevel: finalPlan.citation_verification.highestRisk,
              title: `Action Plan Audit: Remediation Policy Draft`,
              description: `Proposed amendments contain references to ${finalPlan.citation_verification.repealedCount} repealed, ${finalPlan.citation_verification.supersededCount} superseded, or unverified legal references. Requires counsel sign-off.`,
              sourceType: "action_plan",
              sourceId: `plan-${Date.now()}`,
              originalAiResponse: JSON.stringify(finalPlan),
              citationsSnapshot: finalPlan.citation_verification.findings,
              warningsSnapshot: warnings,
              createdBy: context.userId,
            });
          } catch (reviewQueueErr) {
            console.error("[action-plan] auto review task creation failed:", reviewQueueErr);
          }
        }
      } catch (verifyErr) {
        console.error("[action-plan] citation verification error", verifyErr);
      }

      return finalPlan;
    } catch (err) {
      console.error("[action-plan] exception", err);
      return { ...fallbackActionPlan };
    }
  });
