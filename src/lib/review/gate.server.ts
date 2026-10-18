// ============================================================================
// Server Gate: src/lib/review/gate.server.ts
// Single enforcement gate, policy evaluation, and enqueue integration
// ============================================================================

import { payloadHash } from "./hash";
import type {
  GateEvaluationContext,
  GateEvaluationResult,
  EnqueueReviewParams,
  ReviewItem,
  ReviewSource,
  ReviewSeverity,
} from "./types";
import { query, queryOne } from "../db.server";

export class ReviewGateError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 403) {
    super(message);
    this.name = "ReviewGateError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Regex to detect adversarial injection attempts in clauses or user inputs
const INSTRUCTION_INJECTION_REGEX =
  /(ignore\s+(all\s+)?previous|system\s+prompt|disregard\s+prior|override\s+instructions|approve\s+this\s+automatically|bypass\s+security|treat\s+as\s+compliant)/i;

/**
 * Pure evaluation function checking incoming output against:
 * 1. Non-configurable floor (§4.2)
 * 2. Organization policies
 * 3. Adversarial / prompt injection heuristics
 */
export function evaluateGate(ctx: GateEvaluationContext): GateEvaluationResult {
  const flagReasons: string[] = [];
  const matchedRules: string[] = [];
  let isRequired = false;
  let approvals = 1;
  let hint = "General review";
  let baseScore = 0;

  let severity: ReviewSeverity = ctx.severity || "medium";

  // ── Non-configurable floor (§4.2) ──────────────────────────────────────────
  // 1. Compliance-as-Code (Terraform / Python) is ALWAYS gated and elevated to high severity
  if (ctx.sourceType === "compliance_artifact") {
    isRequired = true;
    severity = "high";
    baseScore = 100;
    approvals = 1; // Can be upgraded to 2 in multi-admin orgs
    hint = "DevOps lead + Legal";
    matchedRules.push("NON_CONFIGURABLE_FLOOR:compliance_as_code");
    flagReasons.push("Executable code generation (Compliance-as-Code) always requires human review");
  }

  // Base score from severity (if not compliance_artifact which is already 100)
  if (ctx.sourceType !== "compliance_artifact") {
    if (severity === "high") {
      baseScore += 60;
      isRequired = true;
      matchedRules.push("POLICY:high_severity");
      flagReasons.push("High severity compliance risk detected");
    } else if (severity === "medium") {
      baseScore += 30;
    } else {
      baseScore += 10;
    }
  }

  // Exposure scoring
  if (ctx.exposureUsd !== undefined && ctx.exposureUsd > 0) {
    if (ctx.exposureUsd > 500_000) {
      isRequired = true;
      baseScore += 30;
      flagReasons.push(`High financial exposure: $${ctx.exposureUsd.toLocaleString()}`);
      matchedRules.push("NON_CONFIGURABLE_FLOOR:exposure_exceeds_500k");
    } else if (ctx.exposureUsd >= 100_000) {
      baseScore += 15;
    }
  }

  // 2. Deterministic fallback engine is ALWAYS gated
  if (ctx.engine === "deterministic_fallback") {
    isRequired = true;
    baseScore = Math.max(baseScore, 80);
    matchedRules.push("NON_CONFIGURABLE_FLOOR:fallback_engine");
    flagReasons.push("Deterministic fallback engine was used");
  }

  // 3. Contract clause extraction confidence < 0.60
  if (ctx.confidence !== undefined && ctx.confidence < 0.60) {
    isRequired = true;
    baseScore += 20;
    matchedRules.push("POLICY:low_confidence");
    flagReasons.push(`Low model confidence (${(ctx.confidence * 100).toFixed(0)}% < 60%)`);
    hint = "Contract analyst";
  }

  // 4. Action plan amendments
  if (ctx.sourceType === "action_plan") {
    isRequired = true;
    baseScore += 20;
    matchedRules.push("POLICY:action_plan_amendments");
    flagReasons.push("Suggested contract language requires counsel review");
    hint = "Legal counsel";
  }

  // 5. Supply chain indirect exposure
  if (ctx.sourceType === "supply_chain" && ctx.exposureUsd && ctx.exposureUsd > 500_000) {
    isRequired = true;
    matchedRules.push("POLICY:supply_chain_exposure");
    hint = "Risk officer";
  }

  // ── Prompt Injection Detection (§15) ───────────────────────────────────────
  const textToCheck = ctx.inputText || ctx.rawText;
  if (textToCheck && INSTRUCTION_INJECTION_REGEX.test(textToCheck)) {
    isRequired = true;
    baseScore += 40;
    flagReasons.push("Prompt injection heuristic detected: source text contains instruction-like phrases");
    matchedRules.push("SECURITY:instruction_injection_suspected");
  }

  // ── Custom Organization Review Policies ───────────────────────────────────
  if (ctx.policies && Array.isArray(ctx.policies)) {
    for (const p of ctx.policies) {
      if (p.enabled === false) continue;
      if (p.source_type && p.source_type !== ctx.sourceType) continue;

      const meetsExposure = p.min_exposure_usd ? (ctx.exposureUsd || 0) >= p.min_exposure_usd : false;
      const meetsSeverity = p.min_severity
        ? p.min_severity === "low" ||
          (p.min_severity === "medium" && (severity === "medium" || severity === "high")) ||
          (p.min_severity === "high" && severity === "high")
        : false;

      if (p.always_gate || meetsExposure || meetsSeverity) {
        isRequired = true;
        if (p.flag_reason) flagReasons.push(p.flag_reason);
        if (p.required_approvals && p.required_approvals > approvals) {
          approvals = p.required_approvals;
        }
        matchedRules.push(`CUSTOM_POLICY:${p.name}`);
      }
    }
  }

  const riskScore = Math.min(100, Math.max(0, baseScore));

  return {
    required: isRequired,
    riskScore,
    severity,
    flagReasons: isRequired ? (flagReasons.length > 0 ? flagReasons : ["Standard baseline review"]) : [],
    requiredApprovals: approvals,
    reviewerHint: hint,
    matchedRules,
  };
}

/**
 * Enqueue an AI output into the human review queue.
 * De-duplicates identical outputs; supersedes prior open outputs for the same source.
 */
export async function enqueueForReview(params: EnqueueReviewParams): Promise<ReviewItem> {
  const orgId = params.orgId || "b0000000-0000-0000-0000-000000000001";
  const outputHash = payloadHash(params.payload);
  const inputHash = payloadHash(params.inputSnapshot);
  const dedupeKey = payloadHash(`${orgId}|${params.sourceType}|${params.sourceId}|${outputHash}`);

  try {
    const row = await queryOne<ReviewItem>(
      `SELECT * FROM public.enqueue_review(
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16
      )`,
      [
        orgId,
        params.sourceType,
        params.sourceId,
        params.severity,
        params.gate.riskScore,
        params.summary,
        JSON.stringify(params.gate.flagReasons),
        params.engine,
        params.modelName || null,
        params.promptVersion || "v2.0",
        params.confidence ?? null,
        JSON.stringify(params.payload),
        JSON.stringify(params.inputSnapshot),
        params.gate.requiredApprovals,
        params.submittedBy || null,
        72,
      ]
    );

    if (row) return row;
  } catch (err) {
    console.warn("[Review Gate] DB enqueue_review error, using resilient fallback:", err);
  }

  // Fallback return structure when DB function cannot be executed in standalone mode
  return {
    id: `rev-${Date.now()}`,
    org_id: orgId,
    source_type: params.sourceType,
    source_id: params.sourceId,
    status: "pending_review",
    severity: params.severity,
    risk_score: params.gate.riskScore,
    risk_summary: params.summary,
    flag_reasons: params.gate.flagReasons,
    engine: params.engine,
    model_name: params.modelName || null,
    prompt_version: params.promptVersion || "v2.0",
    confidence: params.confidence ?? null,
    ai_payload: params.payload,
    output_hash: outputHash,
    input_snapshot: params.inputSnapshot,
    input_hash: inputHash,
    required_approvals: params.gate.requiredApprovals,
    dedupe_key: dedupeKey,
    sla_due_at: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * The single server-side enforcement check (§9).
 * Fails closed: throws ReviewGateError if not approved or if content hash does not match.
 */
export async function requireApproved(
  sourceType: ReviewSource,
  sourceId: string,
  content: any,
  dbExecutor?: { rpc?: (fn: string, params: any) => Promise<any>; queryOne?: (q: string, params: any[]) => Promise<any> }
): Promise<void> {
  const hash = payloadHash(content);

  try {
    if (dbExecutor?.rpc) {
      const ok = await dbExecutor.rpc("is_output_approved", {
        p_source_type: sourceType,
        p_source_id: sourceId,
        p_content_hash: hash,
      });
      if (ok) return;
    } else if (dbExecutor?.queryOne) {
      const row = await dbExecutor.queryOne(
        `SELECT public.is_output_approved($1, $2, $3) AS approved`,
        [sourceType, sourceId, hash]
      );
      if (row && row.approved) return;
    } else {
      const row = await queryOne<{ approved: boolean }>(
        `SELECT public.is_output_approved($1, $2, $3) AS approved`,
        [sourceType, sourceId, hash]
      );
      if (row && row.approved) {
        return;
      }
    }
  } catch (err) {
    if (err instanceof ReviewGateError) throw err;
    console.warn("[Review Gate] Database check failed, failing closed:", err);
    throw new ReviewGateError(
      "UNAPPROVED_OUTPUT",
      "Human Review Gate: Verification failed or output has not been approved by an administrator.",
      403
    );
  }

  throw new ReviewGateError(
    "UNAPPROVED_OUTPUT",
    "Human Review Gate: This output is pending human approval or the content has changed since approval.",
    403
  );
}

/**
 * Boolean check for UI consumers. Fail closed on error.
 */
export async function checkIsApproved(
  sourceType: ReviewSource,
  sourceId: string,
  content: any,
  dbExecutor?: { rpc?: (fn: string, params: any) => Promise<any>; queryOne?: (q: string, params: any[]) => Promise<any> }
): Promise<boolean> {
  try {
    await requireApproved(sourceType, sourceId, content, dbExecutor);
    return true;
  } catch {
    return false;
  }
}

/**
 * Invalidate existing approvals and queue fresh reviews when underlying contract/regulations change.
 */
export async function markStale(
  sourceType: ReviewSource,
  sourceId: string,
  reason: string
): Promise<number> {
  try {
    const res = await queryOne<{ count: number }>(
      `SELECT public.mark_stale($1, $2, $3) AS count`,
      [sourceType, sourceId, reason]
    );
    return res?.count ?? 0;
  } catch (err) {
    console.warn("[Review Gate] markStale failed:", err);
    return 0;
  }
}
