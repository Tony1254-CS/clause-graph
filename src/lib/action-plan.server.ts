import type { ActionPlan, TechPriority } from "./action-plan-types";

const PRIORITIES: TechPriority[] = ["P0", "P1", "P2"];

export function coerceActionPlan(raw: unknown): ActionPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const policy = typeof o.policy_draft === "string" ? o.policy_draft : "";
  if (!policy) return null;
  const rawA = Array.isArray(o.amendments) ? o.amendments : [];
  const rawT = Array.isArray(o.tech_fixes) ? o.tech_fixes : [];
  const amendments = rawA
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const x = it as Record<string, unknown>;
      const id = String(x.contract_id ?? "");
      const name = String(x.contract_name ?? "");
      const s = String(x.suggestion ?? "");
      const r = String(x.rationale ?? "");
      if (!id || !s) return null;
      return { contract_id: id, contract_name: name, suggestion: s, rationale: r };
    })
    .filter(Boolean) as ActionPlan["amendments"];
  const tech_fixes = rawT
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const x = it as Record<string, unknown>;
      const p = String(x.priority ?? "").toUpperCase() as TechPriority;
      const title = String(x.title ?? "");
      const detail = String(x.detail ?? "");
      if (!PRIORITIES.includes(p) || !title) return null;
      return { priority: p, title, detail };
    })
    .filter(Boolean) as ActionPlan["tech_fixes"];
  if (amendments.length === 0 && tech_fixes.length === 0) return null;
  return { policy_draft: policy, amendments, tech_fixes, fallback: false };
}
