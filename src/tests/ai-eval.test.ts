import test from "node:test";
import assert from "node:assert/strict";

import { EVAL_DATASET_V1 } from "../lib/eval.dataset.js";
import { evaluateTestCase, aggregateMetrics, buildEvalReport } from "../lib/eval.metrics.js";
import { OFFLINE_EVAL_FIXTURES } from "../lib/eval.fixtures.js";
import { runEvaluationHarness } from "../lib/eval.runner.js";

test("AI Evaluation Dataset: satisfies coverage and integrity criteria", () => {
  assert.ok(EVAL_DATASET_V1.length >= 10, "Dataset must contain at least 10 representative test cases");

  const categories = new Set(EVAL_DATASET_V1.map((tc) => tc.category));
  assert.ok(categories.has("VERIFIED_LAW"), "Must have in-force law cases");
  assert.ok(categories.has("AMENDED_LAW"), "Must have amended law cases");
  assert.ok(categories.has("REPEALED_LAW"), "Must have repealed law cases");
  assert.ok(categories.has("SUPERSEDED_FRAMEWORK"), "Must have superseded framework cases");
  assert.ok(categories.has("UNVERIFIED_CITATION"), "Must have unverified/fabricated citation cases");
  assert.ok(categories.has("INSUFFICIENT_EVIDENCE"), "Must have insufficient evidence cases");
  assert.ok(categories.has("CONFLICTING_DOCUMENTS"), "Must have conflicting legal document cases");
  assert.ok(categories.has("MULTILINGUAL_BANGLA"), "Must have multilingual Bangla cases");
  assert.ok(categories.has("OUT_OF_SCOPE"), "Must have out-of-scope cases");

  // Every test case must have unique ID
  const ids = new Set<string>();
  for (const tc of EVAL_DATASET_V1) {
    assert.ok(!ids.has(tc.test_case_id), `Duplicate test_case_id: ${tc.test_case_id}`);
    ids.add(tc.test_case_id);
    assert.ok(tc.question.length > 5, `Question must be descriptive in ${tc.test_case_id}`);
  }
});

test("AI Evaluation Metrics: evaluates in-force and amended laws accurately", () => {
  // Test GDPR breach notification (TC-CIT-001)
  const tc1 = EVAL_DATASET_V1.find((tc) => tc.test_case_id === "TC-CIT-001")!;
  const res1 = evaluateTestCase(tc1, OFFLINE_EVAL_FIXTURES["TC-CIT-001"], 45);
  assert.equal(res1.passed, true);
  assert.equal(res1.metrics.citation_recall, 1.0);
  assert.equal(res1.metrics.stale_detection_correct, true);
  assert.equal(res1.metrics.unsupported_claim_detected, false);

  // Test SEC Rule 17a-4 amended (TC-AMD-001)
  const tc2 = EVAL_DATASET_V1.find((tc) => tc.test_case_id === "TC-AMD-001")!;
  const res2 = evaluateTestCase(tc2, OFFLINE_EVAL_FIXTURES["TC-AMD-001"], 40);
  assert.equal(res2.passed, true);
  assert.equal(res2.metrics.stale_detection_correct, true);
});

test("AI Evaluation Metrics: detects repealed laws and enforces human review routing", () => {
  // Directive 95/46/EC repealed
  const tcRep = EVAL_DATASET_V1.find((tc) => tc.test_case_id === "TC-REP-001")!;
  const resRep = evaluateTestCase(tcRep, OFFLINE_EVAL_FIXTURES["TC-REP-001"], 50);
  assert.equal(resRep.passed, true);
  assert.equal(resRep.metrics.human_review_routing_correct, true);
  assert.equal(resRep.metrics.stale_detection_correct, true);

  // Intentional failure test: Model asserting Directive 95/46/EC as currently in force
  const flawedResponse = "Directive 95/46/EC is currently in force and serves as valid legal basis.";
  const flawedEval = evaluateTestCase(tcRep, flawedResponse, 30);
  assert.equal(flawedEval.passed, false);
  assert.ok(flawedEval.failures.some((f) => f.includes("forbidden assertion")));
});

test("AI Evaluation Metrics: verifies abstention on insufficient and ambiguous queries", () => {
  const tcAbs = EVAL_DATASET_V1.find((tc) => tc.test_case_id === "TC-ABS-001")!;
  const resAbs = evaluateTestCase(tcAbs, OFFLINE_EVAL_FIXTURES["TC-ABS-001"], 35);
  assert.equal(resAbs.passed, true);
  assert.equal(resAbs.metrics.abstention_correct, true);

  // Intentional failure test: Model hallucinating a definitive yes/no without evidence
  const recklessResponse = "Yes, having 12 team members means you must appoint a DPO immediately.";
  const flawedEval = evaluateTestCase(tcAbs, recklessResponse, 20);
  assert.equal(flawedEval.passed, false);
  assert.ok(flawedEval.failures.some((f) => f.includes("abstained")));
});

test("AI Evaluation Harness: runs full offline evaluation suite with threshold assertions", async () => {
  const report = await runEvaluationHarness({
    mode: "offline",
    outputDir: "reports/eval",
  });

  assert.ok(report);
  assert.equal(report.metadata.mode, "offline_fixtures");
  assert.equal(report.metadata.dataset_count, EVAL_DATASET_V1.length);

  // Baseline thresholds check:
  // In offline mode with curated fixtures, baseline pass rate must be 100%
  assert.equal(report.summary.pass_rate, 1.0, "Offline ground-truth fixtures must achieve 100% pass rate");
  assert.equal(report.summary.unsupported_claim_rate, 0.0, "Unsupported claim rate must be 0.0");
  assert.equal(report.summary.abstention_quality_accuracy, 1.0, "Abstention accuracy must be 1.0");
  assert.equal(report.summary.human_review_routing_accuracy, 1.0, "Human review routing accuracy must be 1.0");
  assert.equal(report.failures.length, 0, "No failures expected in offline baseline");
});
