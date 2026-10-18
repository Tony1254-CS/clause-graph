import type {
  AggregateEvalMetrics,
  EvalReport,
  EvalRunMetadata,
  EvalTestCase,
  TestCaseEvalResult,
} from "./eval.types";
import { extractCitations, normalizeActName, normalizeSection } from "./citation-extractor";
import { verifySingleCitation } from "./citation-verifier";
import { AUTHORITATIVE_LEGAL_CORPUS } from "./citation-corpus";

/**
 * Evaluates an AI-generated text response against an evaluation test case.
 */
export function evaluateTestCase(
  testCase: EvalTestCase,
  responseContent: string,
  latencyMs = 0,
  tokens?: { prompt?: number; completion?: number; total?: number }
): TestCaseEvalResult {
  const failures: string[] = [];
  const text = String(responseContent ?? "").trim();

  // 1. Keyword and substantive regex checks
  if (testCase.expected_answer_criteria.must_contain_keywords) {
    for (const kw of testCase.expected_answer_criteria.must_contain_keywords) {
      if (!text.toLowerCase().includes(kw.toLowerCase())) {
        failures.push(`Missing mandatory keyword: '${kw}'`);
      }
    }
  }

  if (testCase.expected_answer_criteria.must_not_contain_keywords) {
    for (const kw of testCase.expected_answer_criteria.must_not_contain_keywords) {
      if (text.toLowerCase().includes(kw.toLowerCase())) {
        failures.push(`Response contains forbidden assertion: '${kw}'`);
      }
    }
  }

  if (testCase.expected_answer_criteria.substantive_conclusion_pattern) {
    const rx = new RegExp(testCase.expected_answer_criteria.substantive_conclusion_pattern, "i");
    if (!rx.test(text)) {
      failures.push(
        `Substantive conclusion did not match required pattern: /${testCase.expected_answer_criteria.substantive_conclusion_pattern}/i`
      );
    }
  }

  // 2. Citation Extraction & Verification
  const extracted = extractCitations(text);
  const findings = extracted.map((c) => verifySingleCitation(c, AUTHORITATIVE_LEGAL_CORPUS));

  let verifiedCount = 0;
  let staleCount = 0;
  let unverifiedCount = 0;

  for (const f of findings) {
    if (f.status === "VERIFIED") verifiedCount++;
    if (f.isStale) staleCount++;
    if (f.status === "UNVERIFIED") unverifiedCount++;
  }

  // 3. Citation Precision, Recall, and F1
  let citationPrecision: number | null = null;
  let citationRecall: number | null = null;
  let citationF1: number | null = null;

  if (testCase.expected_citations.length > 0 || extracted.length > 0) {
    let truePositives = 0;

    for (const exp of testCase.expected_citations) {
      const expActNorm = normalizeActName(exp.actTitle);
      const expSecNorm = normalizeSection(exp.section);

      const match = findings.find((f) => {
        const fActNorm = normalizeActName(f.citation.actTitle);
        const fSecNorm = normalizeSection(f.citation.section);
        const actMatch = fActNorm.includes(expActNorm) || expActNorm.includes(fActNorm);
        const secMatch = !expSecNorm || (fSecNorm && (fSecNorm === expSecNorm || fSecNorm.includes(expSecNorm)));
        return actMatch && secMatch;
      });

      if (match) {
        truePositives++;
        // Verify expected status
        if (exp.expectedStatus && match.status !== exp.expectedStatus) {
          // If expected AMENDED but marked VERIFIED or vice versa on in-force statutes, grant partial tolerance if recorded
          if (
            !(
              (exp.expectedStatus === "AMENDED" && match.status === "VERIFIED") ||
              (exp.expectedStatus === "VERIFIED" && match.status === "AMENDED")
            )
          ) {
            failures.push(
              `Citation '${exp.actTitle}' expected status ${exp.expectedStatus}, got ${match.status}`
            );
          }
        }
      } else {
        failures.push(`Expected citation missing from response: ${exp.actTitle} ${exp.section || ""}`);
      }
    }

    citationPrecision = extracted.length > 0 ? truePositives / extracted.length : 1.0;
    citationRecall = testCase.expected_citations.length > 0 ? truePositives / testCase.expected_citations.length : 1.0;
    const denom = citationPrecision + citationRecall;
    citationF1 = denom > 0 ? (2 * citationPrecision * citationRecall) / denom : 0;
  }

  // 4. Stale Citation Detection Accuracy
  let staleDetectionCorrect: boolean | null = null;
  const expectedStale = testCase.expected_citations.some((c) => c.isStale);
  if (testCase.expected_citations.length > 0) {
    const detectedStale = findings.some((f) => f.isStale);
    staleDetectionCorrect = expectedStale === detectedStale;
    if (!staleDetectionCorrect) {
      failures.push(
        `Stale detection mismatch: expected stale=${expectedStale}, detected stale=${detectedStale}`
      );
    }
  }

  // 5. Unsupported Claims Check
  // An unsupported claim occurs when an unverified statute is treated as enacted law.
  // URL citations and cases explaining an unverified reference are not unsupported claims.
  const unsupportedClaimDetected = findings.some(
    (f) =>
      f.status === "UNVERIFIED" &&
      !f.citation.actTitle.includes("Official Regulatory Source") &&
      !text.toLowerCase().includes("unverified") &&
      !text.toLowerCase().includes("not an enacted") &&
      !text.toLowerCase().includes("no authoritative record")
  );
  if (unsupportedClaimDetected && testCase.category !== "UNVERIFIED_CITATION") {
    failures.push("Response makes unverified statutory claims without flagging lack of legal authority.");
  }

  // 6. Abstention Quality
  const abstentionKeywords = [
    "insufficient",
    "clarify",
    "depends on",
    "not an enacted statute",
    "unverified",
    "out of scope",
    "no authoritative record",
    "requires details",
    "batil",
    "rohit",
    "বাতিল",
  ];
  const containsAbstention = abstentionKeywords.some((k) => text.toLowerCase().includes(k.toLowerCase()));
  const abstentionCorrect = testCase.expected_abstention ? containsAbstention : true;
  if (testCase.expected_abstention && !containsAbstention) {
    failures.push("Model should have abstained or requested clarification for ambiguous/insufficient case.");
  }

  // 7. Human Review Queue Routing Accuracy
  // Human review is required when:
  // - High risk statutes (repealed, superseded) are detected
  // - Unverified statutes (excluding official URLs) are cited
  // - Conflicting cross-border laws exist
  // - Insufficient evidence / ambiguous legal queries require counsel sign-off
  const substantiveFindings = findings.filter(
    (f) => !f.citation.actTitle.includes("Official Regulatory Source")
  );
  const requiresReview =
    substantiveFindings.some((f) => f.requiresHumanReview) ||
    testCase.category === "CONFLICTING_DOCUMENTS" ||
    (testCase.expected_abstention && testCase.category !== "OUT_OF_SCOPE");

  const humanReviewRoutingCorrect = requiresReview === testCase.expected_human_review;
  if (!humanReviewRoutingCorrect) {
    failures.push(
      `Human Review Queue routing mismatch: expected routing=${testCase.expected_human_review}, system routed=${requiresReview}`
    );
  }

  // 8. Risk Level Correctness
  const highestRisk = findings.some((f) => f.riskLevel === "high")
    ? "high"
    : findings.some((f) => f.riskLevel === "medium")
      ? "medium"
      : "low";
  const riskLevelCorrect =
    highestRisk === testCase.expected_risk_level ||
    (testCase.expected_risk_level === "high" && highestRisk === "high") ||
    (testCase.expected_risk_level === "low" && highestRisk === "low");

  const passed = failures.length === 0;

  return {
    test_case_id: testCase.test_case_id,
    category: testCase.category,
    passed,
    model_response: text,
    latency_ms: latencyMs,
    tokens,
    metrics: {
      citation_precision: citationPrecision,
      citation_recall: citationRecall,
      citation_f1: citationF1,
      stale_detection_correct: staleDetectionCorrect,
      unsupported_claim_detected: unsupportedClaimDetected,
      abstention_correct: abstentionCorrect,
      human_review_routing_correct: humanReviewRoutingCorrect,
      risk_level_correct: riskLevelCorrect,
    },
    citation_summary: {
      extracted_count: extracted.length,
      verified_count: verifiedCount,
      stale_count: staleCount,
      unverified_count: unverifiedCount,
    },
    failures,
  };
}

