/**
 * Verification Statuses for Legal Citations.
 *
 * Ground rules:
 * - VERIFIED: Confirmed against authoritative source / versioned legal documents as currently in force and matching.
 * - AMENDED: Known to have been modified or amended by subsequent statutory acts or regulatory amendments.
 * - REPEALED: Formally rescinded, repealed, or sunsetted. NEVER assigned merely due to absence or search failure.
 * - SUPERSEDED: Replaced by a successor instrument, regulation, or standard.
 * - UNVERIFIED: Insufficient evidence, authoritative source unreachable, ambiguous, or no matching authoritative record.
 */
export type CitationVerificationStatus =
  | "VERIFIED"
  | "AMENDED"
  | "REPEALED"
  | "SUPERSEDED"
  | "UNVERIFIED";

export type CitationRiskLevel = "low" | "medium" | "high";

export interface LegalCitationMetadata {
  id: string;
  actTitle: string;
  shortTitle?: string;
  jurisdiction: string; // e.g. "EU", "US", "BD", "UK", "INTERNATIONAL"
  section?: string;
  pinpoint?: string;
  year?: number;
  effectiveDate?: string; // ISO 8601 YYYY-MM-DD
  repealedDate?: string;
  amendedDate?: string;
  amendmentStatus: "in_force" | "amended" | "repealed" | "superseded" | "proposed";
  officialSourceUrl?: string;
  supersededBy?: string;
  notes?: string;
  version?: string;
  lastAuditedAt?: string;
}

export interface ExtractedCitation {
  rawText: string;
  actTitle: string;
  section?: string;
  year?: number;
  jurisdiction?: string;
  sourceUrl?: string;
  normalizedKey: string;
  contextSnippet?: string;
  charStart?: number;
  charEnd?: number;
}

export interface CitationVerificationFinding {
  citation: ExtractedCitation;
  status: CitationVerificationStatus;
  riskLevel: CitationRiskLevel;
  confidence: number; // 0.0 to 1.0
  matchedAuthority?: LegalCitationMetadata;
  evidence: string;
  reasons: string[];
  warningMessage?: string;
  officialSourceUrl?: string;
  isStale: boolean;
  requiresHumanReview: boolean;
  checkedAt: string;
}

export interface CitationVerificationSummary {
  totalCitations: number;
  verifiedCount: number;
  amendedCount: number;
  repealedCount: number;
  supersededCount: number;
  unverifiedCount: number;
  hasStaleCitations: boolean;
  requiresHumanReview: boolean;
  highestRisk: CitationRiskLevel;
  findings: CitationVerificationFinding[];
  checkedAt: string;
}
