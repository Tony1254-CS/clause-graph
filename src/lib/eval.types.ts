/**
 * AI Evaluation Harness Types for ClauseGraph
 *
 * Ground rules:
 * - Version-controlled ground truth dataset schema
 * - Multi-dimensional metrics (Citation precision/recall, unsupported claim rate, stale citation F1, abstention quality, human review routing)
 * - Deterministic offline mode and opt-in live model evaluation
 */

import type { CitationRiskLevel, CitationVerificationStatus } from "./citation-verify.types";

export type EvalJurisdiction = "EU" | "US" | "BD" | "UK" | "INTERNATIONAL" | "GENERAL";

export type EvalRiskCategory =
  | "VERIFIED_LAW"
  | "AMENDED_LAW"
  | "REPEALED_LAW"
  | "SUPERSEDED_FRAMEWORK"
  | "UNVERIFIED_CITATION"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFLICTING_DOCUMENTS"
  | "UNSUPPORTED_CLAIMS"
  | "OUT_OF_SCOPE"
  | "AMBIGUOUS_QUERY"
  | "MULTILINGUAL_BANGLA";

export interface EvalCitationConstraint {
  actTitle: string;
  section?: string;
  expectedStatus: CitationVerificationStatus;
  isStale?: boolean;
}

export interface EvalTestCase {
  test_case_id: string;
  category: EvalRiskCategory;
  jurisdiction: EvalJurisdiction;
  language: "en" | "bn";
  question: string;
  context_documents?: Array<{
    id: string;
    title: string;
    text: string;
    source_url?: string;
  }>;
  expected_answer_criteria: {
    must_contain_keywords?: string[];
    must_not_contain_keywords?: string[];
    substantive_conclusion_pattern?: string; // Regex string
  };
  trusted_source_references: string[];
  expected_citations: EvalCitationConstraint[];
  expected_document_status?: CitationVerificationStatus;
  risk_category: EvalRiskCategory;
  expected_abstention: boolean; // True if AI must abstain or state lack of authoritative evidence
  expected_human_review: boolean; // True if risk level/citation should trigger Human Review Queue
  expected_risk_level: CitationRiskLevel;
  notes?: string;
}

export interface TestCaseEvalResult {
  test_case_id: string;
  category: EvalRiskCategory;
  passed: boolean;
  model_response: string;
  latency_ms: number;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  metrics: {
    citation_precision: number | null; // null if 0 citations extracted
    citation_recall: number | null; // null if 0 expected citations
    citation_f1: number | null;
    stale_detection_correct: boolean | null;
    unsupported_claim_detected: boolean;
    abstention_correct: boolean;
    human_review_routing_correct: boolean;
    risk_level_correct: boolean;
  };
  citation_summary?: {
    extracted_count: number;
    verified_count: number;
    stale_count: number;
    unverified_count: number;
  };
  failures: string[];
}

export interface AggregateEvalMetrics {
  total_test_cases: number;
  passed_test_cases: number;
  pass_rate: number; // 0.0 - 1.0

  // Citation Metrics
  citation_precision_avg: number;
  citation_recall_avg: number;
  citation_f1_avg: number;

  // Stale Citation Detection
  stale_detection_precision: number;
  stale_detection_recall: number;
  stale_detection_f1: number;

  // Reliability & Safeguards
  unsupported_claim_rate: number; // Lower is better (0.0 = perfect)
  abstention_quality_accuracy: number; // Accuracy on insufficient-evidence cases
  human_review_routing_accuracy: number; // Accuracy routing high-risk/stale cases to review queue
  risk_level_classification_accuracy: number;

  // Performance
  avg_latency_ms: number;
  total_tokens?: number;
}

export interface EvalRunMetadata {
  dataset_version: string;
  dataset_count: number;
  model_provider: string;
  model_name: string;
  mode: "offline_fixtures" | "live_model";
  prompt_version: string;
  run_timestamp: string;
  git_commit?: string;
  duration_ms: number;
}

export interface EvalReport {
  metadata: EvalRunMetadata;
  summary: AggregateEvalMetrics;
  test_case_results: TestCaseEvalResult[];
  failures: Array<{
    test_case_id: string;
    category: EvalRiskCategory;
    question: string;
    reasons: string[];
  }>;
}