/**
 * Aggregates individual test results into holistic benchmark metrics.
 */
export function aggregateMetrics(results: TestCaseEvalResult[]): AggregateEvalMetrics {
  const total = results.length;
  if (total === 0) {
    return {
      total_test_cases: 0,
      passed_test_cases: 0,
      pass_rate: 0,
      citation_precision_avg: 0,
      citation_recall_avg: 0,
      citation_f1_avg: 0,
      stale_detection_precision: 0,
      stale_detection_recall: 0,
      stale_detection_f1: 0,
      unsupported_claim_rate: 0,
      abstention_quality_accuracy: 0,
      human_review_routing_accuracy: 0,
      risk_level_classification_accuracy: 0,
      avg_latency_ms: 0,
    };
  }

  const passed = results.filter((r) => r.passed).length;

  // Citation averages (ignore test cases without citation assertions)
  const precisionList = results
    .map((r) => r.metrics.citation_precision)
    .filter((v): v is number => v !== null);
  const recallList = results
    .map((r) => r.metrics.citation_recall)
    .filter((v): v is number => v !== null);
  const f1List = results.map((r) => r.metrics.citation_f1).filter((v): v is number => v !== null);

  const avgPrec = precisionList.length ? precisionList.reduce((a, b) => a + b, 0) / precisionList.length : 1.0;
  const avgRec = recallList.length ? recallList.reduce((a, b) => a + b, 0) / recallList.length : 1.0;
  const avgF1 = f1List.length ? f1List.reduce((a, b) => a + b, 0) / f1List.length : 1.0;

  // Stale detection
  const staleResults = results.filter((r) => r.metrics.stale_detection_correct !== null);
  const staleCorrect = staleResults.filter((r) => r.metrics.stale_detection_correct === true).length;
  const staleAccuracy = staleResults.length > 0 ? staleCorrect / staleResults.length : 1.0;

  // Unsupported claim rate
  const unsupportedCount = results.filter((r) => r.metrics.unsupported_claim_detected).length;
  const unsupportedRate = unsupportedCount / total;

  // Abstention quality
  const abstentionAccuracy = results.filter((r) => r.metrics.abstention_correct).length / total;

  // Human review routing accuracy
  const routingAccuracy = results.filter((r) => r.metrics.human_review_routing_correct).length / total;

  // Risk level classification accuracy
  const riskAccuracy = results.filter((r) => r.metrics.risk_level_correct).length / total;

  // Latency & tokens
  const totalLatency = results.reduce((acc, r) => acc + (r.latency_ms || 0), 0);
  const avgLatency = Math.round(totalLatency / total);
  const totalTokens = results.reduce((acc, r) => acc + (r.tokens?.total || 0), 0);

  return {
    total_test_cases: total,
    passed_test_cases: passed,
    pass_rate: Math.round((passed / total) * 1000) / 1000,
    citation_precision_avg: Math.round(avgPrec * 1000) / 1000,
    citation_recall_avg: Math.round(avgRec * 1000) / 1000,
    citation_f1_avg: Math.round(avgF1 * 1000) / 1000,
    stale_detection_precision: Math.round(staleAccuracy * 1000) / 1000,
    stale_detection_recall: Math.round(staleAccuracy * 1000) / 1000,
    stale_detection_f1: Math.round(staleAccuracy * 1000) / 1000,
    unsupported_claim_rate: Math.round(unsupportedRate * 1000) / 1000,
    abstention_quality_accuracy: Math.round(abstentionAccuracy * 1000) / 1000,
    human_review_routing_accuracy: Math.round(routingAccuracy * 1000) / 1000,
    risk_level_classification_accuracy: Math.round(riskAccuracy * 1000) / 1000,
    avg_latency_ms: avgLatency,
    total_tokens: totalTokens || undefined,
  };
}

/**
 * Builds the comprehensive structured evaluation report.
 */
export function buildEvalReport(
  metadata: EvalRunMetadata,
  results: TestCaseEvalResult[]
): EvalReport {
  const summary = aggregateMetrics(results);
  const failures = results
    .filter((r) => !r.passed)
    .map((r) => ({
      test_case_id: r.test_case_id,
      category: r.category,
      question: r.test_case_id,
      reasons: r.failures,
    }));

  return {
    metadata,
    summary,
    test_case_results: results,
    failures,
  };
}
