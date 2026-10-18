// ============================================================================
// Server Functions: src/lib/review/review.functions.ts
// TanStack Start server functions for the Human Review Queue API surface
// ============================================================================

import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "../auth-middleware";
import { query, queryOne } from "../db.server";
import { requireApproved, ReviewGateError } from "./gate.server";
import type {
  ReviewItem,
  ReviewEvent,
  ReviewComment,
  ReviewStatus,
  ReviewSource,
  ReviewSeverity,
  ReviewReasonCode,
} from "./types";

/**
 * Fetch reviews in the queue with filtering and pagination
 */
export const fetchReviewQueue = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator(
    (input?: {
      status?: ReviewStatus | "all";
      sourceType?: ReviewSource | "all";
      severity?: ReviewSeverity | "all";
      search?: string;
      limit?: number;
      offset?: number;
    }) => ({
      status: input?.status || "pending_review",
      sourceType: input?.sourceType || "all",
      severity: input?.severity || "all",
      search: input?.search?.trim() || "",
      limit: Math.min(input?.limit || 50, 100),
      offset: Math.max(input?.offset || 0, 0),
    })
  )
  .handler(async ({ data, context }) => {
    const { orgId } = context;
    const conditions: string[] = ["org_id = $1"];
    const params: any[] = [orgId];
    let idx = 2;

    if (data.status && data.status !== "all") {
      conditions.push(`status = $${idx++}`);
      params.push(data.status);
    }

    if (data.sourceType && data.sourceType !== "all") {
      conditions.push(`source_type = $${idx++}`);
      params.push(data.sourceType);
    }

    if (data.severity && data.severity !== "all") {
      conditions.push(`severity = $${idx++}`);
      params.push(data.severity);
    }

    if (data.search) {
      conditions.push(`(risk_summary ILIKE $${idx} OR model_name ILIKE $${idx})`);
      params.push(`%${data.search}%`);
      idx++;
    }

    const whereClause = conditions.join(" AND ");

    try {
      const [items, countRow, escalatedRow] = await Promise.all([
        query<ReviewItem>(
          `SELECT * FROM public.review_items
           WHERE ${whereClause}
           ORDER BY 
             CASE status 
               WHEN 'escalated' THEN 1 
               WHEN 'pending_review' THEN 2 
               ELSE 3 
             END ASC,
             risk_score DESC, 
             created_at ASC
           LIMIT $${idx++} OFFSET $${idx++}`,
          [...params, data.limit, data.offset]
        ),
        queryOne<{ count: string }>(
          `SELECT count(*)::text AS count FROM public.review_items WHERE ${whereClause}`,
          params
        ),
        queryOne<{ count: string }>(
          `SELECT count(*)::text AS count FROM public.review_items 
           WHERE org_id = $1 AND status = 'escalated'`,
          [orgId]
        ),
      ]);

      return {
        items: items ?? [],
        totalCount: parseInt(countRow?.count || "0", 10),
        escalatedCount: parseInt(escalatedRow?.count || "0", 10),
      };
    } catch (err) {
      console.warn("[Review Functions] fetchReviewQueue query failed, returning empty:", err);
      return {
        items: [],
        totalCount: 0,
        escalatedCount: 0,
      };
    }
  });

/**
 * Fetch complete review item detail, hash-chained events, and chain verification
 */
