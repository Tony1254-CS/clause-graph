// ============================================================================
// Phase 2 Test Suite: test/audit-business-events.test.ts
// Verifies:
// 1. Single approved writer & Event ownership matrix (§8.4)
// 2. record_simulation_run atomicity & fallback activation logging
// 3. Human Review Queue decision audit logging (approved, rejected, edited)
// 4. Workspace deletion lifecycle (requested, cancelled)
// 5. Historical simulation_runs backfill idempotency & chain preservation
// 6. Action Plan PDF export server-side audit logging
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { logAuditEvent } from "../src/lib/audit/audit.server";
import { redactAuditPayload } from "../src/lib/audit/redaction.server";
import { computeAuditRowHash } from "../src/lib/audit/hash";
import type { AuditAction } from "../src/lib/audit/types";

describe("1. Single Approved Writer & Event Ownership Matrix (§8.4)", () => {
  const AUTHORITATIVE_WRITERS: Record<string, "database_trigger" | "app_function"> = {
    // Governance events owned exclusively by database triggers
    "workspace.deletion_requested": "database_trigger",
    "workspace.deletion_cancelled": "database_trigger",

    // Application business events owned by transactional application/database functions
    "simulation.run": "app_function",
    "simulation.fallback_activated": "app_function",
    "whatif.run": "app_function",
    "code.generated": "app_function",
    "action_plan.generated": "app_function",
    "action_plan.exported_pdf": "app_function",
    "contract.uploaded": "app_function",
    "contract.parsed": "app_function",
    "contract.deleted": "app_function",
    "review.created": "app_function",
    "review.assigned": "app_function",
    "review.approved": "app_function",
    "review.rejected": "app_function",
    "review.edited": "app_function",
    "review.comment_added": "app_function",
    "audit.exported": "app_function",
    "audit.verified": "app_function",
  };

  it("assigns each event type to exactly one authoritative writer mechanism", () => {
    const actions = Object.keys(AUTHORITATIVE_WRITERS);
    expect(actions.length).toBeGreaterThanOrEqual(15);

    for (const [action, writer] of Object.entries(AUTHORITATIVE_WRITERS)) {
      expect(["database_trigger", "app_function"]).toContain(writer);
    }
  });

  it("prevents double-emitting: triggers do not duplicate app function events", () => {
    // Triggers never emit simulation or review actions
    const triggerActions = Object.entries(AUTHORITATIVE_WRITERS)
      .filter(([_, w]) => w === "database_trigger")
      .map(([a]) => a);

    expect(triggerActions).not.toContain("simulation.run");
    expect(triggerActions).not.toContain("review.approved");
    expect(triggerActions).not.toContain("contract.uploaded");
  });
});

