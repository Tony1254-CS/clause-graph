import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fallbackSimulation } from "./simulate-fallback";
import type { ImpactEntry, Severity, SimulationResult, SimulateInput } from "./simulate-types";

const SEVERITIES: Severity[] = ["low", "medium", "high"];

function coerceImpacts(raw: unknown, validIds: Set<string>): ImpactEntry[] | null {
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

export const simulateImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SimulateInput) => {
    const text = String(input?.regulationText ?? "").trim();
    if (!text) throw new Error("Regulation text is required");
    if (text.length > 20000) throw new Error("Regulation text too long");
    const rt = input?.runType;
    const runType: "reactive" | "forecast" | "what_if" =
      rt === "forecast" || rt === "what_if" ? rt : "reactive";
    const regulationId = input?.regulationId ? String(input.regulationId) : undefined;
    return { regulationText: text, runType, regulationId };
  })
  .handler(async ({ data, context }): Promise<SimulationResult> => {
    const { supabase, userId } = context;

    // Enforce simulation quota against the caller's org
    const { data: profileForQuota } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileForQuota?.org_id) {
      const { error: quotaErr } = await supabase.rpc("assert_within_quota", {
        _org: profileForQuota.org_id,
        _action: "run_simulation",
      });
      if (quotaErr) throw new Error(quotaErr.message);
    }

    const [{ data: contractRows, error: cErr }, { data: regRows, error: rErr }] =
      await Promise.all([
        supabase
          .from("contracts")
          .select("id, name, counterparty, value, clauses(text, linked_regs)"),
        supabase
          .from("regulations")
          .select("id, jurisdiction, title, summary, obligations"),
      ]);
    if (cErr) throw cErr;
    if (rErr) throw rErr;

    const contracts = (contractRows ?? []) as Array<{
      id: string;
      name: string;
      counterparty: string;
      value: number | string;
      clauses: Array<{ text: string; linked_regs: string[] | null }> | null;
    }>;
    const validIds = new Set(contracts.map((c) => c.id));

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey || contracts.length === 0) return { ...fallbackSimulation };

    const contractContext = contracts.map((c) => ({
      id: c.id,
      name: c.name,
      counterparty: c.counterparty,
      value: typeof c.value === "string" ? Number(c.value) : c.value,
      clauses: (c.clauses ?? []).map((cl) => ({
        text: cl.text,
        linked_regs: cl.linked_regs ?? [],
      })),
    }));

    const system = `You are a legal compliance analyst. Given a proposed regulation and a portfolio of contracts, identify which contracts are materially impacted. Return STRICT JSON only, matching this schema:
{"summary": string, "impacts": [{"contract_id": string, "severity": "low"|"medium"|"high", "suggested_amendment": string}]}
Rules:
- contract_id MUST match an id from the provided contracts list.
- Include only contracts with a real, defensible impact (skip contracts that are clearly unaffected).
- suggested_amendment MUST be exactly one sentence of amendment language.
- summary is one sentence describing the regulation's overall thrust.
- Output JSON only, no prose, no code fences.`;

    const user = `PROPOSED REGULATION:
${data.regulationText}

REGULATORY ONTOLOGY (for cross-reference):
${JSON.stringify(regRows ?? [])}

CONTRACT PORTFOLIO:
${JSON.stringify(contractContext)}`;

    let result: SimulationResult = { ...fallbackSimulation };
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
          temperature: 0.2,
        }),
      }).finally(() => clearTimeout(timeout));

      if (res.ok) {
        const json = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = json.choices?.[0]?.message?.content ?? "";
        try {
          const parsed = JSON.parse(content);
          const impacts = coerceImpacts(parsed, validIds);
          if (impacts && impacts.length > 0) {
            const summary =
              typeof (parsed as { summary?: unknown }).summary === "string"
                ? (parsed as { summary: string }).summary
                : undefined;
            result = { impacts, summary, fallback: false };
          }
        } catch {
          /* fallback */
        }
      } else {
        console.error("[simulate] gateway error", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("[simulate] exception", err);
    }

    // Persist for audit history (best-effort)
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileRow?.org_id) {
      const { error: insertErr } = await supabase.from("simulation_runs").insert({
        org_id: profileRow.org_id,
        input_regulation_text: data.regulationText,
        result_json: JSON.parse(JSON.stringify(result)),
        triggered_by: userId,
      });
      if (insertErr) console.error("[simulate] persist error", insertErr);
    }


    return result;
  });
