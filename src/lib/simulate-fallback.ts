import type { ImpactEntry, Severity, SimulationResult } from "./simulate-types";

export type ContractWithClauses = {
  id: string;
  name: string;
  counterparty: string;
  clauses?: Array<{
    id: string;
    text: string;
    linked_regs?: string[];
  }>;
};

export type RegulationRecord = {
  id: string;
  title: string;
  summary: string;
  obligations?: unknown;
};

/**
 * Deterministic baseline analysis for regulatory simulation (no AI required).
 *
 * Scans real workspace contracts and clauses against the regulation text and ontology
 * using exact citation mapping and domain keyword matching.
 */
export function runDeterministicBaseline(
  contracts: ContractWithClauses[],
  regulations: RegulationRecord[],
  regulationText: string,
): SimulationResult {
  if (!contracts || contracts.length === 0) {
    return {
      impacts: [],
      summary: "No contracts found in workspace to evaluate.",
      fallback: true,
      mode: "deterministic",
    };
  }

  const normInput = (regulationText || "").toLowerCase();

  // Extract meaningful tokens (>= 4 chars, non-stopword)
  const words = normInput
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 4 &&
        !["shall", "about", "their", "which", "there", "where", "under", "these"].includes(w),
    );

  // Match against known regulations in ontology
  const matchedRegs = new Set<string>();
  for (const reg of regulations) {
    const regIdLower = reg.id.toLowerCase();
    const titleLower = reg.title.toLowerCase();
    if (
      normInput.includes(regIdLower) ||
      words.some((w) => w.length > 4 && titleLower.includes(w))
    ) {
      matchedRegs.add(reg.id);
    }
  }

  const impacts: ImpactEntry[] = [];

  for (const contract of contracts) {
    const clauses = contract.clauses || [];
    let bestSeverity: Severity | null = null;
    let rationale = "";

    for (const clause of clauses) {
      const clauseTextLower = clause.text.toLowerCase();
      const linked = clause.linked_regs || [];

      // Check for direct regulation link matches
      const directMatches = linked.filter((r) => matchedRegs.has(r));
      if (directMatches.length > 0) {
        bestSeverity = "high";
        rationale = `Direct citation match: clause references ${directMatches.join(", ")} within regulatory scope.`;
        break;
      }

      // Check for keyword overlaps
      const matchedWords = words.filter(
        (w) =>
          clauseTextLower.includes(w) &&
          !["party", "parties", "agreement", "contract", "section", "clause"].includes(w),
      );

      if (matchedWords.length >= 3) {
        if (!bestSeverity) {
          bestSeverity = "medium";
          rationale = `Substantive keyword overlap detected: ${matchedWords.slice(0, 3).join(", ")}.`;
        }
      } else if (matchedWords.length >= 2 && !bestSeverity) {
        bestSeverity = "low";
        rationale = `Topical overlap on key terms: ${matchedWords.join(", ")}.`;
      }
    }

    if (bestSeverity) {
      impacts.push({
        contract_id: contract.id,
        severity: bestSeverity,
        suggested_amendment:
          rationale ||
          "Review and update clause terms to confirm compliance with updated requirements.",
      });
    }
  }

  const summary =
    impacts.length > 0
      ? `Deterministic baseline identified ${impacts.length} impacted contract(s) via regulatory citation and keyword matching.`
      : "Deterministic baseline found no contracts impacted by the specified regulatory text.";

  return {
    impacts,
    summary,
    fallback: true,
    mode: "deterministic",
  };
}
