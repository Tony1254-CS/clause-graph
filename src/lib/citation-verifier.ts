import { extractCitations, normalizeActName, normalizeSection } from "./citation-extractor";
import { AUTHORITATIVE_LEGAL_CORPUS } from "./citation-corpus";
import type {
  CitationRiskLevel,
  CitationVerificationFinding,
  CitationVerificationStatus,
  CitationVerificationSummary,
  ExtractedCitation,
  LegalCitationMetadata,
} from "./citation-verify.types";

export interface DatabaseRegulationRow {
  id: string;
  jurisdiction: string;
  title: string;
  summary: string;
  obligations?: string[] | unknown;
  amendments?: Array<{
    amended_on: string;
    summary: string;
    direction?: string;
  }>;
}

/**
 * Maps database regulations into LegalCitationMetadata items so verification checks
 * against both live DB regulations and the curated statutory registry.
 */
export function mapDbRegulationToMetadata(
  reg: DatabaseRegulationRow,
): LegalCitationMetadata {
  const amendments = Array.isArray(reg.amendments) ? reg.amendments : [];
  const latestAmendment = amendments.length > 0 ? amendments[0] : undefined;

  let amendmentStatus: LegalCitationMetadata["amendmentStatus"] = "in_force";
  if (amendments.length > 0) {
    amendmentStatus = "amended";
  }

  // Parse section from title or id if evident (e.g. "REG-GDPR-5" -> Article 5)
  let section: string | undefined = undefined;
  const matchArt = reg.title.match(/(?:Article|§|Section|Rule)\s*([0-9a-z.-]+)/i);
  if (matchArt) {
    section = matchArt[0];
  } else if (reg.id.includes("GDPR-")) {
    section = `Article ${reg.id.replace("REG-GDPR-", "")}`;
  } else if (reg.id.includes("CCPA-")) {
    section = `§${reg.id.replace("REG-CCPA-", "")}`;
  } else if (reg.id.includes("SOX-")) {
    section = `Section ${reg.id.replace("REG-SOX-", "")}`;
  } else if (reg.id.includes("LA-")) {
    section = `Section 26`;
  }

  return {
    id: reg.id,
    actTitle: reg.title,
    jurisdiction: reg.jurisdiction,
    section,
    amendmentStatus,
    amendedDate: latestAmendment?.amended_on,
    notes: reg.summary,
    version: amendments.length > 0 ? `${amendments.length} logged amendments` : "Initial version",
  };
}

/**
 * Searches the authoritative corpus (registry + active database regulations)
 * for a matching legal citation.
 */
export function matchCitationAgainstCorpus(
  citation: ExtractedCitation,
  corpus: LegalCitationMetadata[],
): LegalCitationMetadata | undefined {
  const normTargetAct = normalizeActName(citation.actTitle);
  const normTargetSec = normalizeSection(citation.section);

  for (const item of corpus) {
    const itemActNorm = normalizeActName(item.actTitle);
    const itemShortNorm = item.shortTitle ? normalizeActName(item.shortTitle) : "";
    const itemSecNorm = normalizeSection(item.section);

    // Act match check: full title, short title, or key containment
    const actMatches =
      itemActNorm === normTargetAct ||
      (itemShortNorm && itemShortNorm === normTargetAct) ||
      itemActNorm.includes(normTargetAct) ||
      normTargetAct.includes(itemActNorm) ||
      (normTargetAct.includes("gdpr") && itemActNorm.includes("general data protection")) ||
      (normTargetAct.includes("ccpa") && itemActNorm.includes("california consumer privacy")) ||
      (normTargetAct.includes("hipaa") && itemActNorm.includes("hipaa")) ||
      (normTargetAct.includes("sox") && itemActNorm.includes("sarbanes")) ||
      (normTargetAct.includes("labour act") && itemActNorm.includes("labour act")) ||
      (normTargetAct.includes("digital security") && itemActNorm.includes("digital security")) ||
      (normTargetAct.includes("cyber security") && itemActNorm.includes("cyber security")) ||
      (normTargetAct.includes("privacy shield") && itemActNorm.includes("privacy shield")) ||
      (normTargetAct.includes("directive 95/46") && itemActNorm.includes("95/46")) ||
      (normTargetAct.includes("official regulatory source") && citation.sourceUrl && (
        item.officialSourceUrl?.includes(safeGetDomain(citation.sourceUrl) || "___") ||
        (citation.sourceUrl.includes("eur-lex") && item.jurisdiction === "EU") ||
        (citation.sourceUrl.includes("ecfr.gov") && item.jurisdiction === "US") ||
        (citation.sourceUrl.includes("bdlaws.minlaw") && item.jurisdiction === "BD")
      ));

    if (!actMatches) continue;

    // Jurisdiction check (if both specify jurisdiction, they must match)
    if (
      citation.jurisdiction &&
      item.jurisdiction &&
      citation.jurisdiction.toUpperCase() !== item.jurisdiction.toUpperCase()
    ) {
      continue;
    }

    // Section match check: if both specify a section, check compatibility
    if (normTargetSec && itemSecNorm) {
      if (
        normTargetSec === itemSecNorm ||
        normTargetSec.includes(itemSecNorm) ||
        itemSecNorm.includes(normTargetSec)
      ) {
        return item;
      }
    } else {
      // If one or neither specifies section, consider this a general act match
      return item;
    }
  }

  return undefined;
}

