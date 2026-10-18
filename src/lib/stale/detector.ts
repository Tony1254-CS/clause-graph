// ============================================================================
// Deterministic Staleness Detector: src/lib/stale/detector.ts
// Temporal legal graph reasoning engine evaluating citations against official
// enactment, amendment, renumbering, and repeal lifecycles.
// ============================================================================

export type StalenessSeverity = 'critical' | 'high' | 'medium' | 'low';
export type StalenessType =
  | 'repealed'
  | 'substantive_amendment'
  | 'renumbered'
  | 'superseded'
  | 'cosmetic';

export interface FindingEvidence {
  official_source_url?: string;
  gazette_reference?: string;
  regulation_status: string;
  effective_from?: string | null;
  effective_to?: string | null;
  cited_version?: number | null;
  current_version?: number;
  superseded_by?: string | null;
  repealed_by?: string | null;
  amendment_summary?: string;
  version_diff?: Record<string, any>;
  unverified_mapping_note?: string;
  evaluation_date: string;
}

export interface StalenessFindingResult {
  severity: StalenessSeverity;
  staleness_type: StalenessType;
  reason: string;
  evidence: FindingEvidence;
  confidence: number;
  suggested_citation?: string;
  suggested_clause_text?: string;
  financial_exposure?: number;
  transition_deadline?: string;
}

export interface CitationWithContext {
  id: string;
  raw_citation: string;
  cited_article?: string | null;
  cited_version?: number | null;
  cited_year?: number | null;
  as_of_date?: string | null;
  contract_value?: number | null;
  contract_name?: string | null;
  clause_text?: string | null;
  regulation_id?: string | null;
}

export interface RegulationTemporalMetadata {
  id: string;
  title: string;
  jurisdiction: string;
  status: 'active' | 'amended' | 'repealed' | 'superseded' | 'lapsed' | 'renumbered';
  effective_from: string | null;
  effective_to: string | null;
  repealed_by: string | null;
  superseded_by: string | null;
  current_version: number;
  official_source_url: string | null;
  gazette_reference: string | null;
  versions?: Array<{
    version: number;
    effective_from: string | null;
    effective_to: string | null;
    amendment_type: string | null;
    summary: string | null;
    diff_from_previous: Record<string, any>;
    obligations: any;
    official_source_url: string | null;
  }>;
}

/**
 * Evaluates whether a legal citation is stale relative to an evaluation date.
 * Distinguishes historical validity from present-day staleness.
 */
