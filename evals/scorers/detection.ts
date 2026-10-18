// ============================================================================
// Scorer: Detection & High-Severity Recall: evals/scorers/detection.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.2, §4.6)
// ============================================================================

export interface DetectionScores {
  precision: number;
  recall: number;
  f1: number;
  highSeverityRecall: number;
  nPositivesHigh: number;
  lowSample: boolean;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

export function scoreDetection(
  expectedImpacted: string[],
  actualImpacted: string[],
  expectedSeverity: Record<string, string>,
  actualSeverity: Record<string, string>
): DetectionScores {
  const expectedSet = new Set(expectedImpacted);
  const actualSet = new Set(actualImpacted);

  let tp = 0;
  let fp = 0;
  let fn = 0;

  for (const id of actualSet) {
    if (expectedSet.has(id)) {
      tp++;
    } else {
      fp++;
    }
  }

  for (const id of expectedSet) {
    if (!actualSet.has(id)) {
      fn++;
    }
  }

  const precision = tp + fp === 0 ? (expectedSet.size === 0 ? 1.0 : 0.0) : tp / (tp + fp);
  const recall = tp + fn === 0 ? (actualSet.size === 0 ? 1.0 : 0.0) : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  // High-severity recall (Headline metric §4.2)
  const expectedHighSet = new Set(
    expectedImpacted.filter((id) => (expectedSeverity[id] || "").toLowerCase() === "high")
  );

  let highTp = 0;
  for (const id of expectedHighSet) {
    if (actualSet.has(id) && (actualSeverity[id] || "").toLowerCase() === "high") {
      highTp++;
    }
  }

  const highSeverityRecall =
    expectedHighSet.size === 0 ? 1.0 : highTp / expectedHighSet.size;

  return {
    precision,
    recall,
    f1,
    highSeverityRecall,
    nPositivesHigh: expectedHighSet.size,
    lowSample: expectedHighSet.size < 20, // Spec: Below 20 is marked low sample
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
  };
}
