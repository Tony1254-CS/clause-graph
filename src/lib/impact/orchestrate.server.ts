// src/lib/impact/orchestrate.server.ts
// Pipeline orchestrator: retrieval -> classification -> exposure -> persistence (Phase 3 T3.3)

import { query, withOrg } from "../db.server";
import { resolveAiProvider } from "../ai.server";
import {
  getCandidatePairs,
  type ClauseCandidateInput,
  type ObligationCandidateInput,
} from "./candidates.server";
import {
  classifyCandidatePair,
  type ImpactClassificationResult,
  type Verdict,
  type Severity,
} from "./classify.server";
import {
  calculateDeterministicExposure,
  type ExposureBreakdown,
  type ContractExposureInput,
} from "./exposure.server";

export interface EvidenceCard {
  id: string;
  contract_id: string;
  contract_name: string;
  contract_value: number;
  clause_id: string;
  clause_text: string;
  clause_quote: string;
  obligation_id: string;
  instrument_id: string;
  instrument_title?: string;
  official_url?: string;
  rule_quote: string;
  verdict: Verdict;
  severity: Severity | null;
  rationale: string;
  suggested_amendment: string | null;
  confidence: number;
  origin: "ai" | "deterministic";
  review_status: "pending_review" | "approved" | "rejected" | "edited";
}

export interface ImpactAnalysisOptions {
  eventId?: string;
  instrumentId?: string;
  text?: string;
  runType?: "reactive" | "forecast" | "what_if" | "supply_chain";
  triggeredBy?: string;
}

export interface ImpactAnalysisResult {
  runId: string;
  summary: string;
  mode: "ai" | "deterministic";
  exposure: ExposureBreakdown;
  cards: EvidenceCard[];
  insufficientEvidence: EvidenceCard[];
  // Backwards compatibility with existing UI
  impacts: Array<{
    contract_id: string;
    severity: "low" | "medium" | "high";
    suggested_amendment: string;
  }>;
}

interface ContractDbRow {
  id: string;
  name: string;
  value: string | number;
}

interface ClauseDbRow {
  id: string;
  contract_id: string;
  text: string;
  linked_regs: string[];
}

interface ObligationDbRow {
  id: string;
  provision_id: string;
  tag: string;
  statement: string;
  quote: string;
  instrument_id: string;
  instrument_title: string;
  official_url: string | null;
}

/**
 * Runs end-to-end evidence-backed impact analysis for an organization.
 */