export function evaluateCitationStaleness(
  citation: CitationWithContext,
  regulation: RegulationTemporalMetadata | null,
  options: {
    evaluationDate?: string; // ISO date YYYY-MM-DD (defaults to today)
    contractValue?: number;
  } = {}
): StalenessFindingResult | null {
  // If citation is not linked to any regulation in our ontology, do not invent staleness.
  if (!regulation) {
    return null;
  }

  const evalDateStr = options.evaluationDate || new Date().toISOString().split('T')[0];
  const evalDate = new Date(evalDateStr);
  const contractVal = options.contractValue ?? citation.contract_value ?? 0;

  const baseEvidence: FindingEvidence = {
    official_source_url: regulation.official_source_url || undefined,
    gazette_reference: regulation.gazette_reference || undefined,
    regulation_status: regulation.status,
    effective_from: regulation.effective_from,
    effective_to: regulation.effective_to,
    cited_version: citation.cited_version,
    current_version: regulation.current_version,
    superseded_by: regulation.superseded_by,
    repealed_by: regulation.repealed_by,
    evaluation_date: evalDateStr,
  };

  // ── 1. Check Repeal Status ──────────────────────────────────────────────────
  const repealDate = regulation.effective_to ? new Date(regulation.effective_to) : null;
  const isRepealedNow = regulation.status === 'repealed' || (repealDate !== null && evalDate >= repealDate);

  if (isRepealedNow) {
    // Check if citation was made BEFORE repeal and we are doing historical evaluation
    if (citation.as_of_date) {
      const citedAsOf = new Date(citation.as_of_date);
      if (repealDate && citedAsOf < repealDate && evalDate < repealDate) {
        // Historically valid when evaluated within its active lifecycle
        return null;
      }
    }

    const latestVersion = regulation.versions?.[regulation.versions.length - 1];
    const diff = latestVersion?.diff_from_previous || {};
    const unverifiedMapping = diff.unverified_mapping;

    let suggested = regulation.repealed_by ? `Applicable successor act (${regulation.repealed_by})` : undefined;
    if (regulation.id === 'BD-DSA') {
      suggested = citation.cited_article === '57'
        ? 'Cyber Security Act 2023 Section 28 (recoded provisions; requires legal verification)'
        : 'Cyber Security Act 2023 (Act No. 37 of 2023)';
    }

    // Financial exposure proxy: 100% of contract value at risk due to repealed statutory reliance
    const exposure = contractVal > 0 ? contractVal : undefined;

    return {
      severity: 'critical',
      staleness_type: 'repealed',
      reason: `Citation references '${regulation.title}' which was officially repealed${
        regulation.effective_to ? ` on ${regulation.effective_to}` : ''
      }${regulation.repealed_by ? ` and superseded by ${regulation.repealed_by}` : ''}. Continued reliance creates unenforceability risk.`,
      evidence: {
        ...baseEvidence,
        version_diff: diff,
        unverified_mapping_note: unverifiedMapping?.note,
      },
      confidence: 0.98,
      suggested_citation: suggested,
      suggested_clause_text: suggested
        ? `Each party shall comply with applicable provisions of the ${suggested} and relevant regulatory guidance.`
        : undefined,
      financial_exposure: exposure,
      transition_deadline: regulation.effective_to || undefined,
    };
  }

  // ── 2. Check Superseded Status ──────────────────────────────────────────────
  if (regulation.status === 'superseded') {
    const exposure = contractVal > 0 ? Number((contractVal * 0.75).toFixed(2)) : undefined;
    const replacement = regulation.superseded_by || 'Updated statutory regime';
    return {
      severity: 'critical',
      staleness_type: 'superseded',
      reason: `Regulation '${regulation.title}' has been superseded by '${replacement}'.`,
      evidence: baseEvidence,
      confidence: 0.95,
      suggested_citation: replacement,
      financial_exposure: exposure,
    };
  }

  // ── 3. Check Substantive vs Cosmetic Amendment ─────────────────────────────
  if (regulation.status === 'amended') {
    const versions = regulation.versions || [];
    // Sort versions ascending
    const sorted = [...versions].sort((a, b) => a.version - b.version);
    const latest = sorted[sorted.length - 1];

    if (latest && latest.version > (citation.cited_version || 1)) {
      const isSubstantive = latest.amendment_type === 'substantive';
      const isCosmetic = latest.amendment_type === 'cosmetic';
      const diff = latest.diff_from_previous || {};

      if (isSubstantive) {
        // High severity: substantive statutory modification (e.g., GDPR modern SCCs)
        const exposure = contractVal > 0 ? Number((contractVal * 0.50).toFixed(2)) : undefined;
        const transitionGraceEnd = diff.transition_grace_period_end;

        return {
          severity: 'high',
          staleness_type: 'substantive_amendment',
          reason: `Regulation '${regulation.title}' underwent substantive amendment in Version ${latest.version}${
            latest.effective_from ? ` (effective ${latest.effective_from})` : ''
          }. Obligations have changed materially: ${latest.summary || 'Prior compliance mechanisms superseded.'}`,
          evidence: {
            ...baseEvidence,
            cited_version: citation.cited_version || 1,
            current_version: latest.version,
            amendment_summary: latest.summary || undefined,
            version_diff: diff,
          },
          confidence: 0.92,
          suggested_citation: `${regulation.title} (revised per ${latest.summary?.slice(0, 60) || 'latest version'})`,
          suggested_clause_text: citation.clause_text
            ? `Parties agree to comply with updated obligations under ${regulation.title} Version ${latest.version}.`
            : undefined,
          financial_exposure: exposure,
          transition_deadline: transitionGraceEnd || undefined,
        };
      } else if (isCosmetic) {
        // Medium / Low severity: cosmetic clarification
        const exposure = contractVal > 0 ? Number((contractVal * 0.15).toFixed(2)) : undefined;
        return {
          severity: 'medium',
          staleness_type: 'cosmetic',
          reason: `Regulation '${regulation.title}' had a procedural/cosmetic amendment (Version ${latest.version}). Core compliance intact but procedural filing schedules updated.`,
          evidence: {
            ...baseEvidence,
            cited_version: citation.cited_version || 1,
            current_version: latest.version,
            amendment_summary: latest.summary || undefined,
            version_diff: diff,
          },
          confidence: 0.88,
          suggested_citation: `${regulation.title} (v${latest.version})`,
          financial_exposure: exposure,
        };
      }
    }
  }

  // ── 4. Check Renumbered Provisions ──────────────────────────────────────────
  const versionsList = regulation.versions || [];
  const latestVer = versionsList.length > 0 ? versionsList[versionsList.length - 1] : null;
  const renumberedMap = (latestVer?.diff_from_previous?.renumbered_sections || {}) as Record<string, string>;
  const renumberedNewSec = citation.cited_article ? renumberedMap[citation.cited_article] : undefined;

  if (regulation.status === 'renumbered' || latestVer?.amendment_type === 'renumbering' || renumberedNewSec) {
    const exposure = contractVal > 0 ? Number((contractVal * 0.25).toFixed(2)) : undefined;
    const suggestedSec = renumberedNewSec ? `Section ${renumberedNewSec}` : undefined;
    return {
      severity: 'medium',
      staleness_type: 'renumbered',
      reason: renumberedNewSec
        ? `Section ${citation.cited_article} of '${regulation.title}' has been formally renumbered to Section ${renumberedNewSec}.`
        : `Provision identifiers in '${regulation.title}' have been formally renumbered.`,
      evidence: {
        ...baseEvidence,
        version_diff: latestVer?.diff_from_previous || {},
      },
      confidence: 0.90,
      suggested_citation: suggestedSec ? `${regulation.title} ${suggestedSec}` : regulation.title,
      financial_exposure: exposure,
    };
  }

  // ── 5. Regulation is Active and Current ──────────────────────────────────────
  if (regulation.status === 'active') {
    return null;
  }

  return null;
}
