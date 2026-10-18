import test from "node:test";
import assert from "node:assert/strict";

import { extractCitations, normalizeActName, normalizeSection } from "../lib/citation-extractor.js";
import {
  verifySingleCitation,
  verifyCitations,
  matchCitationAgainstCorpus,
} from "../lib/citation-verifier.js";
import { AUTHORITATIVE_LEGAL_CORPUS } from "../lib/citation-corpus.js";
import type { LegalCitationMetadata } from "../lib/citation-verify.types.js";

test("Citation Extractor: extracts standard legal citations and official sources", () => {
  const sampleText = `
    The contract must comply with GDPR Article 5 regarding data minimization,
    as well as GDPR Article 33 breach notification rules.
    Additionally, under California Consumer Privacy Act Section 1798.120 and SEC Rule 17a-4,
    record retention policies must be observed. Refer to https://eur-lex.europa.eu/eli/reg/2016/679/oj.
  `;

  const citations = extractCitations(sampleText);
  assert.ok(citations.length >= 4, `Expected at least 4 citations, got ${citations.length}`);

  const gdprArt5 = citations.find((c) => c.section === "Article 5");
  assert.ok(gdprArt5, "Should extract GDPR Article 5");
  assert.equal(gdprArt5?.jurisdiction, "EU");

  const ccpa = citations.find((c) => c.actTitle.includes("California Consumer Privacy Act"));
  assert.ok(ccpa, "Should extract CCPA");
  assert.equal(ccpa?.section, "§1798.120");

  const sec = citations.find((c) => c.actTitle.includes("SEC Rules"));
  assert.ok(sec, "Should extract SEC Rule 17a-4");
  assert.equal(sec?.section, "Rule 17a-4");
});

test("Citation Verification: VERIFIED status for active primary source", () => {
  const citations = extractCitations("Under GDPR Article 5, data must be minimized.");
  assert.ok(citations.length > 0);

  const finding = verifySingleCitation(citations[0], AUTHORITATIVE_LEGAL_CORPUS);
  // GDPR Article 5 is recorded with its tightened EDPB amendment guidance, or general GDPR in force
  assert.ok(["VERIFIED", "AMENDED"].includes(finding.status));
  assert.equal(finding.matchedAuthority?.jurisdiction, "EU");
  assert.ok(finding.confidence >= 0.85);
});

test("Citation Verification: AMENDED status for modified statute with active version tracking", () => {
  const citations = extractCitations(
    "Subject to broker-dealer record retention under SEC Rule 17a-4."
  );
  assert.ok(citations.length > 0);

  const finding = verifySingleCitation(citations[0], AUTHORITATIVE_LEGAL_CORPUS);
  assert.equal(finding.status, "AMENDED");
  assert.equal(finding.isStale, true);
  assert.equal(finding.riskLevel, "medium");
  assert.ok(finding.matchedAuthority?.amendedDate?.includes("2022"));
  assert.ok(finding.warningMessage?.includes("AMENDED STATUTE"));
});

test("Citation Verification: REPEALED status for formally rescinded acts (Directive 95/46/EC and DSA 2018)", () => {
  // Test EU Directive 95/46/EC
  const euDirectiveCitations = extractCitations(
    "All processing governed by Directive 95/46/EC on personal data."
  );
  assert.ok(euDirectiveCitations.length > 0);
  const findingDirective = verifySingleCitation(euDirectiveCitations[0], AUTHORITATIVE_LEGAL_CORPUS);
  assert.equal(findingDirective.status, "REPEALED");
  assert.equal(findingDirective.riskLevel, "high");
  assert.equal(findingDirective.requiresHumanReview, true);
  assert.ok(findingDirective.warningMessage?.includes("CRITICAL LEGAL RISK"));
  assert.ok(findingDirective.matchedAuthority?.supersededBy?.includes("GDPR"));

  // Test Bangladesh Digital Security Act 2018
  const bdDsaCitations = extractCitations(
    "Offenses charged under Digital Security Act 2018 §26."
  );
  assert.ok(bdDsaCitations.length > 0);
  const findingDsa = verifySingleCitation(bdDsaCitations[0], AUTHORITATIVE_LEGAL_CORPUS);
  assert.equal(findingDsa.status, "REPEALED");
  assert.equal(findingDsa.riskLevel, "high");
  assert.ok(findingDsa.matchedAuthority?.supersededBy?.includes("Cyber Security Act 2023"));
});