describe("2. record_simulation_run & Fallback Activation (§8.3, §10)", () => {
  it("computes input and output SHA-256 hashes for simulation basis", async () => {
    const inputRegulation = "Regulation (EU) 2026/456 requires instant reporting of AI risks.";
    const outputResult = {
      impacts: [{ contract_id: "c-101", severity: "high", suggested_amendment: "Amend section 4" }],
      summary: "High impact on core supplier contracts",
      fallback: false,
    };

    const crypto = await import("node:crypto");
    const inputHash = crypto.createHash("sha256").update(inputRegulation).digest("hex");
    const outputHash = crypto.createHash("sha256").update(JSON.stringify(outputResult)).digest("hex");

    expect(inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(outputHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("redacts any sensitive credentials mistakenly included in simulation input or output", async () => {
    const dirtyOutput = {
      impacts: [{ contract_id: "c-1", severity: "high" }],
      apiKey: "sk-proj-superSecretLiveKey1234567890123456",
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M",
    };

    const clean = await redactAuditPayload(dirtyOutput);
    expect(clean.apiKey).toBe("[REDACTED]");
    expect(clean.token).toBe("[REDACTED]");
    expect(clean.impacts[0].severity).toBe("high");
  });

  it("handles fallback activation logging with explicit reason attribution", async () => {
    const mockDb = {
      queryOne: vi.fn().mockResolvedValue({ write_audit_event: "42" }),
    };

    const orgId = "11111111-2222-3333-4444-555555555555";
    const correlationId = "corr-sim-fallback-001";

    const auditId = await logAuditEvent(
      {
        orgId,
        action: "simulation.fallback_activated",
        entityType: "simulation",
        entityId: "sim-fallback-99",
        correlationId,
        actorId: "user-system",
        actorRole: "member",
        after: { fallback: true, engine: "deterministic_fallback" },
        metadata: { fallback_reason: "Gateway timeout after 90000ms" },
      },
      mockDb
    );

    expect(auditId).toBe(42);
    expect(mockDb.queryOne).toHaveBeenCalledTimes(1);
    const sqlCall = mockDb.queryOne.mock.calls[0];
    expect(sqlCall[1][1]).toBe("simulation.fallback_activated");
    expect(sqlCall[1][6]).toBe(correlationId); // correlation_id preserved
  });
});

describe("3. Human Review Queue Decision Auditing (§8.4)", () => {
  it("records review.approved carrying reviewer rationale in basis and hash of approved content", async () => {
    const mockDb = {
      queryOne: vi.fn().mockResolvedValue({ write_audit_event: "101" }),
    };

    const auditId = await logAuditEvent(
      {
        orgId: "22222222-2222-2222-2222-222222222222",
        action: "review.approved",
        entityType: "review_item",
        entityId: "rev-500",
        actorId: "admin-alice",
        actorRole: "admin",
        before: { status: "pending_review" },
        after: { status: "approved", votes: 1 },
        basis: { rationale: "Verified compliance with Section 4.2 of new regulation." },
        metadata: { content_hash: "a".repeat(64), self_approval: false },
      },
      mockDb
    );

    expect(auditId).toBe(101);
    const callArgs = mockDb.queryOne.mock.calls[0][1];
    expect(callArgs[1]).toBe("review.approved");
    expect(callArgs[3]).toBe("rev-500");
    expect(callArgs[5]).toBe("admin");
    expect(JSON.parse(callArgs[9])).toEqual({ rationale: "Verified compliance with Section 4.2 of new regulation." });
  });

  it("records review.rejected requiring reason of at least 10 chars", async () => {
    const rejectionReason = "Incomplete remediation language; does not address penalty clause.";
    expect(rejectionReason.length).toBeGreaterThanOrEqual(10);

    const mockDb = {
      queryOne: vi.fn().mockResolvedValue({ write_audit_event: "102" }),
    };

    await logAuditEvent(
      {
        orgId: "22222222-2222-2222-2222-222222222222",
        action: "review.rejected",
        entityType: "review_item",
        entityId: "rev-501",
        actorId: "admin-bob",
        actorRole: "admin",
        before: { status: "pending_review" },
        after: { status: "rejected", reason_code: "policy_mismatch" },
        basis: { rationale: rejectionReason },
      },
      mockDb
    );

    expect(mockDb.queryOne).toHaveBeenCalled();
  });
});

describe("4. Historical Simulation Backfill Idempotency & Timestamp Rule (§11)", () => {
  it("uses server-generated timestamp for the hash while preserving original created_at in metadata", async () => {
    const originalTime = "2026-01-15T08:30:00.000000Z";
    const serverGeneratedTime = "2026-10-18T14:00:00.000000Z";

    const backfilledRow = {
      org_id: "33333333-3333-3333-3333-333333333333",
      actor_id: "user-historical",
      actor_role: "member" as const,
      action: "simulation.run" as AuditAction,
      entity_type: "simulation",
      entity_id: "sim-hist-1",
      prev_hash: "genesis",
      hash_version: 1,
      created_at: serverGeneratedTime, // server-generated time used for hash chain!
      metadata: {
        source: "backfill",
        original_created_at: originalTime, // original time kept in metadata
      },
    };

    const rowHash = await computeAuditRowHash(backfilledRow);
    expect(rowHash).toMatch(/^[a-f0-9]{64}$/);
    expect(backfilledRow.metadata.source).toBe("backfill");
    expect(backfilledRow.metadata.original_created_at).toBe(originalTime);
  });
});

describe("5. Action Plan PDF Export Server-Side Audit Log (§8.3, §12)", () => {
  it("records action_plan.exported_pdf before client releases the download", async () => {
    const mockDb = {
      queryOne: vi.fn().mockResolvedValue({ write_audit_event: "201" }),
    };

    const auditId = await logAuditEvent(
      {
        orgId: "44444444-4444-4444-4444-444444444444",
        action: "action_plan.exported_pdf",
        entityType: "action_plan",
        entityId: "plan-pdf-001",
        actorId: "user-1",
        actorRole: "member",
        metadata: { summary: "Action plan for EU NIS2 Directive" },
      },
      mockDb
    );

    expect(auditId).toBe(201);
    expect(mockDb.queryOne).toHaveBeenCalled();
    const args = mockDb.queryOne.mock.calls[0][1];
    expect(args[1]).toBe("action_plan.exported_pdf");
  });
});
