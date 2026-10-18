// ============================================================================
// Stale Scan Server Function: src/lib/stale/scan.functions.ts
// Audited execution scanner evaluating organization citations against legal ontology
// ============================================================================

import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "../auth-middleware";
import {
  evaluateCitationStaleness,
  type RegulationTemporalMetadata,
  type StalenessFindingResult,
} from "./detector";

export interface RunStaleScanInput {
  contractIds?: string[];
  triggerSource?: 'manual' | 'ontology_update' | 'scheduled' | 'backtest';
  evaluationDate?: string; // YYYY-MM-DD
}

export interface RunStaleScanResult {
  scan_run_id: string;
  trigger_source: string;
  citations_scanned: number;
  findings_count: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  total_exposure: number;
  duration_ms: number;
  findings: Array<{
    id: string;
    citation_instance_id: string;
    raw_citation: string;
    contract_id: string;
    contract_name: string;
    severity: string;
    staleness_type: string;
    reason: string;
    suggested_citation?: string;
    financial_exposure?: number;
    transition_deadline?: string;
    status: string;
  }>;
}

export const runStaleScan = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: RunStaleScanInput = {}) => {
    const triggerSource = input?.triggerSource || 'manual';
    const validSources = ['manual', 'ontology_update', 'scheduled', 'backtest'] as const;
    const cleanSource = validSources.includes(triggerSource as any) ? triggerSource : 'manual';
    const contractIds = Array.isArray(input?.contractIds)
      ? input.contractIds.map((id) => String(id).trim()).filter(Boolean)
      : undefined;
    const evaluationDate = input?.evaluationDate ? String(input.evaluationDate) : undefined;
    return { contractIds, triggerSource: cleanSource, evaluationDate };
  })
  .handler(async ({ data, context }): Promise<RunStaleScanResult> => {
    const startTime = Date.now();
    const { orgId, userId } = context;
    const { query, transaction } = await import("../db.server");
    const scanRunId = crypto.randomUUID();

    // 1. Fetch regulations and their versions for deterministic matching
    const [regRows, versionRows] = await Promise.all([
      query<any>(
        `SELECT id, title, jurisdiction, status, effective_from, effective_to,
                repealed_by, superseded_by, current_version, official_source_url,
                gazette_reference, last_verified_at
         FROM public.regulations`
      ),
      query<any>(
        `SELECT id, regulation_id, version, effective_from, effective_to,
                amendment_type, summary, diff_from_previous, obligations, official_source_url
         FROM public.regulation_versions
         ORDER BY regulation_id, version ASC`
      ),
    ]);

    // Map versions to parent regulations
    const versionMap = new Map<string, any[]>();
    for (const v of versionRows || []) {
      const list = versionMap.get(v.regulation_id) || [];
      list.push(v);
      versionMap.set(v.regulation_id, list);
    }

    const regMap = new Map<string, RegulationTemporalMetadata>();
    for (const r of regRows || []) {
      regMap.set(r.id, {
        ...r,
        versions: versionMap.get(r.id) || [],
      });
    }

    // 2. Fetch citations for current organization (optionally filtered by contractIds)
    let citationQuery = `
      SELECT ci.id, ci.raw_citation, ci.cited_article, ci.cited_version,
             ci.cited_year, ci.as_of_date, ci.regulation_id, ci.clause_id,
             ci.contract_id, c.name as contract_name, c.value as contract_value,
             cl.text as clause_text
      FROM public.citation_instances ci
      JOIN public.contracts c ON c.id = ci.contract_id
      JOIN public.clauses cl ON cl.id = ci.clause_id
      WHERE ci.org_id = $1
    `;
    const queryParams: any[] = [orgId];

    if (data.contractIds && data.contractIds.length > 0) {
      citationQuery += ` AND ci.contract_id = ANY($2)`;
      queryParams.push(data.contractIds);
    }

    const citations = await query<any>(citationQuery, queryParams);
    const scannedCount = citations ? citations.length : 0;

    // 3. Run evaluation for each citation
    const generatedFindings: Array<{
      citation_instance_id: string;
      contract_id: string;
      contract_name: string;
      raw_citation: string;
      finding: StalenessFindingResult;
    }> = [];

    // Track evaluated contracts to aggregate exposure without duplicates
    const contractExposureMap = new Map<string, number>();

    for (const cit of citations || []) {
      const reg = cit.regulation_id ? regMap.get(cit.regulation_id) || null : null;
      const finding = evaluateCitationStaleness(cit, reg, {
        evaluationDate: data.evaluationDate,
        contractValue: Number(cit.contract_value) || 0,
      });

      if (finding) {
        generatedFindings.push({
          citation_instance_id: cit.id,
          contract_id: cit.contract_id,
          contract_name: cit.contract_name,
          raw_citation: cit.raw_citation,
          finding,
        });

        // Store highest exposure for this contract
        const currentExp = contractExposureMap.get(cit.contract_id) || 0;
        const findingExp = finding.financial_exposure || 0;
        if (findingExp > currentExp) {
          contractExposureMap.set(cit.contract_id, findingExp);
        }
      }
    }

    // Total exposure aggregated at contract level to avoid duplicate inflation
    let totalExposure = 0;
    for (const exp of contractExposureMap.values()) {
      totalExposure += exp;
    }

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;

    for (const item of generatedFindings) {
      if (item.finding.severity === 'critical') criticalCount++;
      else if (item.finding.severity === 'high') highCount++;
      else if (item.finding.severity === 'medium') mediumCount++;
      else if (item.finding.severity === 'low') lowCount++;
    }

    // 4. Persist findings and scan audit record in transaction
    const savedFindings: any[] = [];
    const durationMs = Date.now() - startTime;

    await transaction(async (client) => {
      // Create scan audit record
      await client.query(
        `INSERT INTO public.stale_citation_scans (
          id, org_id, triggered_by, trigger_source, citations_scanned,
          findings_count, critical_count, total_exposure, duration_ms, model_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          scanRunId,
          orgId,
          userId || null,
          data.triggerSource,
          scannedCount,
          generatedFindings.length,
          criticalCount,
          totalExposure,
          durationMs,
          'deterministic-temporal-graph-v1',
        ]
      );

      // Persist individual findings
      for (const item of generatedFindings) {
        const findingId = crypto.randomUUID();
        const f = item.finding;

        // Upsert or insert finding
        const res = await client.query(
          `INSERT INTO public.stale_citation_findings (
            id, org_id, citation_instance_id, scan_run_id, severity,
            staleness_type, reason, evidence, confidence, suggested_citation,
            suggested_clause_text, financial_exposure, transition_deadline, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id, status`,
          [
            findingId,
            orgId,
            item.citation_instance_id,
            scanRunId,
            f.severity,
            f.staleness_type,
            f.reason,
            JSON.stringify(f.evidence),
            f.confidence,
            f.suggested_citation || null,
            f.suggested_clause_text || null,
            f.financial_exposure || null,
            f.transition_deadline || null,
            'open',
          ]
        );

        savedFindings.push({
          id: res.rows[0].id,
          citation_instance_id: item.citation_instance_id,
          raw_citation: item.raw_citation,
          contract_id: item.contract_id,
          contract_name: item.contract_name,
          severity: f.severity,
          staleness_type: f.staleness_type,
          reason: f.reason,
          suggested_citation: f.suggested_citation,
          financial_exposure: f.financial_exposure,
          transition_deadline: f.transition_deadline,
          status: res.rows[0].status,
        });
      }
    });

    return {
      scan_run_id: scanRunId,
      trigger_source: data.triggerSource,
      citations_scanned: scannedCount,
      findings_count: savedFindings.length,
      critical_count: criticalCount,
      high_count: highCount,
      medium_count: mediumCount,
      low_count: lowCount,
      total_exposure: totalExposure,
      duration_ms: durationMs,
      findings: savedFindings,
    };
  });
