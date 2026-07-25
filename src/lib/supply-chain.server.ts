import type { CascadeHit } from "./supply-chain.functions";

const SEVERITIES: Array<CascadeHit["severity"]> = ["low", "medium", "high"];

export function coerceHits(raw: unknown, valid: Set<string>): CascadeHit[] {
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { hits?: unknown })?.hits)
      ? (raw as { hits: unknown[] }).hits
      : [];
  const out: CascadeHit[] = [];
  for (const it of arr) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const id = String(o.node_id ?? o.id ?? "");
    const sev = String(o.severity ?? "").toLowerCase() as CascadeHit["severity"];
    if (!valid.has(id) || !SEVERITIES.includes(sev)) continue;
    out.push({
      node_id: id,
      hop: Math.max(0, Number(o.hop ?? 0) | 0),
      reason: String(o.reason ?? ""),
      broken_clause: String(o.broken_clause ?? ""),
      severity: sev,
      indirect_exposure_usd: Number(o.indirect_exposure_usd ?? 0) || 0,
    });
  }
  return out;
}