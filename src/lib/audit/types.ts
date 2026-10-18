// ============================================================================
// Audit Log Types & Contracts: src/lib/audit/types.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (v2.0)
// ============================================================================

export type AuditActionCategory =
  | "auth"
  | "contract"
  | "ai"
  | "review"
  | "artifact"
  | "governance"
  | "audit";

export type AuditAction =
  // Identity and access
  | "auth.login"
  | "auth.login_failed"
  | "role.granted"
  | "role.revoked"
  | "member.invited"
  | "member.removed"
  // Contracts & clauses
  | "contract.uploaded"
  | "contract.parsed"
  | "contract.clause_flagged"
  | "contract.deleted"
  | "clause.edited"
  // AI runs & predictions
  | "simulation.run"
  | "simulation.fallback_activated"
  | "whatif.run"
  | "code.generated"
  | "action_plan.generated"
  | "prediction.run"
  // Review decisions
  | "review.created"
  | "review.assigned"
  | "review.approved"
  | "review.rejected"
  | "review.edited"
  | "review.comment_added"
  | "review.escalated"
  | "review.marked_stale"
  // Artifacts & exports
  | "artifact.generated"
  | "artifact.exported"
  | "artifact.deployed"
  | "action_plan.exported_pdf"
  // Governance
  | "policy.updated"
  | "workspace.deletion_requested"
  | "workspace.deletion_cancelled"
  // Audit itself
  | "audit.exported"
  | "audit.verified"
  | "audit.correction";

export interface AuditEvent<TBefore = any, TAfter = any, TBasis = any> {
  id: number;
  org_id: string;
  actor_id: string | null;
  actor_role: "admin" | "member";
  actor_label?: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  correlation_id: string | null;
  before: TBefore | null;
  after: TAfter | null;
  basis: TBasis | null;
  metadata: Record<string, any>;
  hash_version: number;
  created_at: string;
  prev_hash: string;
  row_hash: string;
}

export interface WriteAuditParams<TBefore = any, TAfter = any, TBasis = any> {
  orgId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorId?: string | null;
  actorRole?: "admin" | "member";
  correlationId?: string | null;
  before?: TBefore | null;
  after?: TAfter | null;
  basis?: TBasis | null;
  metadata?: Record<string, any>;
}

export interface AuditFilterParams {
  startDate?: string;
  endDate?: string;
  actorId?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  correlationId?: string;
  cursor?: number;
  limit?: number;
}

export interface AuditVerificationResult {
  valid: boolean;
  rows_checked: number;
  head_id?: number;
  head_hash?: string;
  first_bad_id?: number;
  error?: string;
  anchor_status?: {
    anchored: boolean;
    trusted_head_id?: number;
    trusted_head_hash?: string;
    trusted_count?: number;
    anchor_age_hours?: number;
    mismatch_detected?: boolean;
    mismatch_reason?: string;
  };
}

export interface ExternalAuditAnchor {
  org_id: string;
  head_id: number;
  head_hash: string;
  row_count: number;
  anchored_at: string;
  signature?: string;
}
