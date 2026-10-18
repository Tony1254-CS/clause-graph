import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";
import type {
  ReviewDecisionAction,
  ReviewQueueStats,
  ReviewRiskLevel,
  ReviewStatus,
  ReviewTask,
  ReviewTaskFilter,
} from "./review.types";

/**
 * Server function to list review tasks for the current organization with filters
 */
export const listReviewTasksFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: ReviewTaskFilter) => {
    return {
      status: input?.status ?? "ALL",
      riskLevel: input?.riskLevel ?? "ALL",
      assignedTo: input?.assignedTo ?? "ALL",
      sourceType: input?.sourceType ? String(input.sourceType) : undefined,
      startDate: input?.startDate ? String(input.startDate) : undefined,
      endDate: input?.endDate ? String(input.endDate) : undefined,
      search: input?.search ? String(input.search) : undefined,
      limit: typeof input?.limit === "number" ? input.limit : 50,
      offset: typeof input?.offset === "number" ? input.offset : 0,
    };
  })
  .handler(async ({ data, context }): Promise<{ tasks: ReviewTask[]; total: number }> => {
    const { listReviewTasks } = await import("./review.server");
    return await listReviewTasks(context.orgId, data);
  });

/**
 * Server function to get a single review task and its decision audit trail
 */
export const getReviewTaskFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: { id: string }) => {
    const id = String(input?.id ?? "").trim();
    if (!id) throw new Error("Review task ID is required");
    return { id };
  })
  .handler(async ({ data, context }): Promise<ReviewTask> => {
    const { getReviewTaskById } = await import("./review.server");
    const task = await getReviewTaskById(data.id, context.orgId);
    if (!task) throw new Error("Review task not found or access denied");
    return task;
  });

/**
 * Server function to get review queue summary counts
 */
export const getReviewStatsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<ReviewQueueStats> => {
    const { getReviewQueueStats } = await import("./review.server");
    return await getReviewQueueStats(context.orgId);
  });

/**
 * Server function to assign/claim a review task (requires authenticated user)
 */
export const assignReviewTaskFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { taskId: string; assigneeId?: string | null }) => {
    const taskId = String(input?.taskId ?? "").trim();
    if (!taskId) throw new Error("Task ID is required");
    const assigneeId = input?.assigneeId !== undefined ? input.assigneeId : undefined;
    return { taskId, assigneeId };
  })
  .handler(async ({ data, context }): Promise<ReviewTask> => {
    const { assignReviewTask } = await import("./review.server");
    // If assigneeId is undefined, default to self-claiming
    const targetAssignee =
      data.assigneeId !== undefined ? data.assigneeId : context.userId;

    return await assignReviewTask({
      taskId: data.taskId,
      orgId: context.orgId,
      assigneeId: targetAssignee,
      reviewerId: context.userId,
    });
  });

/**
 * Server function to submit a review decision (APPROVE, REJECT, REQUEST_CORRECTION)
 */
export const submitReviewDecisionFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: {
    taskId: string;
    action: ReviewDecisionAction;
    reason: string;
    proposedCorrections?: string;
    reviewNotes?: string;
  }) => {
    const taskId = String(input?.taskId ?? "").trim();
    if (!taskId) throw new Error("Task ID is required");
    const action = input?.action;
    if (action !== "APPROVE" && action !== "REJECT" && action !== "REQUEST_CORRECTION") {
      throw new Error("Invalid review action. Must be APPROVE, REJECT, or REQUEST_CORRECTION");
    }
    const reason = String(input?.reason ?? "").trim();
    if (!reason) throw new Error("Substantive legal justification/reason is required");
    return {
      taskId,
      action,
      reason,
      proposedCorrections: input?.proposedCorrections ? String(input.proposedCorrections) : undefined,
      reviewNotes: input?.reviewNotes ? String(input.reviewNotes) : undefined,
    };
  })
  .handler(async ({ data, context }): Promise<ReviewTask> => {
    const { submitReviewDecision } = await import("./review.server");
    return await submitReviewDecision({
      taskId: data.taskId,
      orgId: context.orgId,
      reviewerId: context.userId,
      action: data.action,
      reason: data.reason,
      proposedCorrections: data.proposedCorrections,
      reviewNotes: data.reviewNotes,
    });
  });

/**
 * Server function to manually trigger or escalate a review task
 */
export const createManualReviewTaskFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: {
    title: string;
    description?: string;
    sourceType?: "simulation" | "action_plan" | "contract_clause" | "compliance_code" | "manual";
    sourceId?: string;
    contentToReview: string;
    riskLevel?: ReviewRiskLevel;
  }) => {
    const title = String(input?.title ?? "").trim();
    if (!title) throw new Error("Title is required");
    const content = String(input?.contentToReview ?? "").trim();
    if (!content) throw new Error("Content to review is required");
    return {
      title,
      description: input?.description ? String(input.description) : undefined,
      sourceType: input?.sourceType ?? "manual",
      sourceId: input?.sourceId ? String(input.sourceId) : undefined,
      contentToReview: content,
      riskLevel: input?.riskLevel ?? "medium",
    };
  })
  .handler(async ({ data, context }): Promise<ReviewTask | null> => {
    const { createReviewTaskIfTriggered } = await import("./review.server");
    const { verifyCitations } = await import("./citation-verifier");

    const audit = verifyCitations(data.contentToReview);
    const warnings = audit.findings
      .map((f) => f.warningMessage)
      .filter((w): w is string => Boolean(w));

    return await createReviewTaskIfTriggered({
      orgId: context.orgId,
      triggerType: "MANUAL_ESCALATION",
      riskLevel: data.riskLevel,
      title: data.title,
      description: data.description,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      originalAiResponse: data.contentToReview,
      citationsSnapshot: audit.findings,
      warningsSnapshot: warnings,
      createdBy: context.userId,
    });
  });
