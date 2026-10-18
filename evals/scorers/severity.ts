// ============================================================================
// Scorer: Severity Accuracy & Confusion Matrix: evals/scorers/severity.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.2, §4.6)
// ============================================================================

export type SeverityLevel = "high" | "medium" | "low";

export interface ConfusionMatrix {
  high: { high: number; medium: number; low: number };
  medium: { high: number; medium: number; low: number };
  low: { high: number; medium: number; low: number };
}

export interface SeverityScores {
  exactAgreement: number;
  withinOneLevelAgreement: number;
  confusionMatrix: ConfusionMatrix;
  totalEvaluated: number;
}

const LEVEL_WEIGHTS: Record<SeverityLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

function normalizeSeverity(s?: string): SeverityLevel {
  const norm = (s || "low").toLowerCase().trim();
  if (norm === "high" || norm === "critical") return "high";
  if (norm === "medium" || norm === "moderate") return "medium";
  return "low";
}

export function scoreSeverity(
  expected: Record<string, string>,
  actual: Record<string, string>
): SeverityScores {
  const matrix: ConfusionMatrix = {
    high: { high: 0, medium: 0, low: 0 },
    medium: { high: 0, medium: 0, low: 0 },
    low: { high: 0, medium: 0, low: 0 },
  };

  const contractIds = Object.keys(expected);
  if (contractIds.length === 0) {
    return {
      exactAgreement: 1.0,
      withinOneLevelAgreement: 1.0,
      confusionMatrix: matrix,
      totalEvaluated: 0,
    };
  }

  let exactMatches = 0;
  let withinOneMatches = 0;

  for (const id of contractIds) {
    const expSev = normalizeSeverity(expected[id]);
    const actSev = normalizeSeverity(actual[id]);

    matrix[expSev][actSev]++;

    const diff = Math.abs(LEVEL_WEIGHTS[expSev] - LEVEL_WEIGHTS[actSev]);
    if (diff === 0) {
      exactMatches++;
      withinOneMatches++;
    } else if (diff === 1) {
      withinOneMatches++;
    }
  }

  return {
    exactAgreement: exactMatches / contractIds.length,
    withinOneLevelAgreement: withinOneMatches / contractIds.length,
    confusionMatrix: matrix,
    totalEvaluated: contractIds.length,
  };
}
