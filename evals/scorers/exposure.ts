// ============================================================================
// Scorer: Exposure Accuracy: evals/scorers/exposure.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.2, §4.6)
// ============================================================================

export interface ExposureScores {
  sumEqualsImpactedValues: boolean;
  actualTotal: number;
  expectedTotal: number;
  absoluteError: number;
  percentageError: number;
}

export function scoreExposure(
  expectedTotal: number,
  actualTotal: number,
  contractValues: Record<string, number>,
  actualImpactedIds: string[]
): ExposureScores {
  // Check (a): Total equals sum of impacted contract values
  const sumOfImpacted = actualImpactedIds.reduce(
    (acc, id) => acc + (contractValues[id] || 0),
    0
  );

  const sumEquals = Math.abs(sumOfImpacted - actualTotal) < 1.0; // tolerate cents

  // Check (b): % error versus gold exposure
  const absError = Math.abs(actualTotal - expectedTotal);
  const percentageError =
    expectedTotal === 0
      ? actualTotal === 0
        ? 0
        : 1.0
      : absError / expectedTotal;

  return {
    sumEqualsImpactedValues: sumEquals,
    actualTotal,
    expectedTotal,
    absoluteError: absError,
    percentageError,
  };
}

export function calculateMedianExposureError(errors: number[]): number {
  if (errors.length === 0) return 0;
  const sorted = [...errors].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
