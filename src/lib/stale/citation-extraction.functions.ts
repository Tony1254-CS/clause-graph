// ============================================================================
// Citation Extraction Server Function: src/lib/stale/citation-extraction.functions.ts
// Secure, tenant-isolated extraction combining regex + LLM with ontology resolution
// ============================================================================

import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "../auth-middleware";
import { runRegexExtractor, type RegexCitationHit } from "./citation-regex";
import {
  buildCitationExtractionPrompt,
  CITATION_EXTRACTION_SYSTEM_PROMPT,
  CitationExtractionResponseSchema,
  type ExtractedCitation,
} from "./prompts";

export interface ResolvedCitation {
  raw_citation: string;
  cited_article?: string;
  cited_version?: number;
  cited_year?: number;
  extraction_method: 'regex' | 'ner' | 'llm' | 'hybrid';
  extraction_confidence: number;
  regulation_id: string | null;
  regulation_title?: string;
  is_resolved: boolean;
  resolution_notes?: string;
}

export interface ExtractCitationsResult {
  clause_id: string;
  contract_id: string;
  total_extracted: number;
  resolved_count: number;
  unresolved_count: number;
  citations: ResolvedCitation[];
  saved_instances_count: number;
}

interface RegulationOntologyRecord {
  id: string;
  title: string;
  jurisdiction: string;
  status: string;
  effective_from: string | null;
  effective_to: string | null;
  current_version: number;
}

/**
 * Deterministically resolves an extracted citation candidate against the curated legal ontology.
 * Prevents fuzzy name-only matching to avoid false positives.
 */
export function resolveCitationAgainstOntology(
  candidate: {
    raw_text: string;
    law_name?: string;
    article?: string;
    year?: number;
    acronym?: string;
  },
  regulations: RegulationOntologyRecord[]
): {
  regulation_id: string | null;
  regulation_title?: string;
  is_resolved: boolean;
  resolution_notes?: string;
} {
  const normRaw = candidate.raw_text.toLowerCase();
  const lawName = (candidate.law_name || '').toLowerCase();
  const acronym = (candidate.acronym || '').toUpperCase();
  const year = candidate.year;

  // 1. Exact match by statutory ID prefix or known abbreviation
  if (
    acronym === 'DSA' ||
    normRaw.includes('digital security act') ||
    normRaw.includes('ডিজিটাল নিরাপত্তা') ||
    normRaw.includes('ডিজিটাল সিকিউরিটি')
  ) {
    if (year === 2018 || !year || normRaw.includes('2018') || normRaw.includes('২০১৮')) {
      const match = regulations.find((r) => r.id === 'BD-DSA' || r.id === 'REG-BD-DSA-2018');
      if (match) {
        return {
          regulation_id: match.id,
          regulation_title: match.title,
          is_resolved: true,
          resolution_notes: 'Matched to Bangladesh Digital Security Act 2018',
        };
      }
    }
  }

  if (
    acronym === 'CSA' ||
    normRaw.includes('cyber security act') ||
    normRaw.includes('সাইবার নিরাপত্তা')
  ) {
    if (year === 2023 || !year || normRaw.includes('2023') || normRaw.includes('২০২৩')) {
      const match = regulations.find((r) => r.id === 'BD-CSA');
      if (match) {
        return {
          regulation_id: match.id,
          regulation_title: match.title,
          is_resolved: true,
          resolution_notes: 'Matched to Bangladesh Cyber Security Act 2023',
        };
      }
    }
  }

  if (
    acronym === 'BTRC' ||
    normRaw.includes('btrc directive') ||
    normRaw.includes('telecommunication data localization')
  ) {
    const match = regulations.find((r) => r.id === 'BD-BTRC-LOC');
    if (match) {
      return {
        regulation_id: match.id,
        regulation_title: match.title,
        is_resolved: true,
        resolution_notes: 'Matched to BTRC Telecommunication Directive',
      };
    }
  }

  if (acronym === 'GDPR' || normRaw.includes('gdpr') || normRaw.includes('general data protection regulation')) {
    const article = candidate.article;
    if (article === '44') {
      const match = regulations.find((r) => r.id === 'REG-GDPR-44');
      if (match) {
        return {
          regulation_id: match.id,
          regulation_title: match.title,
          is_resolved: true,
          resolution_notes: 'Matched to GDPR Article 44 International Transfers',
        };
      }
    } else if (article === '33') {
      const match = regulations.find((r) => r.id === 'REG-GDPR-33');
      if (match) {
        return {
          regulation_id: match.id,
          regulation_title: match.title,
          is_resolved: true,
          resolution_notes: 'Matched to GDPR Article 33 Breach Notification',
        };
      }
    } else if (article === '5') {
      const match = regulations.find((r) => r.id === 'REG-GDPR-5');
      if (match) {
        return {
          regulation_id: match.id,
          regulation_title: match.title,
          is_resolved: true,
          resolution_notes: 'Matched to GDPR Article 5 Data Minimization',
        };
      }
    }
  }

  // 2. Strict matching against ontology regulations
  const potentialMatches = regulations.filter((reg) => {
    const titleLower = reg.title.toLowerCase();
    if (lawName && lawName.length > 5 && titleLower.includes(lawName)) return true;
    if (candidate.raw_text.length > 8 && titleLower.includes(candidate.raw_text.toLowerCase())) return true;
    return false;
  });

  if (potentialMatches.length === 1) {
    const reg = potentialMatches[0];
    return {
      regulation_id: reg.id,
      regulation_title: reg.title,
      is_resolved: true,
      resolution_notes: `Matched via ontology catalog: ${reg.title}`,
    };
  } else if (potentialMatches.length > 1) {
    return {
      regulation_id: null,
      is_resolved: false,
      resolution_notes: `Ambiguous match: multiple regulations match '${candidate.law_name || candidate.raw_text}' (${potentialMatches.map((m) => m.id).join(', ')}). Retaining unresolved state.`,
    };
  }

  return {
    regulation_id: null,
    is_resolved: false,
    resolution_notes: 'Citation not present in ontology catalog. Retaining unresolved state without guessing.',
  };
}

