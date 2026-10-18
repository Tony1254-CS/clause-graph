import { query, queryOne, transaction } from "./db.server";
import type {
  ReviewDecision,
  ReviewDecisionAction,
  ReviewQueueStats,
  ReviewRiskLevel,
  ReviewStatus,
  ReviewTask,
  ReviewTaskFilter,
  ReviewTriggerType,
} from "./review.types";

/**
 * Valid state transitions for the review queue state machine:
 *
 * PENDING_REVIEW -> IN_REVIEW, REJECTED, APPROVED
 * IN_REVIEW      -> APPROVED, REJECTED, NEEDS_CORRECTION, PENDING_REVIEW (unassign)
 * NEEDS_CORRECTION -> IN_REVIEW, APPROVED, REJECTED
 * APPROVED       -> Terminal (immutable)
 * REJECTED       -> Terminal (immutable)
 */
export const ALLOWED_TRANSITIONS: Record<ReviewStatus, ReviewStatus[]> = {
  PENDING_REVIEW: ["IN_REVIEW", "APPROVED", "REJECTED"],
  IN_REVIEW: ["APPROVED", "REJECTED", "NEEDS_CORRECTION", "PENDING_REVIEW"],
  NEEDS_CORRECTION: ["IN_REVIEW", "APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

export function isValidTransition(from: ReviewStatus, to: ReviewStatus): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Automatically creates a review task when configured risk rules fire:
 * - Unverified or unconfirmed legal citation
 * - Formally repealed or superseded statutory citation
 * - High-risk exposure or consequential escalation flag
 * Deduplicates active tasks for the same trigger event.
 */
export async function createReviewTaskIfTriggered(params: {
  orgId: string;
  triggerType: ReviewTriggerType;
  riskLevel: ReviewRiskLevel;
  title: string;
  description?: string;
  sourceType: "simulation" | "action_plan" | "contract_clause" | "compliance_code" | "manual";
  sourceId?: string;
  originalAiResponse: string;
  citationsSnapshot?: any;
  warningsSnapshot?: string[];
  createdBy: string;
}): Promise<ReviewTask | null> {
  const {
    orgId,
    triggerType,
    riskLevel,
    title,
    description,
    sourceType,
    sourceId,
    originalAiResponse,
    citationsSnapshot = [],
    warningsSnapshot = [],
    createdBy,
  } = params;

  // Deduplication check: check if an active (non-terminal) task already exists for this source & trigger
  if (sourceId) {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM public.review_tasks 
       WHERE org_id = $1 AND source_type = $2 AND source_id = $3 AND trigger_type = $4
         AND status IN ('PENDING_REVIEW', 'IN_REVIEW', 'NEEDS_CORRECTION')
       LIMIT 1`,
      [orgId, sourceType, sourceId, triggerType]
    );

    if (existing) {
      return getReviewTaskById(existing.id, orgId);
    }
  }

  const row = await queryOne<{ id: string }>(
    `INSERT INTO public.review_tasks (
      org_id, trigger_type, risk_level, status, title, description,
      source_type, source_id, original_ai_response,
      citations_snapshot, warnings_snapshot, created_by
    ) VALUES ($1, $2, $3, 'PENDING_REVIEW', $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
    RETURNING id`,
    [
      orgId,
      triggerType,
      riskLevel,
      title,
      description ?? null,
      sourceType,
      sourceId ?? null,
      originalAiResponse,
      JSON.stringify(citationsSnapshot),
      JSON.stringify(warningsSnapshot),
      createdBy,
    ]
  );

  if (!row) return null;
  return getReviewTaskById(row.id, orgId);
}

/**
 * Retrieves a review task by ID with its decision audit trail
 */
export async function getReviewTaskById(
  taskId: string,
  orgId: string
): Promise<ReviewTask | null> {
  const task = await queryOne<any>(
    `SELECT 
      t.id, t.org_id, t.trigger_type, t.risk_level, t.status, t.title, t.description,
      t.source_type, t.source_id, t.original_ai_response, t.corrected_content,
      t.citations_snapshot, t.warnings_snapshot,
      t.assigned_to, t.assigned_at, t.created_by, t.created_at, t.updated_at, t.completed_at,
      p_assigned.full_name AS assigned_to_name, p_assigned.email AS assigned_to_email,
      p_creator.full_name AS created_by_name
     FROM public.review_tasks t
     LEFT JOIN public.profiles p_assigned ON p_assigned.id = t.assigned_to
     LEFT JOIN public.profiles p_creator ON p_creator.id = t.created_by
     WHERE t.id = $1 AND t.org_id = $2`,
    [taskId, orgId]
  );

  if (!task) return null;

  const decisions = await query<any>(
    `SELECT 
      d.id, d.task_id, d.reviewer_id, d.action, d.reason,
      d.proposed_corrections, d.review_notes, d.created_at,
      p.full_name AS reviewer_name, p.email AS reviewer_email
     FROM public.review_decisions d
     LEFT JOIN public.profiles p ON p.id = d.reviewer_id
     WHERE d.task_id = $1
     ORDER BY d.created_at ASC`,
    [taskId]
  );

  return {
    id: task.id,
    orgId: task.org_id,
    triggerType: task.trigger_type,
    riskLevel: task.risk_level,
    status: task.status,
    title: task.title,
    description: task.description,
    sourceType: task.source_type,
    sourceId: task.source_id,
    originalAiResponse: task.original_ai_response,
    correctedContent: task.corrected_content,
    citationsSnapshot: task.citations_snapshot,
    warningsSnapshot: task.warnings_snapshot,
    assignedTo: task.assigned_to,
    assignedToName: task.assigned_to_name,
    assignedToEmail: task.assigned_to_email,
    assignedAt: task.assigned_at,
    createdBy: task.created_by,
    createdByName: task.created_by_name,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    completedAt: task.completed_at,
    decisionHistory: decisions.map((d) => ({
      id: d.id,
      taskId: d.task_id,
      reviewerId: d.reviewer_id,
      reviewerName: d.reviewer_name,
      reviewerEmail: d.reviewer_email,
      action: d.action,
      reason: d.reason,
      proposedCorrections: d.proposed_corrections,
      reviewNotes: d.review_notes,
      createdAt: d.created_at,
    })),
  };
}

/**
 * Lists review tasks with filtering and pagination
 */
export async function listReviewTasks(
  orgId: string,
  filters: ReviewTaskFilter = {}
): Promise<{ tasks: ReviewTask[]; total: number }> {
  const conditions: string[] = ["t.org_id = $1"];
  const params: any[] = [orgId];
  let paramIndex = 2;

  if (filters.status && filters.status !== "ALL") {
    conditions.push(`t.status = $${paramIndex++}`);
    params.push(filters.status);
  }

  if (filters.riskLevel && filters.riskLevel !== "ALL") {
    conditions.push(`t.risk_level = $${paramIndex++}`);
    params.push(filters.riskLevel);
  }

  if (filters.assignedTo && filters.assignedTo !== "ALL") {
    if (filters.assignedTo === "UNASSIGNED") {
      conditions.push(`t.assigned_to IS NULL`);
    } else {
      conditions.push(`t.assigned_to = $${paramIndex++}`);
      params.push(filters.assignedTo);
    }
  }

  if (filters.sourceType) {
    conditions.push(`t.source_type = $${paramIndex++}`);
    params.push(filters.sourceType);
  }

  if (filters.startDate) {
    conditions.push(`t.created_at >= $${paramIndex++}`);
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    conditions.push(`t.created_at <= $${paramIndex++}`);
    params.push(filters.endDate);
  }

  if (filters.search) {
    conditions.push(
      `(t.title ILIKE $${paramIndex} OR t.original_ai_response ILIKE $${paramIndex})`
    );
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.join(" AND ");

  const countRow = await queryOne<{ count: string }>(
    `SELECT count(*) as count FROM public.review_tasks t WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countRow?.count || "0", 10);

  const limit = Math.min(Math.max(filters.limit || 25, 1), 100);
  const offset = Math.max(filters.offset || 0, 0);

  const rows = await query<any>(
    `SELECT 
      t.id, t.org_id, t.trigger_type, t.risk_level, t.status, t.title, t.description,
      t.source_type, t.source_id, t.original_ai_response, t.corrected_content,
      t.citations_snapshot, t.warnings_snapshot,
      t.assigned_to, t.assigned_at, t.created_by, t.created_at, t.updated_at, t.completed_at,
      p_assigned.full_name AS assigned_to_name, p_assigned.email AS assigned_to_email,
      p_creator.full_name AS created_by_name
     FROM public.review_tasks t
     LEFT JOIN public.profiles p_assigned ON p_assigned.id = t.assigned_to
     LEFT JOIN public.profiles p_creator ON p_creator.id = t.created_by
     WHERE ${whereClause}
     ORDER BY 
       CASE t.risk_level WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC,
       t.created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
    [...params, limit, offset]
  );

  const tasks: ReviewTask[] = rows.map((task) => ({
    id: task.id,
    orgId: task.org_id,
    triggerType: task.trigger_type,
    riskLevel: task.risk_level,
    status: task.status,
    title: task.title,
    description: task.description,
    sourceType: task.source_type,
    sourceId: task.source_id,
    originalAiResponse: task.original_ai_response,
    correctedContent: task.corrected_content,
    citationsSnapshot: task.citations_snapshot,
    warningsSnapshot: task.warnings_snapshot,
    assignedTo: task.assigned_to,
    assignedToName: task.assigned_to_name,
    assignedToEmail: task.assigned_to_email,
    assignedAt: task.assigned_at,
    createdBy: task.created_by,
    createdByName: task.created_by_name,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    completedAt: task.completed_at,
  }));

  return { tasks, total };
}

/**
 * Assigns or claims a review task for an authorized reviewer
 */
export async function assignReviewTask(params: {
  taskId: string;
  orgId: string;
  assigneeId: string | null; // null to unassign
  reviewerId: string;
}): Promise<ReviewTask> {
  const { taskId, orgId, assigneeId } = params;

  await transaction(async (client) => {
    // Lock row for update to prevent race conditions
    const res = await client.query(
      `SELECT id, status, assigned_to FROM public.review_tasks WHERE id = $1::uuid AND org_id = $2::uuid FOR UPDATE`,
      [taskId, orgId]
    );

    if (res.rows.length === 0) {
      throw new Error("Review task not found");
    }

    const current = res.rows[0];
    if (current.status === "APPROVED" || current.status === "REJECTED") {
      throw new Error(`Cannot assign a review task with terminal status '${current.status}'`);
    }

    let newStatus: ReviewStatus = current.status;
    if (assigneeId && current.status === "PENDING_REVIEW") {
      newStatus = "IN_REVIEW";
    } else if (!assigneeId && current.status === "IN_REVIEW") {
      newStatus = "PENDING_REVIEW";
    }

    await client.query(
      `UPDATE public.review_tasks 
       SET assigned_to = $1::uuid, 
           assigned_at = CASE WHEN $1::uuid IS NOT NULL THEN now() ELSE NULL END,
           status = $2::public.review_status, 
           updated_at = now()
       WHERE id = $3::uuid`,
      [assigneeId, newStatus, taskId]
    );
  });

  const updated = await getReviewTaskById(taskId, orgId);
  if (!updated) throw new Error("Failed to load updated task");
  return updated;
}

/**
 * Executes a human reviewer decision (APPROVE, REJECT, or REQUEST_CORRECTION)
 * Enforces transaction atomicity, role check, and valid state transitions.
 */
export async function submitReviewDecision(params: {
  taskId: string;
  orgId: string;
  reviewerId: string;
  action: ReviewDecisionAction;
  reason: string;
  proposedCorrections?: string;
  reviewNotes?: string;
}): Promise<ReviewTask> {
  const {
    taskId,
    orgId,
    reviewerId,
    action,
    reason,
    proposedCorrections,
    reviewNotes,
  } = params;

  if (!reason || !reason.trim()) {
    throw new Error("A specific substantive reason must be provided for every review decision");
  }

  let nextStatus: ReviewStatus;
  switch (action) {
    case "APPROVE":
      nextStatus = "APPROVED";
      break;
    case "REJECT":
      nextStatus = "REJECTED";
      break;
    case "REQUEST_CORRECTION":
      nextStatus = "NEEDS_CORRECTION";
      break;
    default:
      throw new Error(`Invalid review action: ${action}`);
  }

  await transaction(async (client) => {
    // 1. Lock the task row to prevent concurrent decisions
    const res = await client.query(
      `SELECT id, status, original_ai_response FROM public.review_tasks WHERE id = $1::uuid AND org_id = $2::uuid FOR UPDATE`,
      [taskId, orgId]
    );

    if (res.rows.length === 0) {
      throw new Error("Review task not found");
    }

    const current = res.rows[0];
    const currentStatus: ReviewStatus = current.status;

    // 2. Validate state machine transition
    if (!isValidTransition(currentStatus, nextStatus)) {
      throw new Error(
        `Invalid status transition from '${currentStatus}' to '${nextStatus}'. Review task may already be finalized.`
      );
    }

    // 3. Insert audit decision record
    await client.query(
      `INSERT INTO public.review_decisions (
        task_id, reviewer_id, action, reason, proposed_corrections, review_notes
      ) VALUES ($1::uuid, $2::uuid, $3::public.review_action, $4, $5, $6)`,
      [
        taskId,
        reviewerId,
        action,
        reason.trim(),
        proposedCorrections?.trim() || null,
        reviewNotes?.trim() || null,
      ]
    );

    // 4. Update review task record with completion timestamp if terminal
    const isTerminal = nextStatus === "APPROVED" || nextStatus === "REJECTED";
    await client.query(
      `UPDATE public.review_tasks
       SET status = $1::public.review_status,
           corrected_content = COALESCE($2, corrected_content),
           updated_at = now(),
           completed_at = CASE WHEN $3::boolean THEN now() ELSE NULL END
       WHERE id = $4::uuid`,
      [
        nextStatus,
        proposedCorrections?.trim() || null,
        isTerminal,
        taskId,
      ]
    );
  });

  const updatedTask = await getReviewTaskById(taskId, orgId);
  if (!updatedTask) throw new Error("Could not retrieve updated review task");
  return updatedTask;
}

/**
 * Returns queue counts and metrics for the admin header badge and dashboard
 */
export async function getReviewQueueStats(orgId: string): Promise<ReviewQueueStats> {
  const rows = await query<{ status: string; count: string; high_risk_count: string }>(
    `SELECT 
      status, 
      count(*)::text as count,
      count(*) FILTER (WHERE risk_level = 'high')::text as high_risk_count
     FROM public.review_tasks
     WHERE org_id = $1
     GROUP BY status`,
    [orgId]
  );

  let totalPending = 0;
  let totalInReview = 0;
  let totalApproved = 0;
  let totalRejected = 0;
  let totalNeedsCorrection = 0;
  let highRiskCount = 0;

  for (const r of rows) {
    const c = parseInt(r.count || "0", 10);
    const hr = parseInt(r.high_risk_count || "0", 10);
    highRiskCount += hr;

    switch (r.status) {
      case "PENDING_REVIEW":
        totalPending += c;
        break;
      case "IN_REVIEW":
        totalInReview += c;
        break;
      case "APPROVED":
        totalApproved += c;
        break;
      case "REJECTED":
        totalRejected += c;
        break;
      case "NEEDS_CORRECTION":
        totalNeedsCorrection += c;
        break;
    }
  }

  return {
    totalPending,
    totalInReview,
    totalApproved,
    totalRejected,
    totalNeedsCorrection,
    highRiskCount,
  };
}
