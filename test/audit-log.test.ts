// ============================================================================
// Audit Log Test Suite: test/audit-log.test.ts
// Phase 1 Foundation Verification:
// 1. Canonical UTC timestamp formatting and SHA-256 row hashing.
// 2. Write-time deep redaction (secrets, PII, massive contract bodies).
// 3. Chain verification algorithm & tamper detection (middle-row edit/deletion).
// 4. CSV Formula-Injection Protection (§12).
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { formatAuditUtcTimestamp, computeAuditRowHash } from "../src/lib/audit/hash";
import { redactAuditPayload } from "../src/lib/audit/redaction.server";
import { generateAuditCsv } from "../src/lib/audit/audit.server";
import type { AuditEvent } from "../src/lib/audit/types";

describe("1. Canonical UTC Timestamp Formatting & Hash Determinism (§8)", () => {
  it("formats ISO timestamps into stable UTC with 6-digit microsecond precision", () => {
    const d1 = new Date("2026-10-18T12:00:00.123Z");
    const formatted = formatAuditUtcTimestamp(d1);
    expect(formatted).toBe("2026-10-18T12:00:00.123000Z");
  });

  it("produces identical SHA-256 row hashes regardless of object key order", async () => {
    const orgId = "11111111-1111-1111-1111-111111111111";
    const ts = "2026-10-18T12:00:00.123000Z";

    const hash1 = await computeAuditRowHash({
      prev_hash: "genesis",
      org_id: orgId,
      actor_id: "user-abc",
      actor_role: "admin",
      action: "simulation.run",
      entity_type: "simulation",
      entity_id: "sim-123",
      correlation_id: "corr-123",
      before: { z: 1, a: 2 },
      after: { m: "result", k: [1, 2] },
      basis: { model: "gpt-4o", prompt: "v2" },
      metadata: { env: "prod" },
      hash_version: 1,
      created_at: ts,
    });

    const hash2 = await computeAuditRowHash({
      prev_hash: "genesis",
      org_id: orgId,
      actor_id: "user-abc",
      actor_role: "admin",
      action: "simulation.run",
      entity_type: "simulation",
      entity_id: "sim-123",
      correlation_id: "corr-123",
      before: { a: 2, z: 1 }, // reversed keys
      after: { k: [1, 2], m: "result" }, // reversed keys
      basis: { prompt: "v2", model: "gpt-4o" }, // reversed keys
      metadata: { env: "prod" },
      hash_version: 1,
      created_at: ts,
    });

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces distinct hashes when any field changes even slightly", async () => {
    const baseParams = {
      prev_hash: "genesis",
      org_id: "11111111-1111-1111-1111-111111111111",
      actor_id: "user-abc",
      actor_role: "admin",
      action: "simulation.run",
      entity_type: "simulation",
      entity_id: "sim-123",
      hash_version: 1,
      created_at: "2026-10-18T12:00:00.123000Z",
    };

    const hashA = await computeAuditRowHash({ ...baseParams, action: "simulation.run" });
    const hashB = await computeAuditRowHash({ ...baseParams, action: "whatif.run" });
    const hashC = await computeAuditRowHash({ ...baseParams, actor_role: "member" });

    expect(hashA).not.toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });
});