export const fetchReviewDetail = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: { reviewId: string }) => {
    if (!input?.reviewId) throw new Error("Review ID required");
    return { reviewId: input.reviewId };
  })
  .handler(async ({ data, context }) => {
    const { orgId } = context;

    try {
      // 1. Log viewed event for anti-rubber-stamping telemetry
      await query(`SELECT public.log_review_view($1)`, [data.reviewId]).catch(() => {});

      // 2. Fetch item, events, comments, and chain verification
      const [item, events, comments, verification] = await Promise.all([
        queryOne<ReviewItem>(
          `SELECT * FROM public.review_items WHERE id = $1 AND org_id = $2`,
          [data.reviewId, orgId]
        ),
        query<ReviewEvent>(
          `SELECT * FROM public.review_events WHERE review_id = $1 ORDER BY id ASC`,
          [data.reviewId]
        ),
        query<ReviewComment>(
          `SELECT * FROM public.review_comments WHERE review_id = $1 ORDER BY created_at ASC`,
          [data.reviewId]
        ),
        queryOne<{ verify: { valid: boolean; event_count: number; error?: string } }>(
          `SELECT public.verify_review_chain($1) AS verify`,
          [data.reviewId]
        ),
      ]);

      if (!item) {
        throw new Error("Review item not found");
      }

      return {
        item,
        events: events ?? [],
        comments: comments ?? [],
        verification: verification?.verify ?? { valid: true, event_count: (events ?? []).length },
      };
    } catch (err) {
      console.error("[Review Functions] fetchReviewDetail error:", err);
      throw new Error(err instanceof Error ? err.message : "Failed to load review details");
    }
  });

/**
 * Submit human decision (approve, reject, edit-and-approve)
 */
export const decideReview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (input: {
      id: string;
      version: number;
      decision: "approved" | "rejected";
      reason?: string;
      reasonCode?: ReviewReasonCode;
      editedPayload?: any;
    }) => {
      if (!input?.id) throw new Error("Review ID required");
      if (input.decision !== "approved" && input.decision !== "rejected") {
        throw new Error("Decision must be 'approved' or 'rejected'");
      }
      return {
        id: input.id,
        version: Number(input.version),
        decision: input.decision,
        reason: input.reason?.trim() || undefined,
        reasonCode: input.reasonCode,
        editedPayload: input.editedPayload,
      };
    }
  )
  .handler(async ({ data, context }) => {
    const { role } = context;

    if (role !== "admin") {
      throw new Error("Permission Denied: Only administrators can decide review items.");
    }

    if (data.decision === "rejected" && (!data.reason || data.reason.length < 10)) {
      throw new Error("Validation Error: A rejection reason of at least 10 characters is mandatory.");
    }

    try {
      const updated = await queryOne<ReviewItem>(
        `SELECT * FROM public.decide_review($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          data.id,
          data.version,
          data.decision,
          data.reason || null,
          data.reasonCode || null,
          data.editedPayload ? JSON.stringify(data.editedPayload) : null,
        ]
      );

      // Human Review Queue Feedback Loop (§21): Stage rejected or edited items as candidate fixtures
      if (updated && (data.decision === "rejected" || data.editedPayload != null)) {
        try {
          const { stageCandidateFromReview } = await import("../audit/candidate-stage.server");
          await stageCandidateFromReview({
            reviewItem: updated,
            decision: data.decision,
            reason: data.reason,
            editedPayload: data.editedPayload,
            reviewerId: context.userId || context.user?.id || "admin",
          });
        } catch (stageErr) {
          console.warn("[Review Feedback Loop] Failed to stage candidate fixture:", stageErr);
        }
      }

      return { success: true, item: updated };
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("version conflict") || err.code === "40001") {
        throw new Error(
          "Conflict (409): This review item has already been modified or decided by another administrator. Please refresh."
        );
      }
      if (msg.includes("a second person must decide")) {
        throw new Error("Separation of Duties: Organization policy requires a second administrator to approve this output.");
      }
      if (msg.includes("a reason of at least 10 characters is required")) {
        throw new Error("A detailed reason (min 10 characters) is required for this decision.");
      }
      console.error("[Review Functions] decideReview error:", err);
      throw new Error(msg || "Failed to record decision");
    }
  });

/**
 * Assign a review item to an admin
 */
export const assignReview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { id: string; userId: string }) => {
    if (!input?.id) throw new Error("Review ID required");
    if (!input?.userId) throw new Error("User ID required");
    return { id: input.id, userId: input.userId };
  })
  .handler(async ({ data, context }) => {
    const { role } = context;
    if (role !== "admin") {
      throw new Error("Permission Denied: Only administrators can assign review items.");
    }

    try {
      const item = await queryOne<ReviewItem>(
        `SELECT * FROM public.assign_review($1, $2)`,
        [data.id, data.userId]
      );
      return { success: true, item };
    } catch (err) {
      console.error("[Review Functions] assignReview error:", err);
      throw new Error(err instanceof Error ? err.message : "Failed to assign review");
    }
  });

/**
 * Add a comment to a review item
 */
export const commentOnReview = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { id: string; text: string }) => {
    const text = input?.text?.trim();
    if (!input?.id) throw new Error("Review ID required");
    if (!text) throw new Error("Comment text cannot be empty");
    return { id: input.id, text };
  })
  .handler(async ({ data }) => {
    try {
      const comment = await queryOne<ReviewComment>(
        `SELECT * FROM public.comment_review($1, $2)`,
        [data.id, data.text]
      );
      return { success: true, comment };
    } catch (err) {
      console.error("[Review Functions] commentOnReview error:", err);
      throw new Error(err instanceof Error ? err.message : "Failed to post comment");
    }
  });

/**
 * Get review badge statistics for the sidebar and notifications
 */
export const getReviewBadgeStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { orgId } = context;

    try {
      const stats = await queryOne<{ pending_count: string; escalated_count: string }>(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'pending_review')::text AS pending_count,
           COUNT(*) FILTER (WHERE status = 'escalated')::text AS escalated_count
         FROM public.review_items
         WHERE org_id = $1`,
        [orgId]
      );

      return {
        pendingCount: parseInt(stats?.pending_count || "0", 10),
        escalatedCount: parseInt(stats?.escalated_count || "0", 10),
      };
    } catch {
      return { pendingCount: 0, escalatedCount: 0 };
    }
  });