test("Citation Verification: SUPERSEDED status for invalidated frameworks (EU-US Privacy Shield)", () => {
  const citations = extractCitations(
    "Cross-border data transfer self-certified under the EU-US Privacy Shield."
  );
  assert.ok(citations.length > 0);
  const finding = verifySingleCitation(citations[0], AUTHORITATIVE_LEGAL_CORPUS);
  assert.equal(finding.status, "SUPERSEDED");
  assert.equal(finding.riskLevel, "high");
  assert.equal(finding.requiresHumanReview, true);
  assert.ok(finding.warningMessage?.includes("SUPERSEDED INSTRUMENT"));
  assert.ok(finding.matchedAuthority?.supersededBy?.includes("Data Privacy Framework"));
});

test("Citation Verification: UNVERIFIED status for unverified or unknown references", () => {
  // Never classify a law as repealed merely because it cannot be found
  const unknownCitation = {
    rawText: "Atlantis Oceanic Commerce Act of 2099 § 42",
    actTitle: "Atlantis Oceanic Commerce Act",
    section: "Section 42",
    year: 2099,
    normalizedKey: "atlantis::42::2099",
  };

  const finding = verifySingleCitation(unknownCitation, AUTHORITATIVE_LEGAL_CORPUS);
  assert.equal(finding.status, "UNVERIFIED");
  assert.notEqual(finding.status, "REPEALED", "Unknown statutes MUST NOT be marked repealed!");
  assert.notEqual(finding.status, "SUPERSEDED", "Unknown statutes MUST NOT be marked superseded!");
  assert.equal(finding.requiresHumanReview, true);
  assert.ok(finding.confidence <= 0.5);
  assert.ok(finding.reasons.some((r) => r.includes("could not be positively matched")));
});

test("Citation Verification: Handles malformed citations, empty text, and missing metadata gracefully", () => {
  const emptySummary = verifyCitations("");
  assert.equal(emptySummary.totalCitations, 0);
  assert.equal(emptySummary.hasStaleCitations, false);

  const whitespaceSummary = verifyCitations("   \n\t  ");
  assert.equal(whitespaceSummary.totalCitations, 0);

  // Text with punctuation and malformed citation fragment
  const malformedSummary = verifyCitations("Refer to Section § 9999 without act name or year.");
  assert.equal(typeof malformedSummary.totalCitations, "number");
  assert.equal(typeof malformedSummary.requiresHumanReview, "boolean");
});

test("Citation Verification: Detects source URL discrepancies against official registries", () => {
  const citationWithFakeUrl = {
    rawText: "GDPR Article 33",
    actTitle: "General Data Protection Regulation (GDPR)",
    section: "Article 33",
    jurisdiction: "EU",
    year: 2016,
    sourceUrl: "https://suspicious-unverified-site.biz/gdpr",
    normalizedKey: "gdpr::article33::2016",
  };

  const finding = verifySingleCitation(citationWithFakeUrl, AUTHORITATIVE_LEGAL_CORPUS);
  assert.ok(
    finding.reasons.some((r) => r.includes("does not match the official source registry")),
    "Should flag source URL divergence"
  );
});

test("Citation Verification: Aggregates summary counts and flags stale citations accurately", () => {
  const complexResponse = `
    This contract incorporates obligations from Directive 95/46/EC and EU-US Privacy Shield.
    Furthermore, parties shall adhere to GDPR Article 5 and BLA 2006 Section 26.
    Also consider fictitious Martian Mining Act 2045 § 10.
  `;

  const summary = verifyCitations(complexResponse);
  assert.ok(summary.totalCitations >= 4);
  assert.ok(summary.repealedCount >= 1, "Should detect at least 1 repealed statute");
  assert.ok(summary.supersededCount >= 1, "Should detect at least 1 superseded instrument");
  assert.ok(summary.unverifiedCount >= 1, "Should detect at least 1 unverified citation");
  assert.equal(summary.hasStaleCitations, true);
  assert.equal(summary.requiresHumanReview, true);
  assert.equal(summary.highestRisk, "high");
});
