// ============================================================================
// External Anchor Service: src/lib/audit/anchor.server.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§3.6, §7.7)
// Provides:
// 1. External anchoring of audit chain heads (head_id, head_hash, row_count)
// 2. Tail-deletion and truncation detection
// 3. Incremental checkpoint verification
// 4. Scheduled anchor worker
// ============================================================================

import { query, queryOne } from "../db.server";
import type { ExternalAuditAnchor, AuditVerificationResult } from "./types";

export interface AnchorResult {
  anchor_id: number;
  org_id: string;
  head_id: number;
  head_hash: string;
  row_count: number;
  anchored_at: string;
}

export interface VerificationWithAnchorResult extends AuditVerificationResult {
  anchored: boolean;
  tail_tampered?: boolean;
  anchor?: {
    anchor_id: number;
    anchored_at: string;
    head_id: number;
    head_hash: string;
    row_count: number;
    tail_intact: boolean;
  };
}

/**
 * Creates an append-only cryptographic anchor snapshot of the audit chain head.
 */
export async function createAuditAnchor(
  orgId: string,
  metadata: Record<string, unknown> = {}
): Promise<AnchorResult> {
  const row = await queryOne<{ create_audit_anchor: AnchorResult }>(
    `SELECT public.create_audit_anchor($1, $2::jsonb)`,
    [orgId, JSON.stringify(metadata)]
  );

  if (!row?.create_audit_anchor) {
    throw new Error(`Failed to create audit anchor for organization ${orgId}`);
  }

  return row.create_audit_anchor;
}

/**
 * Retrieve the latest anchor for an organization.
 */
export async function getLatestAuditAnchor(
  orgId: string
): Promise<ExternalAuditAnchor | null> {
  const row = await queryOne<ExternalAuditAnchor>(
    `SELECT 
       id as anchor_id, org_id, head_id, head_hash, row_count,
       to_char(anchored_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as anchored_at
     FROM public.audit_anchors
     WHERE org_id = $1
     ORDER BY id DESC
     LIMIT 1`,
    [orgId]
  );

  return row || null;
}

/**
 * Verify cryptographic hash chain AND compare against the external anchor to catch tail deletion.
 */
export async function verifyAuditWithAnchor(
  orgId: string
): Promise<VerificationWithAnchorResult> {
  const row = await queryOne<{ verify_audit_with_anchor: VerificationWithAnchorResult }>(
    `SELECT public.verify_audit_with_anchor($1)`,
    [orgId]
  );

  if (!row?.verify_audit_with_anchor) {
    return {
      valid: false,
      rows_checked: 0,
      anchored: false,
      error: "verify_audit_with_anchor returned no result",
    };
  }

  return row.verify_audit_with_anchor;
}

/**
 * Worker to run periodic anchoring across all active organizations.
 */
export async function runScheduledAnchorWorker(
  targetOrgIds?: string[]
): Promise<AnchorResult[]> {
  let orgs: { id: string }[] = [];

  if (targetOrgIds && targetOrgIds.length > 0) {
    orgs = targetOrgIds.map((id) => ({ id }));
  } else {
    orgs = await query<{ id: string }>(`SELECT id FROM public.organizations`);
  }

  const results: AnchorResult[] = [];
  for (const org of orgs) {
    try {
      const anchor = await createAuditAnchor(org.id, {
        source: "scheduled_worker",
        timestamp: new Date().toISOString(),
      });
      results.push(anchor);
    } catch (err) {
      console.error(`Failed to anchor organization ${org.id}:`, err);
    }
  }

  return results;
}