/**
 * Server check before allowing user to copy or export Compliance-as-Code
 */
export const verifyCodeApproval = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { artifactId: string; code: any }) => {
    if (!input?.artifactId) throw new Error("Artifact ID required");
    return { artifactId: input.artifactId, code: input.code };
  })
  .handler(async ({ data }) => {
    try {
      await requireApproved("compliance_artifact", data.artifactId, data.code);
      return { approved: true };
    } catch (err) {
      if (err instanceof ReviewGateError) {
        return { approved: false, error: err.message };
      }
      return { approved: false, error: "Output has not been approved by an administrator." };
    }
  });

/**
 * Restricted bulk decision (§10.1)
 * Bulk approve ONLY for 'clause' items with low/medium severity and confidence >= 0.60
 * Bulk reject allowed with mandatory reason
 */
export const bulkDecideReviews = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (input: {
      ids: string[];
      decision: "approved" | "rejected";
      reason: string;
      reasonCode?: ReviewReasonCode;
    }) => {
      if (!input?.ids || input.ids.length === 0) throw new Error("At least one item required");
      if (input.ids.length > 25) throw new Error("Bulk operations are capped at 25 items");
      if (!input.reason || input.reason.trim().length < 10) {
        throw new Error("A reason of at least 10 characters is required for bulk actions");
      }
      return {
        ids: input.ids,
        decision: input.decision,
        reason: input.reason.trim(),
        reasonCode: input.reasonCode,
      };
    }
  )
  .handler(async ({ data, context }) => {
    const { orgId, role } = context;
    if (role !== "admin") {
      throw new Error("Permission Denied: Admin role required for bulk decisions.");
    }

    // Safety check: if approving, verify no items are high severity, compliance code, or action plan
    if (data.decision === "approved") {
      const restricted = await query<ReviewItem>(
        `SELECT id, source_type, severity, confidence FROM public.review_items
         WHERE id = ANY($1::uuid[]) AND org_id = $2
           AND (
             severity = 'high' 
             OR source_type IN ('compliance_artifact', 'action_plan')
             OR (confidence IS NOT NULL AND confidence < 0.60)
           )`,
        [data.ids, orgId]
      );

      if (restricted && restricted.length > 0) {
        throw new Error(
          "Safety Policy Violation (§10.1): Bulk approval is strictly prohibited for high-severity items, generated code, action plans, or extractions with confidence < 0.60."
        );
      }
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const id of data.ids) {
      try {
        const item = await queryOne<ReviewItem>(
          `SELECT version FROM public.review_items WHERE id = $1 AND org_id = $2`,
          [id, orgId]
        );
        if (item) {
          await queryOne(
            `SELECT * FROM public.decide_review($1, $2, $3, $4, $5, NULL)`,
            [id, item.version, data.decision, data.reason, data.reasonCode || null]
          );
          successCount++;
        }
      } catch (err: any) {
        errors.push(`Item ${id}: ${err.message || "Failed"}`);
      }
    }

    return { successCount, total: data.ids.length, errors };
  });

