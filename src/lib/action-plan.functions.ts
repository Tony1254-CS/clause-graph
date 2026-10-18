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

    // Query open stale citation findings to prioritize remediation actions
    const staleFindings = await query<{
      contract_id: string;
      contract_name: string;
      raw_citation: string;
      severity: string;
      reason: string;
      suggested_citation: string | null;
      suggested_clause_text: string | null;
      transition_deadline: string | null;
    }>(
      `SELECT ci.contract_id, c.name as contract_name, ci.raw_citation,
              f.severity, f.reason, f.suggested_citation, f.suggested_clause_text,
              f.transition_deadline
       FROM public.stale_citation_findings f
       JOIN public.citation_instances ci ON ci.id = f.citation_instance_id
       JOIN public.contracts c ON c.id = ci.contract_id
       WHERE f.org_id = $1 AND f.status = 'open'
       ORDER BY CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END ASC
       LIMIT 10`,
      [orgId]
    );

    const system = `You are a senior compliance officer drafting a remediation action plan for legal review. Return STRICT JSON only:
{
  "policy_draft": string,
  "amendments": [{"contract_id": string, "contract_name": string, "suggestion": string, "rationale": string}],
  "tech_fixes": [{"priority": "P0"|"P1"|"P2", "title": string, "detail": string}]
}
Rules:
- policy_draft is ONE paragraph of proposed internal policy language (4–6 sentences).
- amendments MUST cover impacted contracts and any critical stale citation findings.
- tech_fixes are prioritized operational/engineering steps: use P0 for critical repealed laws, P1 for substantive amendments, P2 for procedural changes.
- Each amendment suggestion is one sentence of proposed contract language; rationale is one short sentence.
- Nothing is presented as final. All output is a draft for legal review.
- Output JSON only, no code fences, no prose.`;

    const user = `PROPOSED REGULATION:
${data.regulationText}

SIMULATION SUMMARY:
${data.summary ?? "(none)"}

PORTFOLIO STALE CITATION AUDIT FINDINGS:
${JSON.stringify(staleFindings ?? [])}

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
      const plan = coerceActionPlan(parsed);
      if (!plan) return { ...fallbackActionPlan };

      // Ensure open critical stale findings are represented in tech_fixes if omitted
      for (const sf of staleFindings || []) {
        const priority = sf.severity === 'critical' ? 'P0' : sf.severity === 'high' ? 'P1' : 'P2';
        const alreadyIncluded = plan.tech_fixes.some((tf) => tf.title.includes(sf.raw_citation));
        if (!alreadyIncluded && plan.tech_fixes.length < 8) {
          plan.tech_fixes.unshift({
            priority,
            title: `Remediate citation to ${sf.raw_citation}`,
            detail: `${sf.reason} Deadline: ${sf.transition_deadline || 'Immediate legal review required'}.`,
          });
        }
      }

      const { evaluateGate, enqueueForReview } = await import("./review/gate.server");
      const gate = evaluateGate({
        sourceType: "action_plan",
        severity: "medium",
        engine: "llm",
        inputText: data.regulationText,
      });

      const planUuid = `00000000-0000-0000-0000-${Date.now().toString(16).padStart(12, "0")}`.slice(0, 36);
      plan.plan_id = planUuid;

      if (gate.required && plan.amendments && plan.amendments.length > 0) {
        try {
          const review = await enqueueForReview({
            orgId,
            sourceType: "action_plan",
            sourceId: planUuid,
            severity: "medium",
            summary: `Action Plan amendment suggestions for ${data.regulationText.slice(0, 80)}`,
            payload: {
              policy_draft: plan.policy_draft,
              amendments: plan.amendments,
              tech_fixes: plan.tech_fixes,
            },
            inputSnapshot: {
              regulationText: data.regulationText,
              impacts: data.impacts,
            },
            engine: "llm",
            modelName: "gpt-4o",
            promptVersion: "v2.0",
            gate,
          });

          plan.review_status = "pending_review";
          plan.review_id = review.id;
          for (const a of plan.amendments) {
            a.review_status = "pending_review";
            a.review_id = review.id;
          }
        } catch (enqueueErr) {
          console.warn("[action-plan] review enqueue error:", enqueueErr);
          plan.review_status = "pending_review";
        }
      } else {
        plan.review_status = "not_required";
      }

      // Record action_plan.generated audit event (§5)
      if (orgId) {
        try {
          const { logAuditEvent } = await import("./audit/audit.server");
          await logAuditEvent({
            orgId,
            action: "action_plan.generated",
            entityType: "action_plan",
            entityId: planUuid,
            actorId: context.userId,
            actorRole: (context.role as any) || "member",
            after: {
              amendment_count: plan.amendments?.length || 0,
              tech_fix_count: plan.tech_fixes?.length || 0,
              fallback: plan.fallback || false,
            },
            basis: {
              model_name: "gpt-4o",
              prompt_version: "v2.0",
            },
          });
        } catch (auditErr) {
          console.warn("[action-plan] audit log error:", auditErr);
        }
      }

      return plan;
    } catch (err) {
      console.error("[action-plan] exception", err);
      return { ...fallbackActionPlan };
    }
  });

/**
 * Server-side audit logging for client-side jsPDF Action Plan generation (§8.3, §12)
 * The server records action_plan.exported_pdf before the client generates or downloads the file.
 */
export const recordActionPlanPdfExport = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { planId: string; summary?: string }) => {
    if (!input?.planId) throw new Error("Plan ID required");
    return { planId: String(input.planId), summary: input.summary };
  })
  .handler(async ({ data, context }) => {
    const { logAuditEvent } = await import("./audit/audit.server");
    const auditId = await logAuditEvent({
      orgId: context.orgId,
      action: "action_plan.exported_pdf",
      entityType: "action_plan",
      entityId: data.planId,
      actorId: context.userId,
      actorRole: (context.role as any) || "member",
      metadata: { summary: data.summary },
    });
    return { success: true, auditId };
  });
