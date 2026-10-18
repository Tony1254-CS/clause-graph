// ============================================================================
// Server Functions: src/lib/audit/audit.functions.ts
// TanStack Start server functions for the Tamper-Evident Audit Ledger API
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§3.8, §3.9)
// ============================================================================

import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "../auth-middleware";
import { fetchAuditLogs, logAuditEvent, generateAuditCsv } from "./audit.server";
import { verifyAuditWithAnchor, createAuditAnchor, getLatestAuditAnchor } from "./anchor.server";
import type { AuditAction, AuditEvent, AuditFilterParams } from "./types";

/**
 * Fetch audit logs with cursor pagination and multi-attribute filters.
 * Restricts access to organization admins only.
 */
export const getAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input?: AuditFilterParams) => ({
    startDate: input?.startDate || undefined,
    endDate: input?.endDate || undefined,
    actorId: input?.actorId || undefined,
    action: input?.action || undefined,
    entityType: input?.entityType || undefined,
    entityId: input?.entityId || undefined,
    correlationId: input?.correlationId || undefined,
    cursor: input?.cursor ? Number(input.cursor) : undefined,
    limit: input?.limit ? Math.min(Number(input.limit), 100) : 50,
  }))
  .handler(async ({ data, context }) => {
    const { orgId, role } = context;

    if (role !== "admin") {
      throw new Error("Forbidden: Admin privileges are required to inspect the audit ledger");
    }

    const result = await fetchAuditLogs(orgId, data);
    return result;
  });

/**
 * Perform cryptographic chain verification and anchor comparison.
 * Detects modified rows, broken links, and tail-deletions.
 * Logs an authoritative 'audit.verified' event into the ledger.
 */
export const verifyAuditTrail = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { orgId, userId, role } = context;

    if (role !== "admin") {
      throw new Error("Forbidden: Admin privileges are required to verify the audit chain");
    }

    const result = await verifyAuditWithAnchor(orgId);

    // Atomically log verification event into the ledger
    try {
      await logAuditEvent({
        orgId,
        actorId: userId,
        actorRole: "admin",
        action: "audit.verified",
        entityType: "audit_log",
        entityId: String(result.head_id || 0),
        basis: {
          valid: result.valid,
          rows_checked: result.rows_checked,
          head_hash: result.head_hash,
          anchored: result.anchored,
          tail_intact: result.anchor?.tail_intact ?? true,
          error: result.error || null,
        },
        metadata: {
          verifier_user_id: userId,
          verification_scope: "full_history",
        },
      });
    } catch (err) {
      console.error("[Audit Verify] Failed to log audit.verified event:", err);
    }

    return result;
  });

/**
 * Export audit events as CSV with formula-injection mitigation.
 * Logs an authoritative 'audit.exported' event into the ledger.
 */
export const exportAuditCsv = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input?: { filter?: AuditFilterParams; format?: "csv" | "pdf" }) => ({
    filter: input?.filter || {},
    format: input?.format || "csv",
  }))
  .handler(async ({ data, context }) => {
    const { orgId, userId, role } = context;

    if (role !== "admin") {
      throw new Error("Forbidden: Admin privileges are required to export audit logs");
    }

    // Fetch up to 1000 events for export
    const { events } = await fetchAuditLogs(orgId, {
      ...data.filter,
      limit: 1000,
    });

    const csvContent = generateAuditCsv(events);

    // Record the export event in the immutable audit log
    try {
      await logAuditEvent({
        orgId,
        actorId: userId,
        actorRole: "admin",
        action: "audit.exported",
        entityType: "audit_export",
        entityId: data.format,
        basis: {
          exported_rows: events.length,
          format: data.format,
          filter_applied: data.filter,
        },
        metadata: {
          user_id: userId,
          format: data.format,
        },
      });
    } catch (err) {
      console.error("[Audit Export] Failed to log audit.exported event:", err);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `clausegraph-audit-log-${timestamp}.csv`;

    return {
      filename,
      csvContent,
      count: events.length,
      exportedAt: new Date().toISOString(),
    };
  });

/**
 * Create a point-in-time cryptographic anchor snapshot.
 */
export const createAuditAnchorSnapshot = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { orgId, userId, role } = context;

    if (role !== "admin") {
      throw new Error("Forbidden: Admin privileges are required to create audit anchors");
    }

    const anchor = await createAuditAnchor(orgId, {
      manual_trigger: true,
      user_id: userId,
    });

    return anchor;
  });

/**
 * Fetch the latest anchor record for the current organization.
 */
export const getLatestAnchorSnapshot = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { orgId, role } = context;

    if (role !== "admin") {
      throw new Error("Forbidden: Admin privileges are required");
    }

    return await getLatestAuditAnchor(orgId);
  });
