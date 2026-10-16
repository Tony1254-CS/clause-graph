// src/lib/impact/candidates.server.ts
// Deterministic candidate retrieval for clause-obligation matching (Phase 3 T3.1)

export interface ClauseCandidateInput {
  id: string;
  contract_id: string;
  contract_name: string;
  text: string;
  linked_regs: string[];
}

export interface ObligationCandidateInput {
  id: string;
  instrument_id: string;
  tag: string;
  statement: string;
  quote: string;
}

export interface CandidatePair {
  clause_id: string;
  contract_id: string;
  contract_name: string;
  clause_text: string;
  obligation_id: string;
  instrument_id: string;
  tag: string;
  statement: string;
  rule_quote: string;
  score: number;
  match_reason: string[];
}

// Canonical citation patterns for tracked statutes & instruments
const CITATION_PATTERNS: Record<string, RegExp[]> = {
  "eu-gdpr": [
    /\bgdpr\b/i,
    /general\s+data\s+protection\s+regulation/i,
    /regulation\s+\(eu\)\s+2016\/679/i,
    /\barticle\s+33\b/i,
    /\barticle\s+44\b/i,
    /\barticle\s+5\b/i,
  ],
  "us-ccpa": [
    /\bccpa\b/i,
    /\bcpra\b/i,
    /california\s+consumer\s+privacy/i,
    /cal\.\s+civ\.\s+code\s+§?\s*1798/i,
    /1798\.120/i,
  ],
  "us-hipaa-security-rule": [
    /\bhipaa\b/i,
    /health\s+insurance\s+portability/i,
    /45\s+cfr\s+(?:part\s+)?164/i,
    /164\.(?:306|308|310|312)/i,
    /\bephi\b/i,
  ],
  "us-sec-rule-17a-4": [
    /rule\s+17a-4/i,
    /17\s+cfr\s+§?\s*240\.17a-4/i,
    /exchange\s+act/i,
    /\bworm\b/i,
  ],
  "us-sox-act-2002": [
    /\bsox\b/i,
    /sarbanes-oxley/i,
    /section\s+302/i,
    /internal\s+control\s+over\s+financial\s+reporting/i,
  ],
  "bd-digital-security-act-2018": [
    /digital\s+security\s+act/i,
    /\bdsa\s*2018\b/i,
    /act\s+(?:no\.\s*)?46\s+of\s+2018/i,
    /section\s+26/i,
  ],
  "bd-cyber-security-act-2023": [
    /cyber\s+security\s+act/i,
    /\bcsa\s*2023\b/i,
    /act\s+(?:no\.\s*)?40\s+of\s+2023/i,
  ],
  "bd-cyber-security-ordinance-2025": [
    /cyber\s+security\s+ordinance/i,
    /\bcso\s*2025\b/i,
    /ordinance\s+(?:no\.\s*)?25\s+of\s+2025/i,
  ],
  "bd-labour-act-2006": [
    /labou?r\s+act/i,
    /bangladesh\s+labou?r/i,
    /act\s+(?:no\.\s*)?42\s+of\s+2006/i,
    /120\s+days?\s+notice/i,
  ],
  "bd-bangladesh-bank-dps-2023": [
    /bangladesh\s+bank/i,
    /payment\s+systems?\s+department/i,
    /\bpsd\s+circular\b/i,
    /2fa|two-factor/i,
  ],
  "eu-ai-act": [
    /ai\s+act/i,
    /artificial\s+intelligence\s+act/i,
    /regulation\s+\(eu\)\s+2024\/1689/i,
  ],
};

// Keyword tokens per tag for lexical overlap
const TAG_KEYWORDS: Record<string, string[]> = {
  "72h_breach_notification": ["72 hours", "breach", "notify", "notification", "incident"],
  data_minimization: ["minimization", "adequate", "relevant", "limited to necessary"],
  adequacy_or_safeguards: ["transfer", "third country", "scc", "safeguard", "standard contractual"],
  opt_out_link: ["opt-out", "opt out", "do not sell", "share", "sale of personal"],
  encryption_in_transit_and_at_rest: [
    "encrypt",
    "encryption",
    "tls",
    "at rest",
    "safeguard",
    "phi",
    "ephi",
  ],
  immutable_retention: ["retention", "preserve", "worm", "audit trail", "6 years", "records"],
  officer_certification: [
    "certify",
    "certification",
    "officer",
    "disclosure controls",
    "internal control",
  ],
  identity_info_safeguards: ["identity", "safeguards", "unauthorized use", "personal data"],
  written_notice_period: ["notice", "termination", "120 days", "wages in lieu"],
  strong_customer_authentication: ["authentication", "2fa", "two-factor", "tokenization", "card"],
};

