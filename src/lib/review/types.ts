// ============================================================================
// Types: src/lib/review/types.ts
// Human Review Queue (HITL) domain types, enums, and evaluation contracts
// ============================================================================

export type ReviewStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "escalated"
  | "superseded"
  | "stale";

export type ReviewSource =
  | "simulation"
  | "compliance_artifact"
  | "clause"
  | "supply_chain"
  | "what_if"
  | "action_plan";

export type ReviewSeverity = "high" | "medium" | "low";

export type ReviewReasonCode =
  | "wrong_clause"
  | "wrong_regulation"
  | "severity_overstated"
  | "severity_understated"
  | "hallucinated_citation"
  | "bad_amendment_language"
  | "unsafe_infrastructure"
  | "other";

export type ReviewEventType =
  | "created"
  | "viewed"
  | "assigned"
  | "comment"
  | "approval_vote"
  | "approved"
  | "rejected"
  | "edited"
  | "escalated"
  | "superseded"
  | "marked_stale"
  | "redacted"
  | "qa_sampled";

export interface ReviewItem {
  id: string;
  org_id: string;
  source_type: ReviewSource;
  source_id: string;
  status: ReviewStatus;
  severity: ReviewSeverity;
  risk_score: number;
  risk_summary: string;
  flag_reasons: string[];
  engine: "llm" | "deterministic_fallback";
  model_name?: string | null;
  prompt_version?: string | null;
  confidence?: number | null;

  ai_payload: any;
  output_hash: string;
  input_snapshot: any;
  input_hash: string;

  reviewed_payload?: any | null;
  reviewed_hash?: string | null;

  required_approvals: number;
  dedupe_key: string;
  supersedes_id?: string | null;

  submitted_by?: string | null;
  assigned_to?: string | null;
  decided_by?: string | null;
  decided_by_label?: string | null;
  decided_at?: string | null;
  decision_reason?: string | null;
  reason_code?: ReviewReasonCode | null;

  sla_due_at: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewEvent {
  id: number;
  review_id: string;
  org_id: string;
  actor_id?: string | null;
  actor_label: string;
  event_type: ReviewEventType;
  from_status?: ReviewStatus | null;
  to_status?: ReviewStatus | null;
  payload: Record<string, any>;
  created_at: string;
  prev_hash?: string | null;
  row_hash: string;
}

export interface ReviewComment {
  id: string;
  review_id: string;
  org_id: string;
  author_id?: string | null;
  author_label: string;
  comment_text: string;
  comment_hash: string;
  created_at: string;
  redacted: boolean;
}

export interface OrgReviewSettings {
  org_id: string;
  enabled: boolean;
  require_second_person: boolean;
  sla_hours: number;
  escalated_digest_days: number;
  qa_sample_rate: number;
  updated_by?: string | null;
  updated_at: string;
}

export interface ReviewPolicy {
  id: string;
  org_id: string;
  source_type: ReviewSource;
  name: string;
  condition?: Record<string, any>;
  min_severity?: ReviewSeverity;
  min_exposure_usd?: number | null;
  min_confidence?: number | null;
  always_gate?: boolean;
  flag_reason?: string;
  required_approvals: number;
  reviewer_hint?: string | null;
  enabled: boolean;
  updated_by?: string | null;
  updated_at: string;
}

export interface GateEvaluationContext {
  sourceType: ReviewSource;
  severity?: ReviewSeverity;
  exposureUsd?: number;
  confidence?: number;
  engine: "llm" | "deterministic_fallback" | string;
  inputText?: string;
  rawText?: string;
  clauseCount?: number;
  hasInstructionLikePhrases?: boolean;
  policies?: ReviewPolicy[];
}

export interface GateEvaluationResult {
  required: boolean;
  riskScore: number;
  severity: ReviewSeverity;
  flagReasons: string[];
  requiredApprovals: number;
  reviewerHint?: string;
  matchedRules: string[];
}

export interface EnqueueReviewParams {
  orgId?: string;
  sourceType: ReviewSource;
  sourceId: string;
  severity: ReviewSeverity;
  summary: string;
  payload: any;
  inputSnapshot: any;
  engine: "llm" | "deterministic_fallback";
  modelName?: string;
  promptVersion?: string;
  confidence?: number;
  gate: GateEvaluationResult;
  submittedBy?: string;
}
