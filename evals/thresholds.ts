// ============================================================================
// Evaluation Harness Thresholds: evals/thresholds.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.7)
// ============================================================================

export interface MetricTarget {
  warn?: number;
  fail?: number;
  max?: number;
}

export interface EvalThresholds {
  highSeverityRecall: MetricTarget;
  precision: MetricTarget;
  severityAccuracy: MetricTarget;
  exposureMedianError: MetricTarget; // lower is better
  evidenceValidity: MetricTarget;
  routingRecall: MetricTarget;
  routingPrecision: MetricTarget;
  negativeControlHighSevFlags: MetricTarget;
  maxRegressionVsBaseline: number;
}

export const defaultThresholds: EvalThresholds = {
  highSeverityRecall: { warn: 0.95, fail: 0.90 },
  precision: { warn: 0.80, fail: 0.70 },
  severityAccuracy: { warn: 0.85, fail: 0.75 },
  exposureMedianError: { warn: 0.30, fail: 0.50 }, // lower is better
  evidenceValidity: { warn: 0.98, fail: 0.95 },
  routingRecall: { warn: 0.95, fail: 0.90 },
  routingPrecision: { warn: 0.80, fail: 0.65 },
  negativeControlHighSevFlags: { max: 0 },
  maxRegressionVsBaseline: 0.03,
};
