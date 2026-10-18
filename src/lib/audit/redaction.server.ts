// ============================================================================
// Server-Side Redaction Helper: src/lib/audit/redaction.server.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§6)
// Strips secrets, tokens, raw contract bodies, and sensitive PII at write-time.
// ============================================================================

import { payloadHash } from "../review/hash";

const SENSITIVE_KEY_REGEX = /(?:password|secret|token|api[_-]?key|bearer|auth|credit[_-]?card|ssn|national[_-]?id)/i;
const API_KEY_PATTERN = /(?:sk-[a-zA-Z0-9_-]{10,}|sb_publishable_[a-zA-Z0-9_-]+|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g;
const FINANCIAL_CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g;

/**
 * Deeply redacts an arbitrary payload before it reaches write_audit_event().
 */
export async function redactAuditPayload<T = any>(data: T): Promise<T> {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    // 1. Redact key-like tokens or bearer credentials
    let sanitized = data.replace(API_KEY_PATTERN, "[REDACTED_SECRET]");
    // 2. Redact payment cards and SSNs
    sanitized = sanitized.replace(FINANCIAL_CARD_REGEX, "[REDACTED_FINANCIAL_ACCOUNT]");
    sanitized = sanitized.replace(SSN_REGEX, "[REDACTED_GOVT_ID]");

    // 3. Prevent raw contract dumping: If a string exceeds 1000 characters,
    // summarize with length and content hash unless already labeled as an ID or hash.
    if (sanitized.length > 1000) {
      const hash = await payloadHash({ raw: sanitized });
      return `[TEXT_REDACTED: ${sanitized.length} chars, sha256:${hash.slice(0, 16)}...]` as unknown as T;
    }
    return sanitized as unknown as T;
  }

  if (Array.isArray(data)) {
    const list: any[] = [];
    for (const item of data) {
      list.push(await redactAuditPayload(item));
    }
    return list as unknown as T;
  }

  if (typeof data === "object") {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      // Direct sensitive field redaction
      if (SENSITIVE_KEY_REGEX.test(key)) {
        result[key] = "[REDACTED]";
        continue;
      }

      // Large contract text or full body replacement
      if ((key === "contract_text" || key === "full_text" || key === "raw_text") && typeof value === "string") {
        const hash = await payloadHash({ raw: value });
        result[key] = {
          _redacted: true,
          type: "contract_text_reference",
          length: value.length,
          hash,
        };
        continue;
      }

      result[key] = await redactAuditPayload(value);
    }
    return result as unknown as T;
  }

  return data;
}
