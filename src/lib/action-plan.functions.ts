import { createServerFn } from "@tanstack/react-start";
import { fallbackActionPlan } from "./action-plan-fallback";
import type { ActionPlan, ActionPlanInput, TechPriority } from "./action-plan-types";

const PRIORITIES: TechPriority[] = ["P0", "P1", "P2"];

function coerce(raw: unknown): ActionPlan | null {
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

export const generateActionPlan = createServerFn({ method: "POST" })
  .inputValidator((input: ActionPlanInput) => {
    if (!input || typeof input !== "object") throw new Error("Invalid input");
    const text = String(input.regulationText ?? "").trim();
    if (!text) throw new Error("Regulation text required");
    if (!Array.isArray(input.impacts)) throw new Error("Impacts required");
    return {
      regulationText: text.slice(0, 20000),
      summary: input.summary,
      impacts: input.impacts,
    };
  })
  .handler(async ({ data }): Promise<ActionPlan> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ...fallbackActionPlan };

    const system = `You are a senior compliance officer drafting a remediation action plan for legal review. Return STRICT JSON only:
{
  "policy_draft": string,
  "amendments": [{"contract_id": string, "contract_name": string, "suggestion": string, "rationale": string}],
  "tech_fixes": [{"priority": "P0"|"P1"|"P2", "title": string, "detail": string}]
}
Rules:
- policy_draft is ONE paragraph of proposed internal policy language (4–6 sentences).
- amendments MUST cover every impacted contract from the input, using its exact contract_id.
- Each amendment suggestion is one sentence of proposed contract language; rationale is one short sentence.
- tech_fixes are 3–6 prioritized operational/engineering steps.
- Nothing is presented as final. All output is a draft for legal review.
- Output JSON only, no code fences, no prose.`;

    const user = `PROPOSED REGULATION:
${data.regulationText}

SIMULATION SUMMARY:
${data.summary ?? "(none)"}

IMPACTED CONTRACTS:
${JSON.stringify(data.impacts)}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45_000);
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
        },
        body: JSON.stringify({
          model: "openai/gpt-4o",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        console.error("[action-plan] gateway error", res.status);
        return { ...fallbackActionPlan };
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return { ...fallbackActionPlan };
      }
      const plan = coerce(parsed);
      if (!plan) return { ...fallbackActionPlan };
      return plan;
    } catch (err) {
      console.error("[action-plan] exception", err);
      return { ...fallbackActionPlan };
    }
  });
