/**
 * Human Review Queue Types
 *
 * Ground Rules & Constraints:
 * - Status transitions follow strict state machine rules.
 * - AI must not make consequential legal-aid eligibility, legal-merit, or urgent-escalation decisions autonomously.
 * - Approvals are recorded as human reviewer determinations, not warranties or guarantees of legal correctness.
 * - Original AI responses are preserved in full; reviewer modifications/corrections are recorded separately.
 */

export type ReviewStatus =
  | "PENDING_REVIEW"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "NEEDS_CORRECTION";

export type ReviewRiskLevel = "low" | "medium" | "high";

export type ReviewTriggerType =
  | "UNVERIFIED_CITATION"
  | "REPEALED_CITATION"
  | "SUPERSEDED_CITATION"
  | "AMENDED_STATUTE_UNCERTAINTY"
  | "CONFLICTING_LEGAL_EVIDENCE"
  | "HIGH_EXPOSURE_THRESHOLD"
  | "MANUAL_ESCALATION";

export type ReviewDecisionAction = "APPROVE" | "REJECT" | "REQUEST_CORRECTION";

export interface ReviewDecision {
  id: string;
  taskId: string;
  reviewerId: string;
  reviewerName?: string;
  reviewerEmail?: string;
  action: ReviewDecisionAction;
  reason: string;
  proposedCorrections?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface ReviewTask {
  id: string;
  orgId: string;
  triggerType: ReviewTriggerType;
  riskLevel: ReviewRiskLevel;
  status: ReviewStatus;
  title: string;
  description?: string;
  sourceType: "simulation" | "action_plan" | "contract_clause" | "compliance_code" | "manual";
  sourceId?: string;
  originalAiResponse: string;
  correctedContent?: string;
  citationsSnapshot?: any;
  warningsSnapshot?: string[];
  assignedTo?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  assignedAt?: string | null;
  createdBy: string;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  decisionHistory?: ReviewDecision[];
}

export interface ReviewTaskFilter {
  status?: ReviewStatus | "ALL";
  riskLevel?: ReviewRiskLevel | "ALL";
  assignedTo?: string | "UNASSIGNED" | "ALL";
  sourceType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ReviewQueueStats {
  totalPending: number;
  totalInReview: number;
  totalApproved: number;
  totalRejected: number;
  totalNeedsCorrection: number;
  highRiskCount: number;
}
