import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";
import { runDeterministicBaseline } from "./simulate-fallback";
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
    const eventId = input?.eventId ? String(input.eventId) : undefined;
    const instrumentId = input?.instrumentId ? String(input.instrumentId) : undefined;
    return { regulationText: text, runType, regulationId, eventId, instrumentId };
  })
  .handler(async ({ data, context }): Promise<SimulationResult> => {
    const { userId, orgId } = context;
    if (!orgId) throw new Error("Unauthorized: missing orgId");

    const { query } = await import("./db.server");

    // Enforce simulation quota against caller's org in PostgreSQL
    try {
      await query(`SELECT assert_within_quota($1, 'run_simulation')`, [orgId]);
    } catch (quotaErr) {
      throw new Error(quotaErr instanceof Error ? quotaErr.message : "Quota exceeded");
    }

    try {
      const { runImpactAnalysis } = await import("./impact/orchestrate.server");
      const analysis = await runImpactAnalysis(orgId, {
        eventId: data.eventId,
        instrumentId: data.instrumentId,
        text: data.regulationText,
        runType: data.runType,
        triggeredBy: userId,
      });

      return {
        impacts: analysis.impacts,
        summary: analysis.summary,
        fallback: analysis.mode === "deterministic",
        mode: analysis.mode,
        runId: analysis.runId,
        cards: analysis.cards,
        insufficientEvidence: analysis.insufficientEvidence,
        exposure: analysis.exposure,
      };
    } catch (err) {
      console.error("[simulate] runImpactAnalysis error, using fallback baseline", err);

      // Fallback to baseline matching if orchestrator query fails
      const [contracts, regs] = await Promise.all([
        query<{
          id: string;
          name: string;
          counterparty: string;
          clauses: Array<{ id: string; text: string; linked_regs: string[] | null }> | null;
        }>(
          `SELECT c.id, c.name, c.counterparty,
                  COALESCE(
                    json_agg(
                      json_build_object('id', cl.id, 'text', cl.text, 'linked_regs', cl.linked_regs)
                    ) FILTER (WHERE cl.id IS NOT NULL),
                    '[]'::json
                  ) AS clauses
           FROM public.contracts c
           LEFT JOIN public.clauses cl ON cl.contract_id = c.id
           WHERE c.org_id = $1
           GROUP BY c.id`,
          [orgId],
        ),
        query(`SELECT id, jurisdiction, title, summary, obligations FROM public.regulations`),
      ]);

      return runDeterministicBaseline(
        (contracts ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          counterparty: c.counterparty,
          clauses: (c.clauses ?? []).map((cl) => ({
            id: cl.id,
            text: cl.text,
            linked_regs: cl.linked_regs ?? [],
          })),
        })),
        (regs ?? []) as Parameters<typeof runDeterministicBaseline>[1],
        data.regulationText,
      );
    }
  });
