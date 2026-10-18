// ============================================================================
// Regulation Update Queue Processor: src/lib/stale/queue.functions.ts
// Background/triggered processor consuming regulation changes and re-evaluating citations
// ============================================================================

import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "../auth-middleware";
import { evaluateCitationStaleness, type RegulationTemporalMetadata } from "./detector";

export interface ProcessQueueResult {
  processed_count: number;
  rescanned_regulations: string[];
  findings_generated: number;
  errors: string[];
}

export const processRegulationUpdateQueue = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }): Promise<ProcessQueueResult> => {
    const { orgId, role } = context;
    const { query, queryOne, transaction } = await import("../db.server");

    // Fetch up to 10 unprocessed queue items
    const pendingItems = await query<{
      id: string;
      regulation_id: string;
      change_type: string;
      queued_at: string;
    }>(
      `SELECT id, regulation_id, change_type, queued_at
       FROM public.regulation_update_queue
       WHERE processed = false
       ORDER BY queued_at ASC
       LIMIT 10`
    );

    if (!pendingItems || pendingItems.length === 0) {
      return {
        processed_count: 0,
        rescanned_regulations: [],
        findings_generated: 0,
        errors: [],
      };
    }

    const errors: string[] = [];
    const rescannedRegs: string[] = [];
    let findingsCount = 0;

    for (const item of pendingItems) {
      try {
        const regId = item.regulation_id;
        rescannedRegs.push(regId);

        // Fetch regulation details and versions
        const [regRow, versions] = await Promise.all([
          queryOne<any>(
            `SELECT id, title, jurisdiction, status, effective_from, effective_to,
                    repealed_by, superseded_by, current_version, official_source_url,
                    gazette_reference
             FROM public.regulations WHERE id = $1`,
            [regId]
          ),
          query<any>(
            `SELECT id, regulation_id, version, effective_from, effective_to,
                    amendment_type, summary, diff_from_previous, obligations, official_source_url
             FROM public.regulation_versions
             WHERE regulation_id = $1
             ORDER BY version ASC`,
            [regId]
          ),
        ]);

        if (regRow) {
          const regMeta: RegulationTemporalMetadata = {
            ...regRow,
            versions: versions || [],
          };

          // Find citation instances referencing this regulation for this organization
          const affectedCitations = await query<any>(
            `SELECT ci.id, ci.raw_citation, ci.cited_article, ci.cited_version,
                    ci.cited_year, ci.as_of_date, ci.regulation_id, ci.clause_id,
                    ci.contract_id, c.name as contract_name, c.value as contract_value,
                    cl.text as clause_text
             FROM public.citation_instances ci
             JOIN public.contracts c ON c.id = ci.contract_id
             JOIN public.clauses cl ON cl.id = ci.clause_id
             WHERE ci.regulation_id = $1 AND ci.org_id = $2`,
            [regId, orgId]
          );

          if (affectedCitations && affectedCitations.length > 0) {
            const scanRunId = crypto.randomUUID();

            await transaction(async (client) => {
              for (const cit of affectedCitations) {
                const finding = evaluateCitationStaleness(cit, regMeta, {
                  contractValue: Number(cit.contract_value) || 0,
                });

                if (finding) {
                  findingsCount++;
                  await client.query(
                    `INSERT INTO public.stale_citation_findings (
                      org_id, citation_instance_id, scan_run_id, severity,
                      staleness_type, reason, evidence, confidence, suggested_citation,
                      suggested_clause_text, financial_exposure, transition_deadline, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                    [
                      orgId,
                      cit.id,
                      scanRunId,
                      finding.severity,
                      finding.staleness_type,
                      finding.reason,
                      JSON.stringify(finding.evidence),
                      finding.confidence,
                      finding.suggested_citation || null,
                      finding.suggested_clause_text || null,
                      finding.financial_exposure || null,
                      finding.transition_deadline || null,
                      'open',
                    ]
                  );
                }
              }

              // Audit scan
              await client.query(
                `INSERT INTO public.stale_citation_scans (
                  id, org_id, trigger_source, citations_scanned,
                  findings_count, duration_ms, model_used
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  scanRunId,
                  orgId,
                  'ontology_update',
                  affectedCitations.length,
                  findingsCount,
                  100,
                  'queue-trigger-v1',
                ]
              );
            });
          }
        }

        // Mark item as processed
        await query(
          `UPDATE public.regulation_update_queue
           SET processed = true, processed_at = now()
           WHERE id = $1`,
          [item.id]
        );
      } catch (err: any) {
        errors.push(`Error processing queue item ${item.id}: ${err.message}`);
        await query(
          `UPDATE public.regulation_update_queue
           SET error_message = $1
           WHERE id = $2`,
          [err.message, item.id]
        );
      }
    }

    return {
      processed_count: pendingItems.length,
      rescanned_regulations: rescannedRegs,
      findings_generated: findingsCount,
      errors,
    };
  });
