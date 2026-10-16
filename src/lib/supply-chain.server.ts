import type { ChainNode, ChainEdge, CascadeHit, CascadeResult } from "./supply-chain.functions";

const SEVERITIES: Array<CascadeHit["severity"]> = ["low", "medium", "high"];

export function coerceHits(raw: unknown, valid: Set<string>): CascadeHit[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { hits?: unknown })?.hits)
      ? (raw as { hits: unknown[] }).hits
      : [];
  const out: CascadeHit[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const id = String(o.node_id ?? o.id ?? "");
    const sev = String(o.severity ?? "").toLowerCase() as CascadeHit["severity"];
    if (!valid.has(id) || !SEVERITIES.includes(sev)) continue;
    out.push({
      node_id: id,
      hop: Math.max(0, Number(o.hop ?? 0) | 0),
      reason: String(o.reason ?? ""),
      broken_clause: String(o.broken_clause ?? ""),
      severity: sev,
      indirect_exposure_usd: Number(o.indirect_exposure_usd ?? 0) || 0,
    });
  }
  return out;
}

export type SeverityRule = {
  maxHop: number;
  defaultSeverity: CascadeHit["severity"];
};

export const DEFAULT_SEVERITY_RULES: SeverityRule[] = [
  { maxHop: 1, defaultSeverity: "high" },
  { maxHop: 2, defaultSeverity: "medium" },
  { maxHop: 999, defaultSeverity: "low" },
];

/**
 * Determine severity deterministically based on BFS hop distance and contract value.
 */
export function determineSeverity(
  hop: number,
  contractValue: number,
  rules = DEFAULT_SEVERITY_RULES,
): CascadeHit["severity"] {
  let base: CascadeHit["severity"] = "low";
  for (const rule of rules) {
    if (hop <= rule.maxHop) {
      base = rule.defaultSeverity;
      break;
    }
  }

  // Elevate severity if contract value is high (>= $1,000,000)
  if (contractValue >= 1_000_000 && base === "low") {
    return "medium";
  }
  if (contractValue >= 2_000_000 && base === "medium") {
    return "high";
  }

  return base;
}

/**
 * Pure deterministic BFS supply-chain cascade algorithm.
 *
 * 1. Matches regulation text against edges' `depends_on_regs` and relevant domain keywords.
 * 2. Identifies directly impacted upstream nodes.
 * 3. Propagates along reversed edges back to the root ('self' / tier 0) node.
 * 4. Calculates hop distance via BFS shortest path to 'self'.
 * 5. Computes indirect exposure deterministically using contract values and documented pass_through_factor.
 */