export async function runImpactAnalysis(
  orgId: string,
  options: ImpactAnalysisOptions,
): Promise<ImpactAnalysisResult> {
  const provider = resolveAiProvider();
  const runType = options.runType || "reactive";
  const inputText = (options.text || "").trim();

  // 1. Fetch contracts and clauses for the tenant
  const contracts = await query<ContractDbRow>(
    `SELECT id, name, value FROM public.contracts WHERE org_id = $1 AND status = 'active'`,
    [orgId],
  );

  const contractMap = new Map<string, { name: string; value: number }>();
  contracts.forEach((c) => {
    contractMap.set(c.id, {
      name: c.name,
      value: typeof c.value === "string" ? parseFloat(c.value) || 0 : c.value || 0,
    });
  });

  const clauses = await query<ClauseDbRow>(
    `SELECT cl.id, cl.contract_id, cl.text, cl.linked_regs
     FROM public.clauses cl
     JOIN public.contracts c ON c.id = cl.contract_id
     WHERE c.org_id = $1 AND c.status = 'active'`,
    [orgId],
  );

  // 2. Fetch obligations from registry
  let obligationQuery = `
    SELECT o.id, o.provision_id, o.tag, o.statement, o.quote,
           p.instrument_id, li.title as instrument_title, li.official_url
    FROM public.obligations o
    JOIN public.provisions p ON p.id = o.provision_id
    JOIN public.legal_instruments li ON li.id = p.instrument_id
  `;
  const obligationParams: unknown[] = [];

  if (options.instrumentId) {
    obligationQuery += ` WHERE p.instrument_id = $1`;
    obligationParams.push(options.instrumentId);
  } else if (options.eventId) {
    const event = await query<{ instrument_id: string | null }>(
      `SELECT instrument_id FROM public.regulatory_events WHERE id = $1`,
      [options.eventId],
    );
    if (event.length > 0 && event[0].instrument_id) {
      obligationQuery += ` WHERE p.instrument_id = $1`;
      obligationParams.push(event[0].instrument_id);
    }
  }

  const obligations = await query<ObligationDbRow>(obligationQuery, obligationParams);

  // 3. Format candidate inputs
  const clauseCandidates: ClauseCandidateInput[] = clauses.map((cl) => ({
    id: cl.id,
    contract_id: cl.contract_id,
    contract_name: contractMap.get(cl.contract_id)?.name || "Unknown Contract",
    text: cl.text,
    linked_regs: cl.linked_regs || [],
  }));

  const obligationCandidates: ObligationCandidateInput[] = obligations.map((o) => ({
    id: o.id,
    instrument_id: o.instrument_id,
    tag: o.tag,
    statement: o.statement,
    quote: o.quote,
  }));

  const obligationMeta = new Map<string, ObligationDbRow>();
  obligations.forEach((o) => obligationMeta.set(o.id, o));

  // 4. Retrieve candidate pairs deterministically
  const candidatePairs = getCandidatePairs(clauseCandidates, obligationCandidates, {
    minScore: 0.2,
    topKPerObligation: 5,
  });

  // Limit processing to top 15 candidate pairs to balance latency and coverage
  const selectedPairs = candidatePairs.slice(0, 15);

  // 5. Classify candidate pairs (in parallel chunks of 4)
  const classificationResults: Array<{
    candidate: (typeof selectedPairs)[0];
    result: ImpactClassificationResult;
  }> = [];

  const chunkSize = 4;
  for (let i = 0; i < selectedPairs.length; i += chunkSize) {
    const chunk = selectedPairs.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (candidate) => {
        const result = await classifyCandidatePair({
          clauseId: candidate.clause_id,
          contractName: candidate.contract_name,
          clauseText: candidate.clause_text,
          obligationId: candidate.obligation_id,
          instrumentId: candidate.instrument_id,
          tag: candidate.tag,
          statement: candidate.statement,
          ruleQuote: candidate.rule_quote,
        });
        return { candidate, result };
      }),
    );
    classificationResults.push(...chunkResults);
  }

  // 6. Map to evidence cards and exposure inputs
  const cards: EvidenceCard[] = [];
  const insufficientEvidence: EvidenceCard[] = [];
  const exposureInputs: ContractExposureInput[] = [];

  for (const { candidate, result } of classificationResults) {
    const cMeta = contractMap.get(candidate.contract_id);
    const oMeta = obligationMeta.get(candidate.obligation_id);

    const card: EvidenceCard = {
      id: crypto.randomUUID(),
      contract_id: candidate.contract_id,
      contract_name: candidate.contract_name,
      contract_value: cMeta?.value || 0,
      clause_id: candidate.clause_id,
      clause_text: candidate.clause_text,
      clause_quote: result.clause_quote,
      obligation_id: candidate.obligation_id,
      instrument_id: candidate.instrument_id,
      instrument_title: oMeta?.instrument_title,
      official_url: oMeta?.official_url || undefined,
      rule_quote: result.rule_quote,
      verdict: result.verdict,
      severity: result.severity,
      rationale: result.rationale,
      suggested_amendment: result.suggested_amendment,
      confidence: result.confidence,
      origin: result.origin,
      review_status: "pending_review",
    };

    if (result.verdict === "insufficient_evidence") {
      insufficientEvidence.push(card);
    } else {
      cards.push(card);
      exposureInputs.push({
        contractId: card.contract_id,
        contractName: card.contract_name,
        contractValue: card.contract_value,
        reviewStatus: card.review_status,
        verdict: card.verdict,
        severity: card.severity,
      });
    }
  }

  // 7. Calculate deterministic exposure
  const exposure = calculateDeterministicExposure(exposureInputs, contracts.length);

  // 8. Persist run and assessments in PostgreSQL transaction
  const summary =
    cards.length > 0
      ? `Analysis identified ${cards.length} actionable impact(s) across ${exposure.impactedContractsCount} contract(s), totaling $${exposure.totalExposure.toLocaleString()} in exposed portfolio value.`
      : `No contractual conflicts or gaps detected across ${contracts.length} evaluated contracts.`;

  const runRecord = await withOrg(orgId, async (client) => {
    // A. Insert simulation run
    const runRes = await client.query<{ id: string; created_at: string }>(
      `INSERT INTO public.simulation_runs (
         org_id, input_regulation_text, result_json, run_type, triggered_by
       ) VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING id, created_at`,
      [
        orgId,
        inputText ||
          (options.eventId ? `Event: ${options.eventId}` : "Comprehensive Portfolio Audit"),
        JSON.stringify({
          cards_count: cards.length,
          insufficient_count: insufficientEvidence.length,
          exposure,
          summary,
        }),
        runType,
        options.triggeredBy || null,
      ],
    );

    const runId = runRes.rows[0].id;

    // B. Insert all cards into impact_assessments
    const allCards = [...cards, ...insufficientEvidence];
    for (const card of allCards) {
      await client.query(
        `INSERT INTO public.impact_assessments (
           id, org_id, run_id, event_id, contract_id, clause_id, obligation_id,
           verdict, severity, clause_quote, rule_quote, rationale, suggested_amendment,
           confidence, origin, model, prompt_version, review_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          card.id,
          orgId,
          runId,
          options.eventId || null,
          card.contract_id,
          card.clause_id,
          card.obligation_id,
          card.verdict,
          card.severity,
          card.clause_quote,
          card.rule_quote,
          card.rationale,
          card.suggested_amendment,
          card.confidence,
          card.origin,
          provider.defaultModel || null,
          "2026-10-16.v1",
          card.review_status,
        ],
      );
    }

    // C. Append to audit log
    await client.query(
      `INSERT INTO public.audit_log (org_id, actor_id, action, target_type, target_id, details)
       VALUES ($1, $2, 'impact_analysis.completed', 'simulation_run', $3, $4::jsonb)`,
      [
        orgId,
        options.triggeredBy || null,
        runId,
        JSON.stringify({
          actionable_count: cards.length,
          insufficient_count: insufficientEvidence.length,
          total_exposure: exposure.totalExposure,
          impacted_contracts: exposure.impactedContractsCount,
        }),
      ],
    );

    return { runId };
  });

  // 9. Format legacy impacts for UI compatibility
  const legacyImpacts = cards.map((c) => ({
    contract_id: c.contract_id,
    severity: (c.severity || "medium") as "low" | "medium" | "high",
    suggested_amendment: c.suggested_amendment || c.rationale,
  }));

  return {
    runId: runRecord.runId,
    summary,
    mode: provider.kind === "none" ? "deterministic" : "ai",
    exposure,
    cards,
    insufficientEvidence,
    impacts: legacyImpacts,
  };
}