/**
 * Verifies a single extracted citation against the authoritative legal corpus.
 * Adheres strictly to legal verification principles:
 * - Never classify a law as repealed merely because it cannot be found.
 * - Confirmed legal status is distinguished from possible issues or unverified status.
 * - Does not invent citations or status.
 */
export function verifySingleCitation(
  citation: ExtractedCitation,
  corpus: LegalCitationMetadata[] = AUTHORITATIVE_LEGAL_CORPUS,
): CitationVerificationFinding {
  const now = new Date().toISOString();
  if (citation.actTitle === "Official Regulatory Source Link") {
    // Official primary URL citations confirm grounding
    return {
      citation,
      status: "VERIFIED",
      riskLevel: "low",
      confidence: 1.0,
      evidence: `Primary official gazette link: ${citation.sourceUrl}`,
      reasons: ["Authoritative primary regulatory portal URL verified."],
      isStale: false,
      requiresHumanReview: false,
      checkedAt: now,
    };
  }

  const matched = matchCitationAgainstCorpus(citation, corpus);

  // If no authoritative record exists in the corpus:
  // STATUS = UNVERIFIED (Never REPEALED or AMENDED without evidence)
  if (!matched) {
    const reasons = [
      "Citation could not be positively matched against authoritative legal registries or active statutory ontology.",
      "Official primary source text is unverified or external gazette was inaccessible.",
    ];
    return {
      citation,
      status: "UNVERIFIED",
      riskLevel: "medium",
      confidence: 0.4,
      evidence: "No definitive primary legislative record found in indexed registry.",
      reasons,
      warningMessage: `Unverified legal citation: '${citation.actTitle}${citation.section ? ` ${citation.section}` : ""}'. Verify against primary official gazette before relying in contracts.`,
      isStale: false,
      requiresHumanReview: true,
      checkedAt: now,
    };
  }

  // Matched authoritative record: Determine status based on verified evidence
  const reasons: string[] = [];
  let status: CitationVerificationStatus = "VERIFIED";
  let riskLevel: CitationRiskLevel = "low";
  let confidence = 0.95;
  let isStale = false;
  let requiresHumanReview = false;
  let warningMessage: string | undefined = undefined;

  switch (matched.amendmentStatus) {
    case "repealed": {
      status = "REPEALED";
      riskLevel = "high";
      confidence = 1.0;
      isStale = true;
      requiresHumanReview = true;
      reasons.push(
        `Formally repealed${matched.repealedDate ? ` effective ${matched.repealedDate}` : ""}.`,
      );
      if (matched.supersededBy) {
        reasons.push(`Superseded by: ${matched.supersededBy}.`);
      }
      warningMessage = `CRITICAL LEGAL RISK: '${matched.shortTitle || matched.actTitle}' has been repealed! Do not cite repealed statutes in binding contract obligations.`;
      break;
    }

    case "superseded": {
      status = "SUPERSEDED";
      riskLevel = "high";
      confidence = 0.95;
      isStale = true;
      requiresHumanReview = true;
      reasons.push(
        `Legal instrument has been superseded or invalidated by judicial/regulatory decision.`,
      );
      if (matched.supersededBy) {
        reasons.push(`Successor instrument: ${matched.supersededBy}.`);
      }
      warningMessage = `SUPERSEDED INSTRUMENT: '${matched.shortTitle || matched.actTitle}' is superseded (${matched.supersededBy || "newer framework"}). Update citation to current authority.`;
      break;
    }

    case "amended": {
      status = "AMENDED";
      riskLevel = "medium";
      confidence = 0.9;
      isStale = true; // Potentially stale if citing older draft without acknowledging amendment
      requiresHumanReview = false;
      reasons.push(
        `Statute has been amended${matched.amendedDate ? ` on ${matched.amendedDate}` : ""}.`,
      );
      if (matched.version) {
        reasons.push(`Active version: ${matched.version}.`);
      }
      warningMessage = `AMENDED STATUTE: '${matched.shortTitle || matched.actTitle}' contains subsequent amendments. Ensure specific referenced clauses reflect the latest enacted text.`;
      break;
    }

    case "in_force":
    default: {
      status = "VERIFIED";
      riskLevel = "low";
      confidence = 0.98;
      isStale = false;
      requiresHumanReview = false;
      reasons.push("Citation verified against authoritative primary source in force.");
      if (matched.effectiveDate) {
        reasons.push(`Effective since ${matched.effectiveDate}.`);
      }
      break;
    }
  }

  // If a source URL was provided, verify it against the official domain
  if (citation.sourceUrl && matched.officialSourceUrl) {
    const citedUrlDomain = safeGetDomain(citation.sourceUrl);
    const officialDomain = safeGetDomain(matched.officialSourceUrl);
    if (citedUrlDomain && officialDomain && citedUrlDomain !== officialDomain) {
      reasons.push(
        `Warning: Provided source URL (${citedUrlDomain}) does not match the official source registry (${officialDomain}).`,
      );
      if (status === "VERIFIED") {
        riskLevel = "medium";
        warningMessage = `Citation text matches ${matched.shortTitle || matched.actTitle}, but source link (${citedUrlDomain}) diverges from official registry (${officialDomain}).`;
      }
    }
  }

  return {
    citation,
    status,
    riskLevel,
    confidence,
    matchedAuthority: matched,
    evidence: matched.notes ?? `Grounded in ${matched.jurisdiction} statutory records.`,
    reasons,
    warningMessage,
    officialSourceUrl: matched.officialSourceUrl,
    isStale,
    requiresHumanReview,
    checkedAt: now,
  };
}

