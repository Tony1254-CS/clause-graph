import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";
import { fallbackSimulation } from "./simulate-fallback";
import type { SimulationResult, SimulateInput } from "./simulate-types";

export const simulateImpact = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: SimulateInput) => {
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
    const { userId, orgId } = context;
    const { query } = await import("./db.server");
    const { coerceImpacts } = await import("./simulate.server");
    const { chatCompletion } = await import("./ai.server");

    // Enforce simulation quota against caller's org in PostgreSQL
    if (orgId) {
      try {
        await query(`SELECT assert_within_quota($1, 'run_simulation')`, [orgId]);
      } catch (quotaErr) {
        throw new Error(quotaErr instanceof Error ? quotaErr.message : "Quota exceeded");
      }
    }

    const [contractRows, regRows, staleFindings] = await Promise.all([
      query<{
        id: string;
        name: string;
        counterparty: string;
        value: number | string;
        clauses: Array<{ text: string; linked_regs: string[] | null }> | null;
      }>(
        `SELECT 
          c.id, c.name, c.counterparty, c.value,
          COALESCE(
            json_agg(
              json_build_object('text', cl.text, 'linked_regs', cl.linked_regs)
            ) FILTER (WHERE cl.id IS NOT NULL),
            '[]'::json
          ) AS clauses
         FROM public.contracts c
         LEFT JOIN public.clauses cl ON cl.contract_id = c.id
         WHERE c.org_id = $1
         GROUP BY c.id`,
        [orgId]
      ),
      query(
        `SELECT id, jurisdiction, title, summary, obligations FROM public.regulations`
      ),
      query<{
        raw_citation: string;
        contract_id: string;
        severity: string;
        reason: string;
        suggested_citation: string | null;
        evidence: any;
      }>(
        `SELECT ci.raw_citation, ci.contract_id, f.severity, f.reason, f.suggested_citation, f.evidence
         FROM public.stale_citation_findings f
         JOIN public.citation_instances ci ON ci.id = f.citation_instance_id
         WHERE f.org_id = $1 AND f.status = 'open'
         ORDER BY CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END ASC
         LIMIT 20`,
        [orgId]
      ),
    ]);

    const contracts = contractRows ?? [];
    const validIds = new Set(contracts.map((c) => c.id));

    if (contracts.length === 0) return { ...fallbackSimulation };

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

    const staleContext = (staleFindings ?? []).map((sf) => ({
      contract_id: sf.contract_id,
      flagged_citation: sf.raw_citation,
      severity: sf.severity,
      reason: sf.reason,
      suggested_citation: sf.suggested_citation,
      official_source: sf.evidence?.official_source_url,
    }));

    const system = `You are a legal compliance analyst. Given a proposed regulation and a portfolio of contracts, identify which contracts are materially impacted. Return STRICT JSON only, matching this schema:
{"summary": string, "impacts": [{"contract_id": string, "severity": "low"|"medium"|"high", "suggested_amendment": string}]}
Rules:
- contract_id MUST match an id from the provided contracts list.
- Include only contracts with a real, defensible impact (skip contracts that are clearly unaffected).
- suggested_amendment MUST be exactly one sentence of amendment language.
- summary is one sentence describing the regulation's overall thrust.
- Take into account known open stale citations if relevant to the proposed regulatory thrust. Do not treat findings as definitive conclusions without evidence.
- Output JSON only, no prose, no code fences.`;

    const user = `PROPOSED REGULATION:
${data.regulationText}

REGULATORY ONTOLOGY (for cross-reference):
${JSON.stringify(regRows ?? [])}

OPEN STALE CITATION FINDINGS (for portfolio context):
${JSON.stringify(staleContext)}

CONTRACT PORTFOLIO:
${JSON.stringify(contractContext)}`;

    let result: SimulationResult = { ...fallbackSimulation };
    try {
      const content = await chatCompletion({
        model: "gpt-4o",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      if (content) {
        try {
          const parsed = JSON.parse(content);
          const impacts = coerceImpacts(parsed, validIds);
          if (impacts && impacts.length > 0) {
            const summary =
              typeof (parsed as { summary?: unknown }).summary === "string"
                ? (parsed as { summary: string }).summary
                : undefined;
            result = { impacts, summary, fallback: false, engine: "llm" };
          }
        } catch {
          /* fallback */
        }
      }
    } catch (err) {
      console.error("[simulate] exception", err);
    }

    const { evaluateGate, enqueueForReview } = await import("./review/gate.server");
    const engine = result.fallback ? "deterministic_fallback" : "llm";
    result.engine = engine;

    const contractsMap = new Map(contracts.map((c) => [c.id, c]));
    const runUuid = `00000000-0000-0000-0000-${Date.now().toString(16).padStart(12, "0")}`.slice(0, 36);
    let hasGatedFinding = false;
    let primaryReviewId: string | undefined;

    // Evaluate gate and enqueue high-risk or fallback findings
    for (const impact of result.impacts) {
      const contract = contractsMap.get(impact.contract_id);
      const exposureUsd = contract?.value ? Number(contract.value) : 0;

      const gate = evaluateGate({
        sourceType: "simulation",
        severity: impact.severity,
        exposureUsd,
        engine,
        inputText: data.regulationText,
      });

      if (gate.required) {
        hasGatedFinding = true;
        try {
          const review = await enqueueForReview({
            orgId,
            sourceType: "simulation",
            sourceId: runUuid,
            severity: impact.severity,
            summary: impact.suggested_amendment || `Impact finding on ${contract?.name || impact.contract_id}`,
            payload: {
              ...impact,
              contract_name: contract?.name,
              exposure_usd: exposureUsd,
            },
            inputSnapshot: {
              regulationText: data.regulationText,
              contractId: impact.contract_id,
              regulationId: data.regulationId,
            },
            engine,
            modelName: "gpt-4o",
            promptVersion: "v2.0",
            gate,
            submittedBy: userId,
          });

          impact.review_status = "pending_review";
          impact.review_id = review.id;
          impact.flag_reasons = gate.flagReasons;
          if (!primaryReviewId) primaryReviewId = review.id;
        } catch (enqueueErr) {
          console.warn("[simulate] review enqueue error:", enqueueErr);
          impact.review_status = "pending_review";
        }
      } else {
        impact.review_status = "not_required";
      }
    }

    result.reviewStatus = hasGatedFinding ? "pending_review" : "not_required";
    result.reviewId = primaryReviewId;

    // Atomically persist simulation_runs and write audit_log row (§8.3, §10)
    if (orgId) {
      try {
        const crypto = await import("node:crypto");
        const correlationId = crypto.randomUUID();
        result.correlationId = correlationId;

        const inputHash = crypto.createHash("sha256").update(data.regulationText).digest("hex");
        const outputHash = crypto.createHash("sha256").update(JSON.stringify(result)).digest("hex");
        const basis = {
          model_name: result.fallback ? "deterministic_fallback" : "gpt-4o",
          prompt_version: "v2.0",
          input_hash: inputHash,
          output_hash: outputHash,
        };
        const metadata = {
          run_type: data.runType,
          contracts_analyzed: contracts.length,
          fallback_reason: result.fallback ? "Model invocation returned fallback or error" : undefined,
        };

        const { queryOne } = await import("./db.server");
        const inserted = await queryOne<{ record_simulation_run: string }>(
          `SELECT public.record_simulation_run(
            $1, $2, $3::jsonb, $4, $5, $6, $7::jsonb, $8::jsonb
          )`,
          [
            orgId,
            data.regulationText,
            JSON.stringify(result),
            data.runType,
            userId || null,
            correlationId,
            JSON.stringify(basis),
            JSON.stringify(metadata),
          ]
        );
        if (inserted?.record_simulation_run) {
          result.simulationRunId = inserted.record_simulation_run;
        }
      } catch (insertErr) {
        console.error("[simulate] record_simulation_run error", insertErr);
      }
    }

    return result;
  });
