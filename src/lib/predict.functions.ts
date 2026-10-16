import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";

export type ProbabilityBand = "high" | "medium" | "low";

export type Amendment = {
  amended_on: string;
  summary: string;
  direction: "tightened" | "loosened" | "clarified" | "expanded";
};

export type ForecastEntry = {
  regulation_id: string;
  title: string;
  jurisdiction: string;
  summary: string;
  last_amended_on: string | null;
  amendment_count: number;
  avg_interval_days: number | null;
  days_since_last: number | null;
  news_signal_boost: number;
  base_probability: number;
  boost: number;
  probability: number;
  band: ProbabilityBand;
  window_months: 3 | 6 | 12 | 18;
  amendments: Amendment[];
};

export const predictAmendmentRisk = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async (): Promise<ForecastEntry[]> => {
    const { query } = await import("./db.server");
    const { bandFor, daysBetween, daysSince, windowFor } = await import("./predict.server");

    const [regs, amends] = await Promise.all([
      query<{
        id: string;
        jurisdiction: string;
        title: string;
        summary: string;
        news_signal_boost: number;
      }>(`SELECT id, jurisdiction, title, summary, news_signal_boost FROM public.regulations`),
      query<{
        regulation_id: string;
        amended_on: string;
        summary: string;
        direction: string;
      }>(
        `SELECT regulation_id, amended_on, summary, direction 
         FROM public.regulation_amendments 
         ORDER BY amended_on DESC`,
      ),
    ]);

    const byReg = new Map<string, Amendment[]>();
    for (const a of amends ?? []) {
      const list = byReg.get(a.regulation_id) ?? [];
      list.push({
        amended_on: a.amended_on,
        summary: a.summary,
        direction: a.direction as Amendment["direction"],
      });
      byReg.set(a.regulation_id, list);
    }

    const now = Date.now();
    const out: ForecastEntry[] = [];

    for (const r of regs ?? []) {
      const history = (byReg.get(r.id) ?? [])
        .slice()
        .sort((a, b) => a.amended_on.localeCompare(b.amended_on));
      const boost = Number(r.news_signal_boost ?? 0) * 0.3;

      let avgIntervalDays: number | null = null;
      let daysSinceLast: number | null = null;
      let lastAmendedOn: string | null = null;

      if (history.length >= 2) {
        let totalGap = 0;
        for (let i = 1; i < history.length; i++) {
          totalGap += daysBetween(history[i - 1].amended_on, history[i].amended_on);
        }
        avgIntervalDays = Math.round(totalGap / (history.length - 1));
        const last = history[history.length - 1].amended_on;
        lastAmendedOn = last;
        daysSinceLast = daysSince(last, now);
      } else if (history.length === 1) {
        lastAmendedOn = history[0].amended_on;
        daysSinceLast = daysSince(history[0].amended_on, now);
      }

      let baseProb = 0.25;
      if (avgIntervalDays && daysSinceLast != null) {
        const ratio = daysSinceLast / avgIntervalDays;
        baseProb = Math.min(0.85, Math.max(0.15, 0.25 + 0.5 * Math.tanh(ratio - 1)));
      } else if (history.length === 1) {
        baseProb = 0.35;
      }

      const probability = Math.min(0.95, Math.max(0.05, baseProb + boost));
      const band = bandFor(probability);
      const window_months = windowFor(avgIntervalDays, daysSinceLast);

      out.push({
        regulation_id: r.id,
        title: r.title,
        jurisdiction: r.jurisdiction,
        summary: r.summary,
        last_amended_on: lastAmendedOn,
        amendment_count: history.length,
        avg_interval_days: avgIntervalDays,
        days_since_last: daysSinceLast,
        news_signal_boost: Number(r.news_signal_boost ?? 0),
        base_probability: Math.round(baseProb * 100) / 100,
        boost: Math.round(boost * 100) / 100,
        probability: Math.round(probability * 100) / 100,
        band,
        window_months,
        amendments: history.reverse(),
      });
    }

    out.sort((a, b) => b.probability - a.probability);
    return out;
  });

export type HypotheticalAmendment = {
  regulation_id: string;
  amendment_text: string;
  rationale: string;
  based_on_patterns: string[];
  fallback: boolean;
};

export const generateHypotheticalAmendment = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { regulationId: string }) => {
    const id = String(input?.regulationId ?? "").trim();
    if (!id) throw new Error("regulationId is required");
    return { regulationId: id };
  })
  .handler(async ({ data }): Promise<HypotheticalAmendment> => {
    const { queryOne, query } = await import("./db.server");
    const { fallbackHypothetical } = await import("./predict.server");
    const { chatCompletion } = await import("./ai.server");

    const [reg, amends] = await Promise.all([
      queryOne<{ id: string; title: string; summary: string; jurisdiction: string }>(
        `SELECT id, title, summary, jurisdiction FROM public.regulations WHERE id = $1`,
        [data.regulationId],
      ),
      query<{ amended_on: string; summary: string; direction: string }>(
        `SELECT amended_on, summary, direction 
         FROM public.regulation_amendments 
         WHERE regulation_id = $1 
         ORDER BY amended_on DESC`,
        [data.regulationId],
      ),
    ]);

    if (!reg) throw new Error("Regulation not found");

    const history: Amendment[] = (amends ?? []).map((a) => ({
      amended_on: a.amended_on,
      summary: a.summary,
      direction: a.direction as Amendment["direction"],
    }));

    const historyText = history
      .map((h) => `- ${h.amended_on} [${h.direction}]: ${h.summary}`)
      .join("\n");

    const system = `You draft ADVERSARIAL WHAT-IF regulatory amendments for compliance stress-testing. You are NOT predicting an actual amendment; you are extrapolating from a regulation's own past amendment pattern to produce a plausible near-future revision.
Return STRICT JSON:
{"amendment_text": string, "rationale": string, "based_on_patterns": string[]}
Rules:
- amendment_text: 120–220 words. Written in the tone of official regulatory drafting. Follow the historical DIRECTION of change (if the regulation has been consistently tightened, tighten further; if loosened, loosen; etc). Include specific numeric/temporal deltas (shorter windows, expanded scope, new thresholds) so the impact simulator has concrete language to work against.
- rationale: 2 sentences, in plain English, referencing the past patterns.
- based_on_patterns: 2–4 short strings, each quoting one past amendment.
- Output JSON only, no prose, no code fences.`;

    const user = `REGULATION: ${reg.title} (${reg.jurisdiction})
Current text: ${reg.summary}

AMENDMENT HISTORY (most recent first):
${historyText || "(no recorded amendments)"}

Draft the adversarial what-if amendment.`;

    try {
      const content = await chatCompletion({
        model: "gpt-4o",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      });

      if (!content) {
        return fallbackHypothetical(reg.id, reg.title, history);
      }

      const parsed = JSON.parse(content) as {
        amendment_text?: unknown;
        rationale?: unknown;
        based_on_patterns?: unknown;
      };
      const text = typeof parsed.amendment_text === "string" ? parsed.amendment_text : "";
      const rationale = typeof parsed.rationale === "string" ? parsed.rationale : "";
      const patterns = Array.isArray(parsed.based_on_patterns)
        ? parsed.based_on_patterns.filter((s): s is string => typeof s === "string").slice(0, 4)
        : [];
      if (!text) return fallbackHypothetical(reg.id, reg.title, history);
      return {
        regulation_id: reg.id,
        amendment_text: text,
        rationale,
        based_on_patterns: patterns,
        fallback: false,
      };
    } catch (err) {
      console.error("[predict] exception", err);
      return fallbackHypothetical(reg.id, reg.title, history);
    }
  });