describe("2. Write-Time Redaction Helper (§6)", () => {
  it("strips API keys and JWT bearer tokens from string inputs", async () => {
    const raw = "Connecting with key sk-abcdef1234567890123456 and token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M";
    const redacted = await redactAuditPayload(raw);

    expect(redacted).not.toContain("sk-abcdef");
    expect(redacted).not.toContain("eyJhbGci");
    expect(redacted).toContain("[REDACTED_SECRET]");
  });

  it("strips payment card numbers and SSNs from text", async () => {
    const text = "Customer card 4532-1234-5678-9012 and SSN 123-45-6789";
    const redacted = await redactAuditPayload(text);

    expect(redacted).not.toContain("4532-1234");
    expect(redacted).not.toContain("123-45-6789");
    expect(redacted).toContain("[REDACTED_FINANCIAL_ACCOUNT]");
    expect(redacted).toContain("[REDACTED_GOVT_ID]");
  });

  it("redacts sensitive dictionary keys like password, token, api_key", async () => {
    const payload = {
      username: "alice",
      api_key: "my-super-secret-key",
      user_password: "PlainTextPassword123",
      nested: {
        bearer_token: "secret123",
        public_data: "safe",
      },
    };

    const redacted = await redactAuditPayload(payload);
    expect(redacted.api_key).toBe("[REDACTED]");
    expect(redacted.user_password).toBe("[REDACTED]");
    expect(redacted.nested.bearer_token).toBe("[REDACTED]");
    expect(redacted.nested.public_data).toBe("safe");
  });

  it("replaces full contract text with a cryptographic length and hash reference", async () => {
    const longContractBody = "MASTER SERVICES AGREEMENT ".repeat(50); // > 1000 chars
    const payload = {
      contract_id: "c-100",
      contract_text: longContractBody,
    };

    const redacted = await redactAuditPayload(payload);
    expect(redacted.contract_text._redacted).toBe(true);
    expect(redacted.contract_text.type).toBe("contract_text_reference");
    expect(redacted.contract_text.length).toBe(longContractBody.length);
    expect(redacted.contract_text.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("3. Hash Chain Integrity & Tamper Detection (§9)", () => {
  it("validates an intact sequence of audit records linked by prev_hash", async () => {
    const orgId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const rows = [
      {
        id: 1,
        org_id: orgId,
        actor_id: "user-1",
        actor_role: "admin",
        action: "contract.uploaded",
        entity_type: "contract",
        entity_id: "c-1",
        correlation_id: null,
        before: null,
        after: { name: "MSA.pdf" },
        basis: null,
        metadata: {},
        hash_version: 1,
        created_at: "2026-10-18T10:00:00.000000Z",
        prev_hash: "genesis",
        row_hash: "",
      },
      {
        id: 2,
        org_id: orgId,
        actor_id: "user-1",
        actor_role: "admin",
        action: "simulation.run",
        entity_type: "simulation",
        entity_id: "s-1",
        correlation_id: "corr-1",
        before: null,
        after: { exposure: 250000 },
        basis: { model: "gpt-4o" },
        metadata: {},
        hash_version: 1,
        created_at: "2026-10-18T10:05:00.000000Z",
        prev_hash: "",
        row_hash: "",
      },
    ];

    rows[0].row_hash = await computeAuditRowHash(rows[0]);
    rows[1].prev_hash = rows[0].row_hash;
    rows[1].row_hash = await computeAuditRowHash(rows[1]);

    // Verify chain manually matching verify_audit_chain
    let lastHash = "genesis";
    let isValid = true;
    for (const r of rows) {
      if (r.prev_hash !== lastHash) {
        isValid = false;
        break;
      }
      const expected = await computeAuditRowHash(r);
      if (r.row_hash !== expected) {
        isValid = false;
        break;
      }
      lastHash = r.row_hash;
    }

    expect(isValid).toBe(true);
  });

  it("detects an adversary altering an event payload in history", async () => {
    const orgId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const row1 = {
      id: 1,
      org_id: orgId,
      actor_id: "user-1",
      actor_role: "admin",
      action: "role.granted",
      entity_type: "user_role",
      entity_id: "user-2",
      correlation_id: null,
      before: null,
      after: { role: "member" },
      basis: null,
      metadata: {},
      hash_version: 1,
      created_at: "2026-10-18T10:00:00.000000Z",
      prev_hash: "genesis",
      row_hash: "",
    };
    row1.row_hash = await computeAuditRowHash(row1);

    // Tampered payload: attacker claims role was 'admin'
    const tamperedRow1 = { ...row1, after: { role: "admin" } };

    const expected = await computeAuditRowHash(tamperedRow1);
    expect(tamperedRow1.row_hash).not.toBe(expected);
  });

  it("detects deletion of an intermediate record", async () => {
    const orgId = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const r1 = {
      id: 1,
      org_id: orgId,
      actor_id: "user-1",
      actor_role: "admin",
      action: "auth.login",
      entity_type: "auth",
      entity_id: "sess-1",
      hash_version: 1,
      created_at: "2026-10-18T10:00:00.000000Z",
      prev_hash: "genesis",
      row_hash: "",
    };
    r1.row_hash = await computeAuditRowHash(r1);

    const r2 = {
      id: 2,
      org_id: orgId,
      actor_id: "user-1",
      actor_role: "admin",
      action: "contract.deleted",
      entity_type: "contract",
      entity_id: "c-secret",
      hash_version: 1,
      created_at: "2026-10-18T10:01:00.000000Z",
      prev_hash: r1.row_hash,
      row_hash: "",
    };
    r2.row_hash = await computeAuditRowHash(r2);

    const r3 = {
      id: 3,
      org_id: orgId,
      actor_id: "user-1",
      actor_role: "admin",
      action: "audit.exported",
      entity_type: "audit",
      entity_id: "exp-1",
      hash_version: 1,
      created_at: "2026-10-18T10:02:00.000000Z",
      prev_hash: r2.row_hash,
      row_hash: "",
    };
    r3.row_hash = await computeAuditRowHash(r3);

    // If an attacker deletes r2:
    const remaining = [r1, r3];
    let brokenAt: number | null = null;
    let lastHash = "genesis";

    for (const r of remaining) {
      if (r.prev_hash !== lastHash) {
        brokenAt = r.id;
        break;
      }
      lastHash = r.row_hash;
    }

    expect(brokenAt).toBe(3); // r3's prev_hash points to deleted r2, not r1
  });
});

describe("4. CSV Formula-Injection Protection (§12)", () => {
  it("escapes cells beginning with =, +, -, @, tab, or newline with a single quote", () => {
    const maliciousEvents: AuditEvent[] = [
      {
        id: 1,
        org_id: "org-1",
        actor_id: "user-1",
        actor_role: "admin",
        actor_label: "=cmd|' /C calc'!A0",
        action: "contract.uploaded",
        entity_type: "+DDE(\"cmd\";\"/C calc\";\"__DdeLink__\")",
        entity_id: "-SUM(1+1)",
        correlation_id: null,
        before: null,
        after: null,
        basis: "@SUM(1+1)",
        metadata: {},
        hash_version: 1,
        created_at: "2026-10-18T10:00:00Z",
        prev_hash: "genesis",
        row_hash: "hash123",
      },
    ];

    const csv = generateAuditCsv(maliciousEvents);

    expect(csv).toContain("\"'=cmd|' /C calc'!A0\"");
    expect(csv).toContain("\"'+DDE(\"\"cmd\"\";\"\"/C calc\"\";\"\"__DdeLink__\"\")\"");
    expect(csv).toContain("\"'-SUM(1+1)\"");
  });
});