/**
 * Export audit history for regulatory and compliance inspection (§14)
 */
export const exportAuditReport = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input?: { format?: "json" | "csv" }) => ({
    format: input?.format || "json",
  }))
  .handler(async ({ data, context }) => {
    const { orgId, role } = context;
    if (role !== "admin") {
      throw new Error("Permission Denied: Only administrators can export audit history.");
    }

    try {
      const items = await query<any>(
        `SELECT 
           i.id, i.source_type, i.status, i.severity, i.risk_score, i.risk_summary,
           i.engine, i.model_name, i.prompt_version, i.confidence,
           i.output_hash, i.input_hash, i.reviewed_hash,
           i.decided_by_label, i.decided_at, i.decision_reason, i.reason_code,
           i.created_at, i.sla_due_at
         FROM public.review_items i
         WHERE i.org_id = $1
         ORDER BY i.created_at DESC
         LIMIT 500`,
        [orgId]
      );

      if (data.format === "csv") {
        const headers = [
          "ID",
          "Source Type",
          "Status",
          "Severity",
          "Risk Score",
          "Summary",
          "Engine",
          "Decided By",
          "Decided At",
          "Reason Code",
          "Decision Reason",
          "Output Hash",
          "Created At",
        ];
        const rows = (items ?? []).map((it) => [
          it.id,
          it.source_type,
          it.status,
          it.severity,
          it.risk_score,
          `"${(it.risk_summary || "").replace(/"/g, '""')}"`,
          it.engine,
          it.decided_by_label || "",
          it.decided_at || "",
          it.reason_code || "",
          `"${(it.decision_reason || "").replace(/"/g, '""')}"`,
          it.reviewed_hash || it.output_hash,
          it.created_at,
        ]);
        const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        return { format: "csv", content: csvContent };
      }

      return { format: "json", content: items ?? [] };
    } catch (err) {
      console.error("[Review Functions] exportAuditReport error:", err);
      throw new Error("Failed to generate audit export");
    }
  });

/**
 * Fetch review-derived candidates staged for evaluation golden datasets (§21)
 */
export const getStagedReviewCandidates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { role } = context;
    if (role !== "admin") {
      throw new Error("Permission Denied: Only administrators can view evaluation candidate fixtures.");
    }

    const { listStagedCandidates } = await import("../audit/candidate-stage.server");
    return { candidates: listStagedCandidates() };
  });

/**
 * Promote an approved review candidate into an active golden dataset (§21.4, §21.5)
 */
export const promoteReviewCandidate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { candidateId: string; targetClass: "landmark" | "synthetic" | "negative" | "adversarial" }) => {
    if (!input?.candidateId) throw new Error("Candidate ID required");
    if (!["landmark", "synthetic", "negative", "adversarial"].includes(input.targetClass)) {
      throw new Error("Invalid target dataset class. (Note: holdout promotion is forbidden per §21.5)");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const { role, userId } = context;
    if (role !== "admin") {
      throw new Error("Permission Denied: Only administrators can promote candidate fixtures.");
    }

    const { approveCandidateFixture } = await import("../audit/candidate-stage.server");
    return await approveCandidateFixture(data.candidateId, data.targetClass, userId || "admin");
  });