export function computeDeterministicBfsCascade(
  nodes: ChainNode[],
  edges: ChainEdge[],
  regulationText: string,
  options: { defaultPassThrough?: number } = {},
): CascadeResult {
  const defaultPassThrough = options.defaultPassThrough ?? 1.0;
  const lowerText = regulationText.toLowerCase().trim();

  // Find root self node (role = 'self' or tier = 0)
  const selfNode = nodes.find((n) => n.role === "self" || n.tier === 0) || nodes[0];
  const selfId = selfNode?.id;

  if (!selfId || nodes.length <= 1 || edges.length === 0) {
    return {
      hits: [],
      total_indirect_exposure: 0,
      summary: "No supply-chain cascade detected for this regulatory input.",
      remediation: [
        "Maintain current vendor tier monitoring.",
        "Ensure all direct supplier contracts include annual regulatory compliance certification.",
      ],
      fallback: false,
    };
  }

  // Pre-calculate shortest distance from self to every node via BFS (forward edges)
  // Edge: from_node_id -> to_node_id (e.g. self -> supplier -> subprocessor)
  const forwardAdj = new Map<string, string[]>();
  for (const edge of edges) {
    if (!forwardAdj.has(edge.from_node_id)) {
      forwardAdj.set(edge.from_node_id, []);
    }
    forwardAdj.get(edge.from_node_id)!.push(edge.to_node_id);
  }

  const hopFromSelf = new Map<string, number>();
  hopFromSelf.set(selfId, 0);
  const queue: string[] = [selfId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currHop = hopFromSelf.get(curr)!;
    const neighbors = forwardAdj.get(curr) || [];
    for (const neighbor of neighbors) {
      if (!hopFromSelf.has(neighbor)) {
        hopFromSelf.set(neighbor, currHop + 1);
        queue.push(neighbor);
      }
    }
  }

  // Determine which edges match the regulation
  const matchedEdges: Array<{ edge: ChainEdge; reason: string }> = [];
  const normalizedText = lowerText.replace(/[^a-z0-9]/g, "");

  for (const edge of edges) {
    // Check regulatory tag match with flexible normalization
    const matchedReg = edge.depends_on_regs.find((reg) => {
      const cleanReg = reg.toLowerCase().replace(/^reg-/, "");
      const normalizedReg = cleanReg.replace(/[^a-z0-9]/g, "");
      // E.g. "sec-17a4" vs "secrule17a4", or "gdpr-33" vs "gdprarticle33"
      if (normalizedText.includes(normalizedReg) || lowerText.includes(cleanReg)) {
        return true;
      }
      // Also match parts: e.g. reg = "REG-SEC-17A4" -> check if normalized parts ("sec", "17a4") appear in normalizedText
      const parts = cleanReg.split(/[-_]/).filter(Boolean);
      if (
        parts.length >= 2 &&
        parts.every(
          (p) => lowerText.includes(p) || normalizedText.includes(p.replace(/[^a-z0-9]/g, "")),
        )
      ) {
        return true;
      }
      return false;
    });

    if (matchedReg) {
      matchedEdges.push({
        edge,
        reason: `Statutory dependency tag "${matchedReg}" matches regulatory event.`,
      });
      continue;
    }

    // Keyword heuristic matching on edge key_clauses or contract_name
    const edgeKeywords = [...edge.key_clauses, edge.contract_name].join(" ").toLowerCase();
    const commonRiskTerms = [
      "energy",
      "electricity",
      "pci-dss",
      "cardholder",
      "cross-border",
      "data residency",
      "subprocessor",
      "breach notification",
    ];

    const matchedKeyword = commonRiskTerms.find((term) => {
      const regex = new RegExp(`\\b${term}\\b`, "i");
      return regex.test(lowerText) && regex.test(edgeKeywords);
    });

    if (matchedKeyword) {
      matchedEdges.push({
        edge,
        reason: `Domain keyword "${matchedKeyword}" links contract clause to regulatory requirement.`,
      });
    }
  }

  if (matchedEdges.length === 0) {
    return {
      hits: [],
      total_indirect_exposure: 0,
      summary:
        "No supplier dependencies or contract clauses in your supply chain match this regulatory event.",
      remediation: [
        "No immediate vendor remediation required for this regulatory scope.",
        "Continue periodic reviews of supplier dependency tags.",
      ],
      fallback: false,
    };
  }

  // Trace affected nodes and calculate exposure
  const nodeHits = new Map<string, CascadeHit>();
  const nodesMap = new Map<string, ChainNode>(nodes.map((n) => [n.id, n]));

  for (const { edge, reason } of matchedEdges) {
    const targetNodeId = edge.to_node_id;
    if (targetNodeId === selfId) continue; // Never hit self node

    const targetNode = nodesMap.get(targetNodeId);
    if (!targetNode) continue;

    const hop = hopFromSelf.get(targetNodeId) ?? (targetNode.tier > 0 ? targetNode.tier : 1);
    const passThrough = edge.pass_through_factor ?? defaultPassThrough;
    const exposureUsd = Math.round(edge.contract_value * passThrough);

    const brokenClause =
      edge.key_clauses.find((c) =>
        lowerText.split(/\s+/).some((w) => w.length > 4 && c.toLowerCase().includes(w)),
      ) ||
      edge.key_clauses[0] ||
      "Adherence to all applicable laws and regulations";

    const severity = determineSeverity(hop, edge.contract_value);

    // If node already hit by another edge, take the highest severity and sum exposure or keep max
    if (nodeHits.has(targetNodeId)) {
      const existing = nodeHits.get(targetNodeId)!;
      const combinedExposure = existing.indirect_exposure_usd + exposureUsd;
      const higherSeverity: CascadeHit["severity"] =
        existing.severity === "high" || severity === "high"
          ? "high"
          : existing.severity === "medium" || severity === "medium"
            ? "medium"
            : "low";

      nodeHits.set(targetNodeId, {
        ...existing,
        severity: higherSeverity,
        indirect_exposure_usd: combinedExposure,
        reason: `${existing.reason} Also affected by edge "${edge.contract_name}".`,
      });
    } else {
      nodeHits.set(targetNodeId, {
        node_id: targetNodeId,
        hop,
        reason,
        broken_clause: brokenClause,
        severity,
        indirect_exposure_usd: exposureUsd,
      });
    }
  }

  const hits = Array.from(nodeHits.values()).sort((a, b) => a.hop - b.hop);
  const total_indirect_exposure = hits.reduce((acc, h) => acc + h.indirect_exposure_usd, 0);

  const highestTier = Math.max(...hits.map((h) => h.hop), 1);
  const summary = `Deterministic BFS cascade traced ${hits.length} affected upstream node(s) across ${highestTier} tier(s). Total indirect contractual exposure at risk: $${total_indirect_exposure.toLocaleString()}.`;

  const remediation: string[] = [
    `Issue mandatory compliance attestation requests to Tier-1 suppliers within 14 business days.`,
    `Audit N-tier subprocessors operating under impacted contracts for compliance adherence.`,
    `Review pass-through indemnity and regulatory breach allocation in master vendor agreements.`,
    `Establish contingency routing for critical service dependencies in tier ${highestTier}.`,
  ];

  return {
    hits,
    total_indirect_exposure,
    summary,
    remediation,
    fallback: false,
  };
}
