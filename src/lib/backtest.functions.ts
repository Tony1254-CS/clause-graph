import { createServerFn } from "@tanstack/react-start";
import { backtestCases } from "@/data/backtest-cases";
import type { SimulationResult, Severity, ImpactEntry } from "./simulate-types";

const SEVERITIES: Severity[] = ["low", "medium", "high"];

export const simulateBacktest = createServerFn({ method: "POST" })
  .inputValidator((input: { caseId: string }) => {
    const id = String(input?.caseId ?? "");
    if (!id) throw new Error("caseId required");
    return { caseId: id };
  })
  .handler(async ({ data }): Promise<SimulationResult> => {
    const bt = backtestCases.find((c) => c.id === data.caseId);
    if (!bt) throw new Error("Unknown case");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ...bt.fallback };

    const clauseCtx = bt.reconstructed_clauses.map((c) => ({
      id: c.id,
      text: c.text,
    }));

    const system = `You are a legal compliance analyst. Given a proposed regulation and a small set of RECONSTRUCTED contract clauses (synthetic, drafted to mirror a real enforcement case — NOT the company's actual contracts), identify which clauses are materially impacted. Return STRICT JSON:
{"summary": string, "impacts": [{"contract_id": string, "severity": "low"|"medium"|"high", "suggested_amendment": string}]}
- contract_id MUST match a clause id from the input.
- suggested_amendment is exactly one sentence of amendment language.
- summary is one sentence on the regulation's thrust.
- JSON only.`;

    const user = `PROPOSED REGULATION:
${bt.reconstructed_prompt}

ENFORCEMENT CASE CONTEXT (for grounding, not for reproduction):
${bt.company} — ${bt.regulation} — ${bt.summary}

RECONSTRUCTED CLAUSES:
${JSON.stringify(clauseCtx)}`;

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

      if (!res.ok) return { ...bt.fallback };
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return { ...bt.fallback };
      }
      if (!parsed || typeof parsed !== "object") return { ...bt.fallback };
      const rawArr = Array.isArray((parsed as { impacts?: unknown }).impacts)
        ? ((parsed as { impacts: unknown[] }).impacts)
        : [];
      const validIds = new Set(bt.reconstructed_clauses.map((c) => c.id));
      const impacts: ImpactEntry[] = [];
      for (const item of rawArr) {
        if (!item || typeof item !== "object") continue;
        const o = item as Record<string, unknown>;
        const id = String(o.contract_id ?? "");
        const sev = String(o.severity ?? "").toLowerCase() as Severity;
        const fix = String(o.suggested_amendment ?? "");
        if (!validIds.has(id) || !SEVERITIES.includes(sev) || !fix) continue;
        impacts.push({ contract_id: id, severity: sev, suggested_amendment: fix });
      }
      if (impacts.length === 0) return { ...bt.fallback };
      const summary =
        typeof (parsed as { summary?: unknown }).summary === "string"
          ? (parsed as { summary: string }).summary
          : undefined;
      return { impacts, summary, fallback: false };
    } catch (err) {
      console.error("[backtest] exception", err);
      return { ...bt.fallback };
    }
  });
