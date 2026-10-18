// ============================================================================
// Canonical Hash: src/lib/review/hash.ts
// Deterministic JSON canonicalization & SHA-256 hashing
// ============================================================================

import { createHash } from "node:crypto";

/**
 * Sorts object keys recursively to produce a canonical JSON string
 * identical regardless of property insertion order.
 */
export function canonicalizeJson(value: any): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const pairs = keys
      .filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalizeJson(value[k])}`);
    return `{${pairs.join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Compute SHA-256 hex digest of a JSON-serializable object or string
 */
export function payloadHash(payload: any): string {
  const normalized = typeof payload === "string" ? payload : canonicalizeJson(payload);
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
