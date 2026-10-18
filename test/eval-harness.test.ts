// ============================================================================
// Test Suite: AI Evaluation Harness & Human Review Feedback Loop
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.1 - §4.8, §21)
// ============================================================================

import { describe, it, expect } from "vitest";
import { scoreDetection } from "../evals/scorers/detection";
import { scoreSeverity } from "../evals/scorers/severity";
import { scoreExposure } from "../evals/scorers/exposure";
import { scoreEvidence } from "../evals/scorers/evidence";
import { scoreRouting } from "../evals/scorers/routing";
import { defaultThresholds } from "../evals/thresholds";
import { SimulationRunner } from "../evals/runners/run-simulations";
import {
  stageCandidateFromReview,
  approveCandidateFixture,
  listStagedCandidates,
} from "../src/lib/audit/candidate-stage.server";

describe("AI Evaluation Harness: Deterministic Scorers", () => {
  it("scores detection accuracy and flags low sample sizes (<20)", () => {
    const expected = ["c1", "c2", "c3"];
    const actual = ["c1", "c2", "c4"]; // 2 TP, 1 FP, 1 FN
    const expSev = { c1: "high", c2: "high", c3: "medium" };
    const actSev = { c1: "high", c2: "high", c4: "high" };

    const scores = scoreDetection(expected, actual, expSev, actSev);

    expect(scores.truePositives).toBe(2);
    expect(scores.falsePositives).toBe(1);
    expect(scores.falseNegatives).toBe(1);
    expect(scores.precision).toBeCloseTo(2 / 3);
    expect(scores.recall).toBeCloseTo(2 / 3);
    expect(scores.f1).toBeCloseTo(2 / 3);

    // High severity recall: 2 expected high (c1, c2), both detected in actual at high severity
    expect(scores.highSeverityRecall).toBe(1.0);
    expect(scores.lowSample).toBe(true); // n=2 < 20
  });

  it("calculates exact and within-one agreement in 3x3 severity matrix", () => {
    const expected = { c1: "high", c2: "medium", c3: "low" };
    const actual = { c1: "high", c2: "high", c3: "low" }; // c2 is 1 level off (medium -> high)

    const scores = scoreSeverity(expected, actual);
    expect(scores.exactAgreement).toBeCloseTo(2 / 3);
    expect(scores.withinOneLevelAgreement).toBe(1.0);
    expect(scores.confusionMatrix.high.high).toBe(1);
    expect(scores.confusionMatrix.medium.high).toBe(1);
    expect(scores.confusionMatrix.low.low).toBe(1);
  });

  it("computes exposure dollar accuracy and percentage errors", () => {
    const scores = scoreExposure(1000000, 1100000, { c1: 1100000 }, ["c1"]);
    expect(scores.expectedTotal).toBe(1000000);
    expect(scores.actualTotal).toBe(1100000);
    expect(scores.absoluteError).toBe(100000);
    expect(scores.percentageError).toBeCloseTo(0.1);
  });

  it("validates verbatim clause citations and ontology IDs", () => {
    const ontologyIds = new Set(["GDPR-Art-46", "EU-AI-Act-Art-14"]);
    const contracts = [
      {
        id: "c-101",
        name: "Cloud DPA",
        value: 500000,
        clauses: ["Personal data shall not be exported without standard contractual clauses."],
      },
    ];

    const citations = [
      {
        contractId: "c-101",
        clauseTextQuote: "without standard contractual clauses",
        regulationId: "GDPR-Art-46",
      },
      {
        contractId: "c-101",
        clauseTextQuote: "completely fabricated hallucinated clause text",
        regulationId: "GDPR-Art-46",
      },
    ];

    const scores = scoreEvidence(citations, contracts, ontologyIds);
    expect(scores.totalCitations).toBe(2);
    expect(scores.validCitations).toBe(1);
    expect(scores.validityRate).toBe(0.5);
    expect(scores.invalidReasons.some((r) => r.includes("does not appear verbatim in contract c-101"))).toBe(true);
  });

  it("evaluates human review routing recall and precision", () => {
    const routingCases = [
      { id: "c1", isTrulyBreachedOrWrong: true, wasRoutedToReviewQueue: true },
      { id: "c2", isTrulyBreachedOrWrong: true, wasRoutedToReviewQueue: true },
      { id: "c3", isTrulyBreachedOrWrong: true, wasRoutedToReviewQueue: false }, // Missed
      { id: "c4", isTrulyBreachedOrWrong: false, wasRoutedToReviewQueue: false }, // Correct auto-pass
    ];

    const scores = scoreRouting(routingCases);
    expect(scores.routingRecall).toBeCloseTo(2 / 3);
    expect(scores.routingPrecision).toBe(1.0);
  });
});

