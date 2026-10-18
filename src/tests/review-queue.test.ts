import test from "node:test";
import assert from "node:assert/strict";

import {
  createReviewTaskIfTriggered,
  getReviewTaskById,
  listReviewTasks,
  assignReviewTask,
  submitReviewDecision,
  isValidTransition,
  getReviewQueueStats,
} from "../lib/review.server.js";
import { query } from "../lib/db.server.js";

// Helper to acquire a valid org_id and user_id for test execution
async function getTestFixtures() {
  const users = await query<{ id: string; org_id: string }>(
    `SELECT u.id, p.org_id FROM auth.users u JOIN public.profiles p ON p.id = u.id LIMIT 2`
  );
  if (!users || users.length === 0) {
    throw new Error("No test users found in database");
  }
  return {
    reviewer1: users[0].id,
    reviewer2: users[1]?.id ?? users[0].id,
    orgId: users[0].org_id,
  };
}

test("Review State Machine: validates transition rules correctly", () => {
  // Valid transitions
  assert.equal(isValidTransition("PENDING_REVIEW", "IN_REVIEW"), true);
  assert.equal(isValidTransition("PENDING_REVIEW", "APPROVED"), true);
  assert.equal(isValidTransition("PENDING_REVIEW", "REJECTED"), true);
  assert.equal(isValidTransition("IN_REVIEW", "APPROVED"), true);
  assert.equal(isValidTransition("IN_REVIEW", "REJECTED"), true);
  assert.equal(isValidTransition("IN_REVIEW", "NEEDS_CORRECTION"), true);
  assert.equal(isValidTransition("NEEDS_CORRECTION", "IN_REVIEW"), true);

  // Terminal state immutability
  assert.equal(isValidTransition("APPROVED", "IN_REVIEW"), false);
  assert.equal(isValidTransition("APPROVED", "PENDING_REVIEW"), false);
  assert.equal(isValidTransition("APPROVED", "REJECTED"), false);
  assert.equal(isValidTransition("REJECTED", "APPROVED"), false);
  assert.equal(isValidTransition("REJECTED", "IN_REVIEW"), false);
});

test("Review Tasks: creation, assignment, claiming, and audit history", async () => {
  const { reviewer1, reviewer2, orgId } = await getTestFixtures();

  // 1. Create a review task triggered by an unverified citation
  const task = await createReviewTaskIfTriggered({
    orgId,
    triggerType: "UNVERIFIED_CITATION",
    riskLevel: "high",
    title: "Test Audit: AI cited unverified Martian Mineral Law",
    description: "Automated trigger due to 0 matching authoritative primary gazette records.",
    sourceType: "simulation",
    sourceId: `test-sim-${Date.now()}`,
    originalAiResponse: "Under Martian Mining Code 2045 § 12, export duties apply.",
    citationsSnapshot: [{ rawText: "Martian Mining Code 2045" }],
    warningsSnapshot: ["Unverified statutory reference"],
    createdBy: reviewer1,
  });

  assert.ok(task, "Task should be created successfully");
  assert.equal(task?.status, "PENDING_REVIEW");
  assert.equal(task?.riskLevel, "high");

  // 2. Claim task (assignment transitions from PENDING_REVIEW -> IN_REVIEW)
  const claimed = await assignReviewTask({
    taskId: task!.id,
    orgId,
    assigneeId: reviewer1,
    reviewerId: reviewer1,
  });

  assert.equal(claimed.status, "IN_REVIEW");
  assert.equal(claimed.assignedTo, reviewer1);

  // 3. Request correction with mandatory proposed substitute language
  const corrected = await submitReviewDecision({
    taskId: task!.id,
    orgId,
    reviewerId: reviewer1,
    action: "REQUEST_CORRECTION",
    reason: "Statute does not exist. Citing party must replace with SEC Rule 17a-4.",
    proposedCorrections: "Under SEC Rule 17a-4, broker-dealer record retention applies.",
  });

  assert.equal(corrected.status, "NEEDS_CORRECTION");
  assert.ok(corrected.correctedContent?.includes("SEC Rule 17a-4"));
  assert.ok(corrected.decisionHistory && corrected.decisionHistory.length >= 1);

  // 4. Subsequent Approval of corrected review
  const approved = await submitReviewDecision({
    taskId: task!.id,
    orgId,
    reviewerId: reviewer2,
    action: "APPROVE",
    reason: "Corrected citation to SEC Rule 17a-4 verified in official eCFR registry.",
  });

  assert.equal(approved.status, "APPROVED");
  assert.ok(approved.completedAt, "Terminal task must set completedAt timestamp");
  assert.equal(approved.decisionHistory?.length, 2, "Decision audit trail must record both decisions");
});

test("Review Tasks: Deduplication prevents redundant active tasks for identical source trigger", async () => {
  const { reviewer1, orgId } = await getTestFixtures();
  const sourceId = `dedup-source-${Date.now()}`;

  const task1 = await createReviewTaskIfTriggered({
    orgId,
    triggerType: "REPEALED_CITATION",
    riskLevel: "high",
    title: "Dedup Test Task",
    sourceType: "simulation",
    sourceId,
    originalAiResponse: "Directive 95/46/EC is cited.",
    createdBy: reviewer1,
  });

  // Second invocation for the exact same event
  const task2 = await createReviewTaskIfTriggered({
    orgId,
    triggerType: "REPEALED_CITATION",
    riskLevel: "high",
    title: "Dedup Test Task 2",
    sourceType: "simulation",
    sourceId,
    originalAiResponse: "Directive 95/46/EC is cited.",
    createdBy: reviewer1,
  });

  assert.equal(task1?.id, task2?.id, "Must return existing active task instead of creating a duplicate");
});

test("Review Security: Prevents decision without substantive reason and prevents invalid transitions", async () => {
  const { reviewer1, orgId } = await getTestFixtures();

  const task = await createReviewTaskIfTriggered({
    orgId,
    triggerType: "MANUAL_ESCALATION",
    riskLevel: "medium",
    title: "Security Test Task",
    sourceType: "manual",
    sourceId: `sec-${Date.now()}`,
    originalAiResponse: "Sample legal clause needing sign-off.",
    createdBy: reviewer1,
  });

  assert.ok(task);

  // Reject decision with empty reason
  await assert.rejects(
    async () => {
      await submitReviewDecision({
        taskId: task!.id,
        orgId,
        reviewerId: reviewer1,
        action: "REJECT",
        reason: "   ",
      });
    },
    /substantive reason/i
  );

  // Approve task
  const approved = await submitReviewDecision({
    taskId: task!.id,
    orgId,
    reviewerId: reviewer1,
    action: "APPROVE",
    reason: "Verified and approved.",
  });
  assert.equal(approved.status, "APPROVED");

  // Attempt invalid transition on terminal task
  await assert.rejects(
    async () => {
      await submitReviewDecision({
        taskId: task!.id,
        orgId,
        reviewerId: reviewer1,
        action: "REJECT",
        reason: "Attempting to reject an already approved task.",
      });
    },
    /Invalid status transition/i
  );
});

test("Review Queue Stats: Computes pending, in_review, and high risk metrics", async () => {
  const { orgId } = await getTestFixtures();
  const stats = await getReviewQueueStats(orgId);

  assert.equal(typeof stats.totalPending, "number");
  assert.equal(typeof stats.totalInReview, "number");
  assert.equal(typeof stats.totalApproved, "number");
  assert.equal(typeof stats.totalRejected, "number");
  assert.equal(typeof stats.highRiskCount, "number");
});
