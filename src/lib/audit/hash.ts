// ============================================================================
// Audit Canonical Hash Helper: src/lib/audit/hash.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§8)
// Matches PostgreSQL public.audit_row_hash() with stable UTC serialization
// ============================================================================

import { canonicalizeJson, payloadHash } from "../review/hash";

export { canonicalizeJson, payloadHash };

/**
 * Format timestamp into stable ISO 8601 UTC string with 6 microsecond digits:
 * YYYY-MM-DD"T"HH24:MI:SS.US"Z"
 */
export function formatAuditUtcTimestamp(dateOrIso: Date | string): string {
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  const iso = d.toISOString(); // e.g., 2026-10-18T12:00:00.123Z
  
  // Normalize milliseconds (3 digits) to microseconds (6 digits) to match PostgreSQL to_char
  const match = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{1,6})Z$/);
  if (match) {
    const main = match[1];
    const ms = match[2].padEnd(6, "0").slice(0, 6);
    return `${main}.${ms}Z`;
  }
  return iso;
}

export interface AuditHashParams {
  prev_hash: string;
  org_id: string;
  actor_id: string | null;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  correlation_id?: string | null;
  before?: any;
  after?: any;
  basis?: any;
  metadata?: Record<string, any>;
  hash_version: number;
  created_at: string | Date;
}

/**
 * Compute the SHA-256 row digest for an audit row matching PostgreSQL audit_row_hash()
 */
export async function computeAuditRowHash(params: AuditHashParams): Promise<string> {
  const timeStr = formatAuditUtcTimestamp(params.created_at);

  const payloadArray = [
    params.prev_hash,
    params.org_id,
    params.actor_id ?? "system",
    params.actor_role,
    params.action,
    params.entity_type,
    params.entity_id,
    params.correlation_id ?? "",
    params.before !== undefined && params.before !== null ? params.before : null,
    params.after !== undefined && params.after !== null ? params.after : null,
    params.basis !== undefined && params.basis !== null ? params.basis : null,
    params.metadata ?? {},
    params.hash_version,
    timeStr,
  ];

  // Canonicalize to guarantee deterministic key ordering
  const canonicalString = canonicalizeJson(payloadArray);
  return payloadHash({ raw: canonicalString });
}
