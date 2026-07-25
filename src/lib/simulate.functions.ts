import { createServerFn } from "@tanstack/react-start";
import { contracts } from "@/data/contracts";
import { regulations } from "@/data/regulations";
import { fallbackSimulation } from "./simulate-fallback";
import type { ImpactEntry, Severity, SimulationResult, SimulateInput } from "./simulate-types";

const SEVERITIES: Severity[] = ["low", "medium", "high"];

function coerceImpacts(raw: unknown): ImpactEntry[] | null {
  if (!raw || typeof raw !== "object") return null;
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { impacts?: unknown }).impacts)
      ? (raw as { impacts: unknown[] }).impacts
      : null;
  if (!arr) return null;
  const validIds = new Set(contracts.map((c) => c.id));
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
  .inputValidator((input: SimulateInput) => {
    const text = String(input?.regulationText ?? "").trim();
    if (!text) throw new Error("Regulation text is required");
    if (text.length > 20000) throw new Error("Regulation text too long");
    return { regulationText: text };
  })
  .handler(async ({ data }): Promise<SimulationResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ...fallbackSimulation };

    const contractContext = contracts.map((c) => ({
      id: c.id,
      name: c.name,
      counterparty: c.counterparty,
      value: c.value,
      clauses: c.clauses.map((cl) => ({
        text: cl.text,
        linked_regs: cl.linked_regs,
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
${JSON.stringify(regulations)}

CONTRACT PORTFOLIO:
${JSON.stringify(contractContext)}`;

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

      if (!res.ok) {
        console.error("[simulate] gateway error", res.status, await res.text().catch(() => ""));
        return { ...fallbackSimulation };
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return { ...fallbackSimulation };
      }
      const impacts = coerceImpacts(parsed);
      if (!impacts || impacts.length === 0) return { ...fallbackSimulation };

      const summary =
        typeof (parsed as { summary?: unknown }).summary === "string"
          ? ((parsed as { summary: string }).summary)
          : undefined;

      return { impacts, summary, fallback: false };
    } catch (err) {
      console.error("[simulate] exception", err);
      return { ...fallbackSimulation };
    }
  });
