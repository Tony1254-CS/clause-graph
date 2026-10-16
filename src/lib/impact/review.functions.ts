// src/lib/impact/review.functions.ts
// Server functions for reviewing impact assessments and scanning stale citations (Phase 3 T3.4, T3.5)

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "../auth-middleware";
import type { StaleCitationAlert } from "../simulate-types";

const ReviewInputSchema = z.object({
  assessmentId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "edited"]),
  suggestedAmendment: z.string().optional(),
});

export const reviewImpactAssessment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: unknown) => ReviewInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { orgId, userId } = context;
    if (!orgId) throw new Error("Unauthorized");

    const { withOrg } = await import("../db.server");

    return await withOrg(orgId, async (client) => {
      // 1. Update impact_assessments
      const updateRes = await client.query<{
        id: string;
        review_status: string;
        suggested_amendment: string | null;
        contract_id: string;
      }>(
        `UPDATE public.impact_assessments
         SET review_status = $1,
             suggested_amendment = COALESCE($2, suggested_amendment),
             reviewed_by = $3,
             reviewed_at = now()
         WHERE id = $4 AND org_id = $5
         RETURNING id, review_status, suggested_amendment, contract_id`,
        [data.status, data.suggestedAmendment || null, userId, data.assessmentId, orgId],
      );

      if (updateRes.rows.length === 0) {
        throw new Error("Impact assessment not found or unauthorized");
      }

      const row = updateRes.rows[0];

      // 2. Append to audit_log (immutable table)
      await client.query(
        `INSERT INTO public.audit_log (
           org_id, actor_id, action, target_type, target_id, details
         ) VALUES ($1, $2, 'impact_assessment.reviewed', 'impact_assessment', $3, $4::jsonb)`,
        [
          orgId,
          userId,
          row.id,
          JSON.stringify({
            status: data.status,
            previous_status: "pending_review",
            contract_id: row.contract_id,
            amendment_updated: Boolean(data.suggestedAmendment),
          }),
        ],
      );

      return {
        ok: true,
        assessmentId: row.id,
        status: row.review_status,
        suggestedAmendment: row.suggested_amendment,
      };
    });
  });

export const getStaleCitationsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<StaleCitationAlert[]> => {
    const { orgId } = context;
    if (!orgId) return [];
    const { detectStaleCitations } = await import("./stale-citations.server");
    return detectStaleCitations(orgId);
  });

export const getHistoricalImpactAssessments = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((runId?: string) => (runId ? String(runId) : undefined))
  .handler(async ({ data: runId, context }) => {
    const { orgId } = context;
    if (!orgId) return [];

    const { query } = await import("../db.server");

    let q = `
      SELECT ia.id, ia.run_id, ia.contract_id, ia.clause_id, ia.obligation_id,
             ia.verdict, ia.severity, ia.clause_quote, ia.rule_quote,
             ia.rationale, ia.suggested_amendment, ia.confidence, ia.origin,
             ia.review_status, ia.reviewed_at, ia.created_at,
             c.name as contract_name, c.value as contract_value,
             cl.text as clause_text,
             p.instrument_id, li.title as instrument_title, li.official_url
      FROM public.impact_assessments ia
      JOIN public.contracts c ON c.id = ia.contract_id
      JOIN public.clauses cl ON cl.id = ia.clause_id
      LEFT JOIN public.obligations o ON o.id = ia.obligation_id
      LEFT JOIN public.provisions p ON p.id = o.provision_id
      LEFT JOIN public.legal_instruments li ON li.id = p.instrument_id
      WHERE ia.org_id = $1
    `;
    const params: unknown[] = [orgId];

    if (runId) {
      q += ` AND ia.run_id = $2`;
      params.push(runId);
    }

    q += ` ORDER BY ia.created_at DESC LIMIT 50`;

    return await query(q, params);
  });
