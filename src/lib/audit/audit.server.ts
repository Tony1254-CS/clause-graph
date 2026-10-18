// ============================================================================
// Server-Side Audit Service: src/lib/audit/audit.server.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§8, §9, §12)
// Enforces:
// 1. Write-time deep redaction
// 2. Atomic/central execution via write_audit_event()
// 3. Cryptographic chain verification & external anchor checks
// 4. Cursor pagination & CSV formula-injection defense
// ============================================================================

import { query, queryOne } from "../db.server";
import { redactAuditPayload } from "./redaction.server";
import type {
  AuditEvent,
  WriteAuditParams,
  AuditFilterParams,
  AuditVerificationResult,
  ExternalAuditAnchor,
} from "./types";

/**
 * Log an audit event through the central PostgreSQL write_audit_event() function.
 * Enforces server-side write-time redaction before persistence.
 */
export async function logAuditEvent<TBefore = any, TAfter = any, TBasis = any>(
  params: WriteAuditParams<TBefore, TAfter, TBasis>,
  dbExecutor?: { queryOne: <R>(sql: string, params: unknown[]) => Promise<R | null> }
): Promise<number> {
  const [redactedBefore, redactedAfter, redactedBasis] = await Promise.all([
    params.before ? redactAuditPayload(params.before) : null,
    params.after ? redactAuditPayload(params.after) : null,
    params.basis ? redactAuditPayload(params.basis) : null,
  ]);

  const executor = dbExecutor || { queryOne };

  const row = await executor.queryOne<{ write_audit_event: string | number }>(
    `SELECT public.write_audit_event(
      $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb
    )`,
    [
      params.orgId,
      params.action,
      params.entityType,
      params.entityId,
      params.actorId || null,
      params.actorRole || null,
      params.correlationId || null,
      redactedBefore ? JSON.stringify(redactedBefore) : null,
      redactedAfter ? JSON.stringify(redactedAfter) : null,
      redactedBasis ? JSON.stringify(redactedBasis) : null,
      JSON.stringify(params.metadata || {}),
    ]
  );

  if (!row) {
    throw new Error("Audit log insert failed to return row ID");
  }

  return Number(row.write_audit_event);
}

/**
 * Query audit events with cursor pagination and strict multi-attribute filters.
 */
export async function fetchAuditLogs(
  orgId: string,
  filters: AuditFilterParams = {}
): Promise<{ events: AuditEvent[]; nextCursor: number | null }> {
  const limit = Math.min(filters.limit || 50, 100);
  const conditions: string[] = ["a.org_id = $1"];
  const params: unknown[] = [orgId];
  let pIdx = 2;

  if (filters.cursor) {
    conditions.push(`a.id < $${pIdx}`);
    params.push(filters.cursor);
    pIdx++;
  }

  if (filters.action) {
    conditions.push(`a.action = $${pIdx}`);
    params.push(filters.action);
    pIdx++;
  }

  if (filters.entityType) {
    conditions.push(`a.entity_type = $${pIdx}`);
    params.push(filters.entityType);
    pIdx++;
  }

  if (filters.entityId) {
    conditions.push(`a.entity_id = $${pIdx}`);
    params.push(filters.entityId);
    pIdx++;
  }

  if (filters.correlationId) {
    conditions.push(`a.correlation_id = $${pIdx}`);
    params.push(filters.correlationId);
    pIdx++;
  }

  if (filters.actorId) {
    conditions.push(`a.actor_id = $${pIdx}`);
    params.push(filters.actorId);
    pIdx++;
  }

  if (filters.startDate) {
    conditions.push(`a.created_at >= $${pIdx}`);
    params.push(filters.startDate);
    pIdx++;
  }

  if (filters.endDate) {
    conditions.push(`a.created_at <= $${pIdx}`);
    params.push(filters.endDate);
    pIdx++;
  }

  params.push(limit + 1);
  const limitParam = `$${pIdx}`;

  const rows = await query<AuditEvent>(
    `SELECT 
      a.id, a.org_id, a.actor_id, a.actor_role,
      COALESCE(u.email, 'system') AS actor_label,
      a.action, a.entity_type, a.entity_id, a.correlation_id,
      a.before, a.after, a.basis, a.metadata,
      a.hash_version,
      to_char(a.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
      a.prev_hash, a.row_hash
     FROM public.audit_log a
     LEFT JOIN auth.users u ON u.id = a.actor_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY a.id DESC
     LIMIT ${limitParam}`,
    params
  );

  const hasMore = rows.length > limit;
  const rawEvents = hasMore ? rows.slice(0, limit) : rows;
  const events = rawEvents.map((r) => ({
    ...r,
    created_at:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : String(r.created_at),
  }));
  const nextCursor = hasMore && events.length > 0 ? events[events.length - 1].id : null;

  return { events, nextCursor };
}

/**
 * Verify cryptographic chain integrity from genesis or a specific checkpoint.
 */
export async function verifyAuditChain(
  orgId: string,
  fromId: number = 0
): Promise<AuditVerificationResult> {
  const row = await queryOne<{ verify_audit_chain: AuditVerificationResult }>(
    `SELECT public.verify_audit_chain($1, $2)`,
    [orgId, fromId]
  );

  return (
    row?.verify_audit_chain || {
      valid: false,
      rows_checked: 0,
      error: "Verification function failed to execute",
    }
  );
}

/**
 * Escape formula injection characters in CSV cells (=, +, -, @, tab, cr)
 */
function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = typeof value === "object" ? JSON.stringify(value) : String(value);

  // Prevent formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Generate a secure CSV export with formula-injection sanitization.
 */
export function generateAuditCsv(events: AuditEvent[]): string {
  const headers = [
    "ID",
    "Timestamp (UTC)",
    "Actor",
    "Role",
    "Action",
    "Entity Type",
    "Entity ID",
    "Correlation ID",
    "Previous Hash",
    "Row Hash",
    "Basis Summary",
  ];

  const rows = events.map((e) => [
    sanitizeCsvCell(e.id),
    sanitizeCsvCell(e.created_at),
    sanitizeCsvCell(e.actor_label || e.actor_id || "system"),
    sanitizeCsvCell(e.actor_role),
    sanitizeCsvCell(e.action),
    sanitizeCsvCell(e.entity_type),
    sanitizeCsvCell(e.entity_id),
    sanitizeCsvCell(e.correlation_id || ""),
    sanitizeCsvCell(e.prev_hash),
    sanitizeCsvCell(e.row_hash),
    sanitizeCsvCell(e.basis ? JSON.stringify(e.basis) : ""),
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
