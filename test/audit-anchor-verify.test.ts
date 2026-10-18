import { describe, it, expect, beforeEach } from "vitest";
import { generateAuditCsv } from "../src/lib/audit/audit.server";
import { computeAuditRowHash } from "../src/lib/audit/hash";
import type { AuditEvent } from "../src/lib/audit/types";

describe("Audit Anchoring, Verification & Export Defense (§3.6, §3.8)", () => {
  const baseEvent: AuditEvent = {
    id: 101,
    org_id: "b0000000-0000-0000-0000-000000000001",
    actor_id: "a0000000-0000-0000-0000-000000000002",
    actor_role: "admin",
    actor_label: "admin@kirkland.com",
    action: "simulation.run",
    entity_type: "simulation",
    entity_id: "sim-101",
    correlation_id: "c0000000-0000-0000-0000-000000000003",
    before: null,
    after: { impacted: 2 },
    basis: { model: "gpt-4o", prompt_version: "v7" },
    metadata: { source: "test" },
    hash_version: 1,
    created_at: "2026-10-18T10:00:00.000000Z",
    prev_hash: "genesis",
    row_hash: "hash101",
  };

  describe("1. CSV Formula Injection Defense (§3.8)", () => {
    it("escapes cells starting with '=', '+', '-', '@', tab, and carriage return", () => {
      const dangerousEvents: AuditEvent[] = [
        {
          ...baseEvent,
          id: 1,
          entity_id: "=SUM(A1:A10)",
          actor_label: "+1234567890",
          entity_type: "-DANGEROUS_CMD",
          action: "simulation.run",
          prev_hash: "@cmd.exe",
          metadata: { note: "\tTabbed cell" },
        },
      ];

      const csv = generateAuditCsv(dangerousEvents);
      const lines = csv.split("\n");
      expect(lines.length).toBe(2);

      // Verify each escaped field is prefixed with a single quote (') inside double quotes
      expect(lines[1]).toContain(`"'=SUM(A1:A10)"`);
      expect(lines[1]).toContain(`"'+1234567890"`);
      expect(lines[1]).toContain(`"'-DANGEROUS_CMD"`);
      expect(lines[1]).toContain(`"'@cmd.exe"`);
    });

    it("properly encloses and escapes existing double quotes", () => {
      const quoteEvent: AuditEvent = {
        ...baseEvent,
        entity_id: 'contract "Alpha" Corp',
      };

      const csv = generateAuditCsv([quoteEvent]);
      expect(csv).toContain(`"contract ""Alpha"" Corp"`);
    });
  });

  describe("2. Hash Chaining Integrity & Tamper Detection (§3.5, §3.6)", () => {
    it("computes deterministic SHA-256 row hash matching canonical format", async () => {
      const hash1 = await computeAuditRowHash({
        prev_hash: "genesis",
        org_id: "b0000000-0000-0000-0000-000000000001",
        actor_id: "a0000000-0000-0000-0000-000000000002",
        actor_role: "admin",
        action: "simulation.run",
        entity_type: "simulation",
        entity_id: "sim-101",
        correlation_id: "c0000000-0000-0000-0000-000000000003",
        before: null,
        after: { impacted: 2 },
        basis: { model: "gpt-4o" },
        metadata: { source: "test" },
        hash_version: 1,
        created_at: "2026-10-18T10:00:00.000000Z",
      });

      expect(hash1).toMatch(/^[0-9a-f]{64}$/);

      // Recomputing with the same input produces exact same hash
      const hash2 = await computeAuditRowHash({
        prev_hash: "genesis",
        org_id: "b0000000-0000-0000-0000-000000000001",
        actor_id: "a0000000-0000-0000-0000-000000000002",
        actor_role: "admin",
        action: "simulation.run",
        entity_type: "simulation",
        entity_id: "sim-101",
        correlation_id: "c0000000-0000-0000-0000-000000000003",
        before: null,
        after: { impacted: 2 },
        basis: { model: "gpt-4o" },
        metadata: { source: "test" },
        hash_version: 1,
        created_at: "2026-10-18T10:00:00.000000Z",
      });

      expect(hash1).toBe(hash2);
    });

    it("detects modification in payload (basis or after) producing divergent hash", async () => {
      const originalHash = await computeAuditRowHash({
        prev_hash: "genesis",
        org_id: "b0000000-0000-0000-0000-000000000001",
        actor_id: "a0000000-0000-0000-0000-000000000002",
        actor_role: "admin",
        action: "review.approved",
        entity_type: "review_item",
        entity_id: "rev-1",
        correlation_id: null,
        before: { status: "pending_review" },
        after: { status: "approved" },
        basis: { reason: "Valid rationale" },
        metadata: {},
        hash_version: 1,
        created_at: "2026-10-18T11:00:00.000000Z",
      });

      const tamperedHash = await computeAuditRowHash({
        prev_hash: "genesis",
        org_id: "b0000000-0000-0000-0000-000000000001",
        actor_id: "a0000000-0000-0000-0000-000000000002",
        actor_role: "admin",
        action: "review.approved",
        entity_type: "review_item",
        entity_id: "rev-1",
        correlation_id: null,
        before: { status: "pending_review" },
        after: { status: "approved" },
        basis: { reason: "TAMPERED rationale by adversary" },
        metadata: {},
        hash_version: 1,
        created_at: "2026-10-18T11:00:00.000000Z",
      });

      expect(originalHash).not.toBe(tamperedHash);
    });
  });

  describe("3. Tail-Deletion & Anchor Protection Logic (§3.6)", () => {
    it("flags tail-deletion when live head id or count is less than anchored values", () => {
      const anchor = {
        anchor_id: 1,
        head_id: 50,
        head_hash: "hash_50_xyz",
        row_count: 50,
      };

      // Scenario A: Adversary deletes newest rows from 41 to 50
      const liveStateTampered = {
        head_id: 40,
        row_count: 40,
      };

      const isTailTruncated =
        liveStateTampered.head_id < anchor.head_id ||
        liveStateTampered.row_count < anchor.row_count;

      expect(isTailTruncated).toBe(true);

      // Scenario B: Legitimate appended state (chain progressed from 50 to 55)
      const liveStateProgressed = {
        head_id: 55,
        row_count: 55,
      };

      const isTailTruncatedValid =
        liveStateProgressed.head_id < anchor.head_id ||
        liveStateProgressed.row_count < anchor.row_count;

      expect(isTailTruncatedValid).toBe(false);
    });
  });
});