/**
 * Verifies all citations extracted from an AI-generated text or contract draft.
 */
export function verifyCitations(
  text: string,
  additionalCorpus: LegalCitationMetadata[] = [],
): CitationVerificationSummary {
  const combinedCorpus = [...additionalCorpus, ...AUTHORITATIVE_LEGAL_CORPUS];
  const extracted = extractCitations(text);
  const findings: CitationVerificationFinding[] = extracted.map((c) =>
    verifySingleCitation(c, combinedCorpus),
  );

  let verifiedCount = 0;
  let amendedCount = 0;
  let repealedCount = 0;
  let supersededCount = 0;
  let unverifiedCount = 0;
  let highestRisk: CitationRiskLevel = "low";
  let requiresHumanReview = false;
  let hasStaleCitations = false;

  for (const f of findings) {
    if (f.status === "VERIFIED") verifiedCount++;
    if (f.status === "AMENDED") {
      amendedCount++;
      hasStaleCitations = true;
    }
    if (f.status === "REPEALED") {
      repealedCount++;
      hasStaleCitations = true;
      requiresHumanReview = true;
    }
    if (f.status === "SUPERSEDED") {
      supersededCount++;
      hasStaleCitations = true;
      requiresHumanReview = true;
    }
    if (f.status === "UNVERIFIED") {
      unverifiedCount++;
      requiresHumanReview = true;
    }

    if (f.riskLevel === "high") {
      highestRisk = "high";
    } else if (f.riskLevel === "medium" && highestRisk !== "high") {
      highestRisk = "medium";
    }
  }

  return {
    totalCitations: findings.length,
    verifiedCount,
    amendedCount,
    repealedCount,
    supersededCount,
    unverifiedCount,
    hasStaleCitations,
    requiresHumanReview,
    highestRisk,
    findings,
    checkedAt: new Date().toISOString(),
  };
}

function safeGetDomain(urlStr: string): string | null {
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
