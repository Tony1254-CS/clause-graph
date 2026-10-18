// ============================================================================
// Scorer: Evidence Accuracy & Citation Validity: evals/scorers/evidence.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.2, §4.6)
// ============================================================================

export interface Citation {
  contractId: string;
  clauseTextQuote?: string;
  regulationId?: string;
}

export interface EvidenceScores {
  validityRate: number;
  totalCitations: number;
  validCitations: number;
  invalidReasons: string[];
}

export function scoreEvidence(
  citations: Citation[],
  contracts: Array<{ id: string; clauses: string[] }>,
  validRegulationOntologyIds: Set<string>
): EvidenceScores {
  if (citations.length === 0) {
    return {
      validityRate: 1.0,
      totalCitations: 0,
      validCitations: 0,
      invalidReasons: [],
    };
  }

  const contractMap = new Map<string, string[]>();
  for (const c of contracts) {
    contractMap.set(c.id, c.clauses);
  }

  let valid = 0;
  const invalidReasons: string[] = [];

  for (const cit of citations) {
    const clauses = contractMap.get(cit.contractId);
    if (!clauses || clauses.length === 0) {
      invalidReasons.push(`Cited contract ${cit.contractId} has no corresponding clauses`);
      continue;
    }

    // Check verbatim quote if present
    if (cit.clauseTextQuote) {
      const normalizedQuote = cit.clauseTextQuote.trim().toLowerCase();
      const appearsVerbatim = clauses.some((clauseText) =>
        clauseText.toLowerCase().includes(normalizedQuote)
      );

      if (!appearsVerbatim) {
        invalidReasons.push(
          `Quote "${cit.clauseTextQuote.slice(0, 30)}..." does not appear verbatim in contract ${cit.contractId}`
        );
        continue;
      }
    }

    // Check regulation ID if specified
    if (cit.regulationId && validRegulationOntologyIds.size > 0) {
      if (!validRegulationOntologyIds.has(cit.regulationId)) {
        invalidReasons.push(`Regulation ID ${cit.regulationId} does not exist in ontology`);
        continue;
      }
    }

    valid++;
  }

  return {
    validityRate: valid / citations.length,
    totalCitations: citations.length,
    validCitations: valid,
    invalidReasons,
  };
}
