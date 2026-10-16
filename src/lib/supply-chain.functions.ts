import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";

export type ChainNode = {
  id: string;
  name: string;
  role: "self" | "supplier" | "subprocessor" | "vendor";
  tier: number;
  jurisdiction: string | null;
  description: string | null;
};

export type ChainEdge = {
  id: string;
  from_node_id: string;
  to_node_id: string;
  contract_name: string;
  contract_value: number;
  key_clauses: string[];
  depends_on_regs: string[];
  pass_through_factor?: number;
};

export type CascadeHit = {
  node_id: string;
  hop: number;
  reason: string;
  broken_clause: string;
  severity: "low" | "medium" | "high";
  indirect_exposure_usd: number;
};

export type CascadeResult = {
  hits: CascadeHit[];
  total_indirect_exposure: number;
  summary: string;
  remediation: string[];
  fallback: boolean;
  /** Persisted audit-trail row id, so generated artifacts can link back to it. */
  run_id?: string;
};

export const getSupplyChain = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<{ nodes: ChainNode[]; edges: ChainEdge[] }> => {
    const { query } = await import("./db.server");
    const [nodes, edges] = await Promise.all([
      query<ChainNode>(
        `SELECT id, name, role, tier, jurisdiction, description 
         FROM public.supply_chain_nodes 
         WHERE org_id = $1 
         ORDER BY tier ASC`,
        [context.orgId],
      ),
      query<{
        id: string;
        from_node_id: string;
        to_node_id: string;
        contract_name: string;
        contract_value: number | string;
        key_clauses: string[];
        depends_on_regs: string[];
      }>(
        `SELECT id, from_node_id, to_node_id, contract_name, contract_value, key_clauses, depends_on_regs 
         FROM public.supply_chain_edges 
         WHERE org_id = $1`,
        [context.orgId],
      ),
    ]);

    return {
      nodes: nodes ?? [],
      edges: (edges ?? []).map((e) => ({
        ...e,
        contract_value: Number(e.contract_value ?? 0),
      })),
    };
  });

export const simulateSupplyChainImpact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { regulationText: string }) => {
    const text = String(input?.regulationText ?? "").trim();
    if (!text) throw new Error("Regulation text is required");
    if (text.length > 20000) throw new Error("Regulation text too long");
    return { regulationText: text };
  })
  .handler(async ({ data, context }): Promise<CascadeResult> => {
    const { userId, orgId } = context;
    const { query, queryOne } = await import("./db.server");
    const { coerceHits } = await import("./supply-chain.server");
    const { chatCompletion } = await import("./ai.server");

    if (orgId) {
      try {
        await query(`SELECT assert_within_quota($1, 'run_simulation')`, [orgId]);
      } catch (quotaErr) {
        throw new Error(quotaErr instanceof Error ? quotaErr.message : "Quota exceeded");
      }

      const { assertRateLimit, AI_RATE_LIMIT } = await import("./rate-limit.server");
      assertRateLimit(`ai:supply-chain:${orgId}`, AI_RATE_LIMIT, "supply-chain cascades");
    }

    const [nodeRows, edgeRows] = await Promise.all([
      query<ChainNode>(
        `SELECT id, name, role, tier, jurisdiction, description 
         FROM public.supply_chain_nodes 
         WHERE org_id = $1`,
        [orgId],
      ),
      query<{
        id: string;
        from_node_id: string;
        to_node_id: string;
        contract_name: string;
        contract_value: number | string;
        key_clauses: string[];
        depends_on_regs: string[];
      }>(
        `SELECT id, from_node_id, to_node_id, contract_name, contract_value, key_clauses, depends_on_regs 
         FROM public.supply_chain_edges 
         WHERE org_id = $1`,
        [orgId],
      ),
    ]);

    const nodes = nodeRows ?? [];
    const edges: ChainEdge[] = (edgeRows ?? []).map((e) => ({
      ...e,
      contract_value: Number(e.contract_value ?? 0),
    }));
    const valid = new Set(nodes.map((n) => n.id));

    const { computeDeterministicBfsCascade } = await import("./supply-chain.server");
    const deterministic = computeDeterministicBfsCascade(nodes, edges, data.regulationText);

    const hits: CascadeHit[] = deterministic.hits;
    let summary = deterministic.summary;
    let remediation: string[] = deterministic.remediation;
    const fallback = deterministic.fallback;

    // Optional AI enrichment for executive summary and customized remediation
    if (nodes.length > 0 && edges.length > 0 && hits.length > 0) {
      const system = `You are a supply-chain risk and legal-graph analyst. Given a multi-tier vendor dependency graph and the deterministic BFS impact cascade hits:
1. Provide an executive summary of the supply chain exposure.
2. Provide 2-4 concrete remediation steps for the root organization.
Return STRICT JSON:
{"summary": string, "remediation": [string]}`;

      const user = `PROPOSED REGULATION:
${data.regulationText}

DETERMINISTIC BFS CASCADE HITS:
${JSON.stringify(hits)}`;

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
            const parsed = JSON.parse(content) as { summary?: unknown; remediation?: unknown };
            if (typeof parsed.summary === "string" && parsed.summary.trim()) {
              summary = parsed.summary.trim();
            }
            if (Array.isArray(parsed.remediation) && parsed.remediation.length > 0) {
              remediation = parsed.remediation.map(String).filter(Boolean).slice(0, 6);
            }
          } catch {
            /* fall back to deterministic summary */
          }
        }
      } catch (err) {
        console.error("[supply-chain] AI enrichment exception", err);
      }
    }

    const total_indirect_exposure = deterministic.total_indirect_exposure;
    const result: CascadeResult = { hits, summary, remediation, total_indirect_exposure, fallback };

    if (orgId) {
      try {
        const row = await queryOne<{ id: string }>(
          `INSERT INTO public.simulation_runs (org_id, input_regulation_text, result_json, triggered_by, run_type)
           VALUES ($1, $2, $3::jsonb, $4, 'supply_chain')
           RETURNING id`,
          [orgId, data.regulationText, JSON.stringify(result), userId],
        );
        if (row?.id) result.run_id = row.id;
      } catch (err) {
        console.error("[supply-chain] persist error", err);
      }
    }

    return result;
  });
