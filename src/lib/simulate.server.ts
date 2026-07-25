import type { ImpactEntry, Severity } from "./simulate-types";

const SEVERITIES: Severity[] = ["low", "medium", "high"];

export function coerceImpacts(raw: unknown, validIds: Set<string>): ImpactEntry[] | null {
  if (!raw || typeof raw !== "object") return null;
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { impacts?: unknown }).impacts)
      ? (raw as { impacts: unknown[] }).impacts
      : null;
  if (!arr) return null;
  const out: ImpactEntry[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const id = String(o.contract_id ?? o.id ?? "");
    const sev = String(o.severity ?? "").toLowerCase() as Severity;
    const fix = String(o.suggested_amendment ?? o.amendment ?? "");
    if (!validIds.has(id)) continue;
    if (!SEVERITIES.includes(sev)) continue;
    if (!fix) continue;
    out.push({ contract_id: id, severity: sev, suggested_amendment: fix });
  }
  return out;
}