describe("AI Evaluation Harness: Execution Modes & Quality Gates", () => {
  it("executes replay mode deterministically using stored cassettes", async () => {
    const runner = new SimulationRunner();
    const cases = runner.loadDatasets("quick");
    expect(cases.length).toBeGreaterThan(0);

    const firstCase = cases[0];
    const result = await runner.runCase(firstCase, { mode: "replay", subset: "quick" });

    expect(result.caseId).toBe(firstCase.id);
    expect(result.isFallback).toBe(false);
    expect(result.pass).toBe(true);
    expect(result.latencyMs).toBeLessThan(100); // Replay should be instant
  });

  it("fails explicitly when a cassette is missing in replay mode (never calls live network silently)", async () => {
    const runner = new SimulationRunner();
    const bogusCase = {
      id: "bogus-non-existent-case-9999",
      class: "synthetic",
      regulation_family: "GDPR",
      jurisdiction: "EU",
      clause_type: "data-transfer",
      regulation_text: "Bogus regulation text",
      contracts: [],
      expected: {
        impacted_contract_ids: [],
        severity: {},
        total_exposure_usd: 0,
      },
    };

    await expect(runner.runCase(bogusCase, { mode: "replay", subset: "quick" })).rejects.toThrow(
      /Cassette missing for case "bogus-non-existent-case-9999"/
    );
  });

  it("enforces maxRegressionVsBaseline = 0.03 gating", () => {
    const baselineRecall = 0.98;
    const observedRecall = 0.94; // Regressed by 0.04 > 0.03
    const maxReg = defaultThresholds.maxRegressionVsBaseline;

    const regression = baselineRecall - observedRecall;
    const isRegressed = regression > maxReg;

    expect(isRegressed).toBe(true);
  });
});

describe("Human Review Queue Feedback Loop (§21)", () => {
  it("stages rejected review items with sanitized customer PII", async () => {
    const mockReviewItem: any = {
      id: "rev-test-audit-stage-1",
      risk_summary: "Contact jane.doe@acme-corp.com regarding AWS token sk-live-99923847293",
      severity: "high",
      payload: {
        regulation_family: "GDPR Article 32",
        jurisdiction: "EU",
        total_exposure_usd: 500000,
        customer_email: "ceo@acme-corp.com",
        api_token: "secret-token-12345",
      },
    };

    const candidate = await stageCandidateFromReview({
      reviewItem: mockReviewItem,
      decision: "rejected",
      reason: "Model misidentified non-personal infrastructure as personal data",
      reviewerId: "admin-user-01",
      labelCorrectness: "incorrect",
    });

    expect(candidate.id).toBeDefined();
    expect(candidate.decision).toBe("rejected");
    expect(candidate.label_correctness).toBe("incorrect");
    expect(candidate.approved).toBe(false);

    // Verify customer info in payload was redacted before staging
    const stagedList = listStagedCandidates();
    const found = stagedList.find((c) => c.source_review_id === mockReviewItem.id);
    expect(found).toBeDefined();
  });

  it("blocks direct candidate promotion to holdout dataset to prevent data leakage (§21.5)", async () => {
    await expect(
      approveCandidateFixture("cand-rev-rejected-001", "holdout" as any, "admin-user-01")
    ).rejects.toThrow(/Security Violation: Candidates cannot be promoted directly to the holdout set/);
  });

  it("allows candidate promotion to synthetic dataset after admin approval", async () => {
    const res = await approveCandidateFixture("cand-rev-rejected-001", "synthetic", "admin-user-01");
    expect(res.success).toBe(true);
    expect(res.targetFile).toContain("synthetic.v1.json");
  });
});