export const extractCitations = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { clauseId: string }) => {
    const clauseId = String(input?.clauseId ?? "").trim();
    if (!clauseId) throw new Error("clauseId is required");
    return { clauseId };
  })
  .handler(async ({ data, context }): Promise<ExtractCitationsResult> => {
    const { orgId } = context;
    const { query, queryOne, transaction } = await import("../db.server");
    const { chatCompletion } = await import("../ai.server");

    // 1. Verify clause ownership and load clause & parent contract
    const clause = await queryOne<{
      id: string;
      contract_id: string;
      text: string;
      org_id: string;
    }>(
      `SELECT cl.id, cl.contract_id, cl.text, c.org_id
       FROM public.clauses cl
       JOIN public.contracts c ON c.id = cl.contract_id
       WHERE cl.id = $1 AND c.org_id = $2`,
      [data.clauseId, orgId]
    );

    if (!clause) {
      throw new Error(`Clause not found or access denied for ID: ${data.clauseId}`);
    }

    // 2. Run regex pre-filter extraction
    const regexHits: RegexCitationHit[] = runRegexExtractor(clause.text);

    // 3. Optional LLM-assisted extraction for complex clauses
    let extractedCandidates: ExtractedCitation[] = regexHits.map((r) => ({
      raw_text: r.raw_citation,
      law_name: r.law_name,
      article: r.article,
      year: r.year,
      acronym: r.acronym,
      confidence: r.confidence,
    }));

    try {
      const prompt = buildCitationExtractionPrompt(clause.text, regexHits);
      const llmResult = await chatCompletion({
        messages: [
          { role: 'system', content: CITATION_EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      if (llmResult) {
        // Strip markdown code fences if present
        const cleanedJson = llmResult.replace(/```(?:json)?/g, '').trim();
        const parsed = JSON.parse(cleanedJson);
        const validated = CitationExtractionResponseSchema.safeParse(parsed);
        if (validated.success && validated.data.citations.length > 0) {
          // Merge LLM candidates with regex hits, preferring LLM structured fields when confidence is high
          const merged: ExtractedCitation[] = [...validated.data.citations];
          for (const regHit of regexHits) {
            const exists = merged.some(
              (m) =>
                m.raw_text.toLowerCase().includes(regHit.raw_citation.toLowerCase()) ||
                regHit.raw_citation.toLowerCase().includes(m.raw_text.toLowerCase())
            );
            if (!exists) {
              merged.push({
                raw_text: regHit.raw_citation,
                law_name: regHit.law_name,
                article: regHit.article,
                year: regHit.year,
                acronym: regHit.acronym,
                confidence: regHit.confidence,
              });
            }
          }
          extractedCandidates = merged;
        }
      }
    } catch (llmError) {
      // Graceful fallback to regex hits if LLM is unavailable or unparseable
      console.warn("[Citation Extraction] LLM extraction fallback to regex:", llmError);
    }

    // 4. Fetch regulations catalog for resolution
    const regulations = await query<RegulationOntologyRecord>(
      `SELECT id, title, jurisdiction, status, effective_from, effective_to, current_version 
       FROM public.regulations`
    );

    // 5. Resolve citations against ontology
    const resolvedList: ResolvedCitation[] = extractedCandidates.map((candidate) => {
      const resolution = resolveCitationAgainstOntology(candidate, regulations);
      const isHybrid = regexHits.some((r) => r.raw_citation === candidate.raw_text) && candidate.confidence > 0.8;
      return {
        raw_citation: candidate.raw_text,
        cited_article: candidate.article,
        cited_version: undefined,
        cited_year: candidate.year,
        extraction_method: isHybrid ? 'hybrid' : candidate.confidence === 0.9 ? 'regex' : 'llm',
        extraction_confidence: candidate.confidence,
        regulation_id: resolution.regulation_id,
        regulation_title: resolution.regulation_title,
        is_resolved: resolution.is_resolved,
        resolution_notes: resolution.resolution_notes,
      };
    });

    // 6. Persist citation instances idempotently inside a transaction
    let savedCount = 0;
    await transaction(async (client) => {
      for (const cit of resolvedList) {
        // Prevent duplicate citation instances for same clause & citation text
        const existing = await client.query(
          `SELECT id FROM public.citation_instances
           WHERE clause_id = $1 AND raw_citation = $2 AND org_id = $3
           LIMIT 1`,
          [clause.id, cit.raw_citation, orgId]
        );

        if (existing.rows.length === 0) {
          await client.query(
            `INSERT INTO public.citation_instances (
              org_id, clause_id, contract_id, regulation_id,
              raw_citation, cited_article, cited_version, cited_year,
              extraction_confidence, extraction_method
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              orgId,
              clause.id,
              clause.contract_id,
              cit.regulation_id,
              cit.raw_citation,
              cit.cited_article || null,
              cit.cited_version || null,
              cit.cited_year || null,
              cit.extraction_confidence,
              cit.extraction_method,
            ]
          );
          savedCount++;
        }
      }
    });

    const resolvedCount = resolvedList.filter((c) => c.is_resolved).length;
    return {
      clause_id: clause.id,
      contract_id: clause.contract_id,
      total_extracted: resolvedList.length,
      resolved_count: resolvedCount,
      unresolved_count: resolvedList.length - resolvedCount,
      citations: resolvedList,
      saved_instances_count: savedCount,
    };
  });
