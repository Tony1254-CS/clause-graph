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

    // Deterministic fallback: heuristic keyword match on depends_on_regs / description.
    const heuristicHits = (): CascadeHit[] => {
      const hits: CascadeHit[] = [];
      const lower = data.regulationText.toLowerCase();

      for (const edge of edges) {
        const matchesReg = edge.depends_on_regs.some((r) =>
          lower.includes(r.toLowerCase().replace("reg-", "")),
        );
        const matchesKeyword =
          lower.includes("transfer") ||
          lower.includes("energy") ||
          lower.includes("pci") ||
          lower.includes("payment") ||
          lower.includes("breach");

        if (matchesReg || matchesKeyword) {
          const target = nodes.find((n) => n.id === edge.to_node_id);
          const hop = target?.tier ?? 1;
          hits.push({
            node_id: edge.to_node_id,
            hop,
            reason: `Regulation matches dependency tag on edge "${edge.contract_name}".`,
            broken_clause: edge.key_clauses[0] ?? "Adherence to applicable laws",
            severity: hop === 1 ? "high" : hop === 2 ? "medium" : "low",
            indirect_exposure_usd: Math.round(edge.contract_value * 0.4),
          });
        }
      }

      // Deduplicate by node_id keeping highest hop/severity
      const byNode = new Map<string, CascadeHit>();
      for (const h of hits) {
        if (!byNode.has(h.node_id)) byNode.set(h.node_id, h);
      }
      return Array.from(byNode.values());
    };

    let hits: CascadeHit[] = [];
    let summary = "";
    let remediation: string[] = [];
    let fallback = true;

    if (nodes.length > 0 && edges.length > 0) {
      const graphContext = {
        nodes: nodes.map((n) => ({
          id: n.id,
          name: n.name,
          role: n.role,
          tier: n.tier,
          jurisdiction: n.jurisdiction,
          description: n.description,
        })),
        edges: edges.map((e) => ({
          from: e.from_node_id,
          to: e.to_node_id,
          contract: e.contract_name,
          value_usd: e.contract_value,
          clauses: e.key_clauses,
          depends_on: e.depends_on_regs,
        })),
      };

      const system = `You are a supply-chain risk and legal-graph analyst. Given a multi-tier vendor graph (Tier 0 = self, Tier 1 = direct suppliers, Tier 2 = subprocessors, Tier 3 = critical utilities/networks) and a proposed regulation:
1. Trace which upstream nodes are impacted.
2. For each, determine the CASCADE HOP (how many edges away from self: Tier 1 = 1 hop, Tier 2 = 2 hops, etc.), the broken contract clause, severity, and indirect dollar exposure.
3. Return 2-4 concrete remediation steps for the root organization.

Return STRICT JSON:
{
  "summary": string,
  "hits": [{"node_id": string, "hop": number, "reason": string, "broken_clause": string, "severity": "low"|"medium"|"high", "indirect_exposure_usd": number}],
  "remediation": [string]
}
Rules:
- node_id MUST match an id from the provided nodes (never invent).
- Do NOT include the self node in hits.
- indirect_exposure_usd must be a positive number reflecting contractual exposure at risk.
- remediation must be actionable contract/audit steps.
- JSON only.`;

      const user = `PROPOSED REGULATION:
${data.regulationText}

SUPPLY CHAIN GRAPH:
${JSON.stringify(graphContext)}`;

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
            const coerced = coerceHits(parsed, valid);
            if (coerced && coerced.length > 0) {
              hits = coerced;
              summary =
                typeof (parsed as { summary?: unknown }).summary === "string"
                  ? (parsed as { summary: string }).summary
                  : "";
              const rem = (parsed as { remediation?: unknown }).remediation;
              if (Array.isArray(rem)) remediation = rem.map(String).filter(Boolean).slice(0, 6);
              fallback = false;
            }
          } catch {
            /* fall through */
          }
        }
      } catch (err) {
        console.error("[supply-chain] exception", err);
      }
    }

    if (hits.length === 0) {
      hits = heuristicHits();
      summary =
        summary ||
        "Cascade traced from directly-impacted upstream provider back to your organization.";
      remediation = remediation.length
        ? remediation
        : [
            "Require your Tier-1 supplier to audit its own subprocessors for compliance with this rule.",
            "Add a right-to-audit clause covering N-tier providers to your master services agreement.",
            "Request written attestation from upstream vendors within 30 days of any regulatory change.",
            "Model contract-value at risk quarterly for every hop in the dependency graph.",
          ];
    }

    const total_indirect_exposure = hits
      .filter((h) => h.hop > 0)
      .reduce((s, h) => s + h.indirect_exposure_usd, 0);

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
