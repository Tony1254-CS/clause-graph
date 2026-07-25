import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { coerceHits } from "./supply-chain.server";

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
};

export const getSupplyChain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ nodes: ChainNode[]; edges: ChainEdge[] }> => {
    const { supabase } = context;
    const [{ data: nodes, error: nErr }, { data: edges, error: eErr }] = await Promise.all([
      supabase.from("supply_chain_nodes").select("*").order("tier"),
      supabase.from("supply_chain_edges").select("*"),
    ]);
    if (nErr) throw nErr;
    if (eErr) throw eErr;
    return {
      nodes: (nodes ?? []) as ChainNode[],
      edges: ((edges ?? []) as unknown as ChainEdge[]).map((e) => ({
        ...e,
        contract_value: Number(e.contract_value ?? 0),
      })),
    };
  });

export const simulateSupplyChainImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { regulationText: string }) => {
    const text = String(input?.regulationText ?? "").trim();
    if (!text) throw new Error("Regulation text is required");
    if (text.length > 20000) throw new Error("Regulation text too long");
    return { regulationText: text };
  })
  .handler(async ({ data, context }): Promise<CascadeResult> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.org_id) {
      const { error: quotaErr } = await supabase.rpc("assert_within_quota", {
        _org: profile.org_id,
        _action: "run_simulation",
      });
      if (quotaErr) throw new Error(quotaErr.message);
    }

    const [{ data: nodeRows }, { data: edgeRows }] = await Promise.all([
      supabase.from("supply_chain_nodes").select("*"),
      supabase.from("supply_chain_edges").select("*"),
    ]);
    const nodes = (nodeRows ?? []) as ChainNode[];
    const edges = ((edgeRows ?? []) as unknown as ChainEdge[]).map((e) => ({
      ...e,
      contract_value: Number(e.contract_value ?? 0),
    }));
    const valid = new Set(nodes.map((n) => n.id));

    const apiKey = process.env.LOVABLE_API_KEY;

    // Deterministic fallback: heuristic keyword match on depends_on_regs / description.
    const heuristicHits = (): CascadeHit[] => {
      const kw = data.regulationText.toLowerCase();
      const flagged = new Set<string>();
      nodes.forEach((n) => {
        if (
          (n.description ?? "").toLowerCase().split(/\W+/).some((w) => w && kw.includes(w) && w.length > 4)
        ) {
          flagged.add(n.id);
        }
      });
      edges.forEach((e) => {
        if (e.depends_on_regs.some((r) => kw.includes(r.toLowerCase().split("-").pop() ?? ""))) {
          flagged.add(e.to_node_id);
        }
      });
      const hits: CascadeHit[] = [];
      if (flagged.size === 0 && nodes.length > 0) {
        // fallback: hit deepest tier
        const deepest = nodes.reduce((a, b) => (b.tier > a.tier ? b : a));
        flagged.add(deepest.id);
      }
      const seedIds = Array.from(flagged);
      const hopMap = new Map<string, number>();
      seedIds.forEach((id) => hopMap.set(id, 0));
      // BFS backwards along edges to trace cascade to 'self'
      const queue = [...seedIds];
      while (queue.length) {
        const cur = queue.shift()!;
        const h = hopMap.get(cur) ?? 0;
        edges
          .filter((e) => e.to_node_id === cur)
          .forEach((e) => {
            const prev = hopMap.get(e.from_node_id);
            if (prev === undefined || prev > h + 1) {
              hopMap.set(e.from_node_id, h + 1);
              queue.push(e.from_node_id);
            }
          });
      }
      hopMap.forEach((hop, nid) => {
        const inbound = edges.find((e) => e.to_node_id === nid);
        const sev: CascadeHit["severity"] = hop === 0 ? "high" : hop === 1 ? "high" : hop === 2 ? "medium" : "low";
        hits.push({
          node_id: nid,
          hop,
          severity: sev,
          reason:
            hop === 0
              ? "Direct regulatory target — new obligations apply."
              : `Cascade via ${inbound?.contract_name ?? "upstream contract"}.`,
          broken_clause: inbound?.key_clauses[0] ?? "Adherence to all applicable laws",
          indirect_exposure_usd: inbound?.contract_value ?? 0,
        });
      });
      hits.sort((a, b) => a.hop - b.hop);
      return hits;
    };

    let hits: CascadeHit[] = [];
    let summary = "";
    let remediation: string[] = [];
    let fallback = true;

    if (apiKey && nodes.length) {
      try {
        const system = `You are a supply-chain compliance analyst. Given a proposed regulation and a multi-hop dependency graph of contractual relationships, identify which nodes are directly hit and how the impact cascades through contract edges back to the 'self' node.
Return STRICT JSON: {"summary": string, "hits": [{"node_id": string, "hop": number, "reason": string, "broken_clause": string, "severity": "low"|"medium"|"high", "indirect_exposure_usd": number}], "remediation": string[]}
Rules:
- node_id MUST be one from the supplied graph.
- hop=0 means the regulation directly hits that node. hop=1 means it propagates one contract-edge away, hop=2 two edges, etc. Always trace hops back toward the 'self' node.
- broken_clause SHOULD be the specific clause (from key_clauses) that fails when the upstream node breaks.
- indirect_exposure_usd is the contract_value on the incoming edge that becomes exposed.
- Provide 3-5 concrete upstream-audit remediation actions.
- Output JSON only.`;
        const user = `PROPOSED REGULATION:
${data.regulationText}

SUPPLY CHAIN NODES:
${JSON.stringify(nodes)}

SUPPLY CHAIN EDGES (from -> to, with contract):
${JSON.stringify(edges)}`;

        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 45_000);
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
          body: JSON.stringify({
            model: "google/gemini-3.6-flash",
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
          }),
        }).finally(() => clearTimeout(t));

        if (res.ok) {
          const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
          const content = j.choices?.[0]?.message?.content ?? "";
          try {
            const parsed = JSON.parse(content);
            const parsedHits = coerceHits(parsed, valid);
            if (parsedHits.length > 0) {
              hits = parsedHits;
              summary = typeof (parsed as { summary?: unknown }).summary === "string"
                ? (parsed as { summary: string }).summary
                : "";
              const rem = (parsed as { remediation?: unknown }).remediation;
              if (Array.isArray(rem)) remediation = rem.map(String).filter(Boolean).slice(0, 6);
              fallback = false;
            }
          } catch {
            /* fall through */
          }
        } else {
          console.error("[supply-chain] gateway", res.status, await res.text().catch(() => ""));
        }
      } catch (err) {
        console.error("[supply-chain] exception", err);
      }
    }

    if (hits.length === 0) {
      hits = heuristicHits();
      summary = summary || "Cascade traced from directly-impacted upstream provider back to your organization.";
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

    if (profile?.org_id) {
      const { error } = await supabase.from("simulation_runs").insert({
        org_id: profile.org_id,
        input_regulation_text: data.regulationText,
        result_json: JSON.parse(JSON.stringify(result)),
        triggered_by: userId,
        run_type: "supply_chain",
      });
      if (error) console.error("[supply-chain] persist error", error);
    }

    return result;
  });