const LEGACY_REG_TAG_MAP: Record<string, { tag: string; instrument_id: string }> = {
  "REG-GDPR-5": { tag: "data_minimization", instrument_id: "eu-gdpr" },
  "REG-GDPR-33": { tag: "72h_breach_notification", instrument_id: "eu-gdpr" },
  "REG-GDPR-44": { tag: "adequacy_or_safeguards", instrument_id: "eu-gdpr" },
  "REG-SEC-17A4": { tag: "immutable_retention", instrument_id: "us-sec-rule-17a-4" },
  "REG-CCPA-1798.120": { tag: "opt_out_link", instrument_id: "us-ccpa" },
  "REG-HIPAA-SEC": {
    tag: "encryption_in_transit_and_at_rest",
    instrument_id: "us-hipaa-security-rule",
  },
  "REG-SOX-302": { tag: "officer_certification", instrument_id: "us-sox-act-2002" },
  "REG-BB-DPS-2023": {
    tag: "strong_customer_authentication",
    instrument_id: "bd-bangladesh-bank-dps-2023",
  },
  "REG-BD-DSA-2018": {
    tag: "identity_info_safeguards",
    instrument_id: "bd-digital-security-act-2018",
  },
  "REG-BD-LA-2006": { tag: "written_notice_period", instrument_id: "bd-labour-act-2006" },
};

/**
 * Retrieves candidate (clause, obligation) pairs deterministically
 * by combining:
 * 1. Explicit clause linked_regs tag matches
 * 2. Regulatory statute citation regex detection
 * 3. Lexical keyword scoring
 */
export function getCandidatePairs(
  clauses: ClauseCandidateInput[],
  obligations: ObligationCandidateInput[],
  options?: { minScore?: number; topKPerObligation?: number },
): CandidatePair[] {
  const minScore = options?.minScore ?? 0.2;
  const topK = options?.topKPerObligation ?? 10;

  const results: CandidatePair[] = [];

  for (const obligation of obligations) {
    const obligationCandidates: CandidatePair[] = [];

    const patterns = CITATION_PATTERNS[obligation.instrument_id] ?? [];
    const keywords = TAG_KEYWORDS[obligation.tag] ?? [];

    for (const clause of clauses) {
      const matchReasons: string[] = [];
      let score = 0;

      // 1. Tag match (explicit tag on clause or legacy reg ID)
      let hasTag =
        clause.linked_regs.includes(obligation.tag) ||
        clause.linked_regs.includes(obligation.instrument_id);

      if (!hasTag) {
        for (const lr of clause.linked_regs) {
          const mapped = LEGACY_REG_TAG_MAP[lr];
          if (
            mapped &&
            (mapped.tag === obligation.tag || mapped.instrument_id === obligation.instrument_id)
          ) {
            hasTag = true;
            break;
          }
        }
      }

      if (hasTag) {
        score += 0.5;
        matchReasons.push(`linked_tag:${obligation.tag}`);
      }

      // 2. Statute citation regex in clause text
      for (const pattern of patterns) {
        if (pattern.test(clause.text)) {
          score += 0.4;
          matchReasons.push(`citation:${obligation.instrument_id}`);
          break;
        }
      }

      // 3. Lexical keyword overlap
      const lowerClause = clause.text.toLowerCase();
      let kwHits = 0;
      for (const kw of keywords) {
        if (lowerClause.includes(kw.toLowerCase())) {
          kwHits++;
        }
      }
      if (kwHits > 0) {
        const kwScore = Math.min(0.3, kwHits * 0.1);
        score += kwScore;
        matchReasons.push(`keywords:${kwHits}_hits`);
      }

      // If score meets threshold, include candidate
      if (score >= minScore) {
        obligationCandidates.push({
          clause_id: clause.id,
          contract_id: clause.contract_id,
          contract_name: clause.contract_name,
          clause_text: clause.text,
          obligation_id: obligation.id,
          instrument_id: obligation.instrument_id,
          tag: obligation.tag,
          statement: obligation.statement,
          rule_quote: obligation.quote,
          score: Math.min(1.0, Number(score.toFixed(2))),
          match_reason: matchReasons,
        });
      }
    }

    // Sort descending by score and pick top-k per obligation
    obligationCandidates.sort((a, b) => b.score - a.score);
    results.push(...obligationCandidates.slice(0, topK));
  }

  return results;
}
