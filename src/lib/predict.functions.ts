import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { bandFor, daysBetween, daysSince, fallbackHypothetical, windowFor } from "./predict.server";

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
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ForecastEntry[]> => {
    const { supabase } = context;
    const [{ data: regs, error: rErr }, { data: amends, error: aErr }] = await Promise.all([
      supabase
        .from("regulations")
        .select("id, jurisdiction, title, summary, news_signal_boost"),
      supabase
        .from("regulation_amendments")
        .select("regulation_id, amended_on, summary, direction")
        .order("amended_on", { ascending: false }),
    ]);
    if (rErr) throw rErr;
    if (aErr) throw aErr;

    const byReg = new Map<string, Amendment[]>();
    for (const a of amends ?? []) {
      const list = byReg.get(a.regulation_id) ?? [];
      list.push({
        amended_on: a.amended_on as string,
        summary: a.summary as string,
        direction: a.direction as Amendment["direction"],
      });
      byReg.set(a.regulation_id, list);
    }

    const now = Date.now();
    const out: ForecastEntry[] = [];

    for (const r of regs ?? []) {
      const history = (byReg.get(r.id) ?? []).slice().sort((a, b) =>
        a.amended_on.localeCompare(b.amended_on),
      );
      const boost = Number(r.news_signal_boost ?? 0) * 0.3;

      let avgIntervalDays: number | null = null;
      let daysSinceLast: number | null = null;
      let lastAmendedOn: string | null = null;

      if (history.length >= 2) {
        let totalGap = 0;
        for (let i = 1; i < history.length; i++) {
          totalGap += daysBetween(history[i - 1].amended_on, history[i].amended_on);
        }
        avgIntervalDays = totalGap / (history.length - 1);
      }

      if (history.length > 0) {
        lastAmendedOn = history[history.length - 1].amended_on;
        daysSinceLast = daysSince(lastAmendedOn, now);
      }

      let baseProbability = 0;
      if (avgIntervalDays && daysSinceLast !== null) {
        const ratio = daysSinceLast / avgIntervalDays;
        baseProbability = Math.max(0, Math.min(0.7, ratio * 0.7));
      } else if (daysSinceLast !== null) {
        // Single-amendment history — modest base if it has been > 3 years.
        baseProbability = Math.min(0.35, daysSinceLast / 365 / 10);
      }

      const probability = Math.min(1, baseProbability + boost);

      out.push({
        regulation_id: r.id,
        title: r.title as string,
        jurisdiction: r.jurisdiction as string,
        summary: r.summary as string,
        last_amended_on: lastAmendedOn,
        amendment_count: history.length,
        avg_interval_days: avgIntervalDays,
        days_since_last: daysSinceLast,
        news_signal_boost: Number(r.news_signal_boost ?? 0),
        base_probability: baseProbability,
        boost,
        probability,
        band: bandFor(probability),
        window_months: windowFor(avgIntervalDays, daysSinceLast),
        amendments: history.slice().reverse(),
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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { regulationId: string }) => {
    const id = String(input?.regulationId ?? "").trim();
    if (!id) throw new Error("regulationId is required");
    return { regulationId: id };
  })
  .handler(async ({ data, context }): Promise<HypotheticalAmendment> => {
    const { supabase } = context;
    const [{ data: reg, error: rErr }, { data: amends, error: aErr }] = await Promise.all([
      supabase
        .from("regulations")
        .select("id, title, summary, jurisdiction")
        .eq("id", data.regulationId)
        .maybeSingle(),
      supabase
        .from("regulation_amendments")
        .select("amended_on, summary, direction")
        .eq("regulation_id", data.regulationId)
        .order("amended_on", { ascending: false }),
    ]);
    if (rErr) throw rErr;
    if (aErr) throw aErr;
    if (!reg) throw new Error("Regulation not found");

    const history: Amendment[] = (amends ?? []).map((a) => ({
      amended_on: a.amended_on as string,
      summary: a.summary as string,
      direction: a.direction as Amendment["direction"],
    }));

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return fallbackHypothetical(reg.id as string, reg.title as string, history);

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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
          temperature: 0.4,
        }),
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        console.error("[predict] gateway error", res.status, await res.text().catch(() => ""));
        return fallbackHypothetical(reg.id as string, reg.title as string, history);
      }

      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content ?? "";
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
      if (!text) return fallbackHypothetical(reg.id as string, reg.title as string, history);
      return {
        regulation_id: reg.id as string,
        amendment_text: text,
        rationale,
        based_on_patterns: patterns,
        fallback: false,
      };
    } catch (err) {
      console.error("[predict] exception", err);
      return fallbackHypothetical(reg.id as string, reg.title as string, history);
    }
  });
