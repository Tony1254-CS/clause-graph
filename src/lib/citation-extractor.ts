import type { ExtractedCitation } from "./citation-verify.types";

/**
 * Normalizes citation string tokens for deterministic lookup
 */
export function normalizeActName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[—–-]/g, " ")
    .replace(/[^a-z0-9\s§]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes section / article identifiers (e.g., "Art. 5", "Article 5(1)", "§ 17a-4", "Section 26")
 */
export function normalizeSection(sec?: string): string | undefined {
  if (!sec) return undefined;
  return sec
    .replace(/^(article|art\.?|section|sec\.?|§)\s*/i, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .trim();
}

/**
 * URL regex pattern supporting http, https, and official domain schemes
 */
const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^`\[\]]+/gi;

/**
 * Regular expressions for common legal citation patterns across jurisdictions (EU, US, BD, UK, International)
 */
const CITATION_PATTERNS: Array<{
  regex: RegExp;
  extract: (match: RegExpExecArray) => Partial<ExtractedCitation>;
}> = [
  // GDPR Article X (e.g. GDPR Article 5, GDPR Art. 33, Regulation (EU) 2016/679 Article 44)
  {
    regex: /\b(?:GDPR|General\s+Data\s+Protection\s+Regulation|(?:Regulation\s*\(EU\)\s*2016\/679))\s*,?\s*(?:Article|Art\.?|§)\s*(\d+[a-z]?(?:\(\d+\))?)\b/gi,
    extract: (m) => ({
      actTitle: "General Data Protection Regulation (GDPR)",
      section: `Article ${m[1]}`,
      jurisdiction: "EU",
      year: 2016,
    }),
  },
  // CCPA / CPRA Sections (e.g. CCPA §1798.120, Cal. Civ. Code § 1798.100, California Consumer Privacy Act Section 1798.120)
  {
    regex: /\b(?:CCPA|CPRA|Cal(?:ifornia)?\.?\s*Civ(?:il)?\.?\s*Code|California\s+Consumer\s+Privacy\s+Act)\s*,?\s*(?:§|Section|Sec\.?)\s*(\d+(?:\.\d+)?(?:\([a-z0-9]+\))*)\b/gi,
    extract: (m) => ({
      actTitle: "California Consumer Privacy Act (CCPA)",
      section: `§${m[1]}`,
      jurisdiction: "US",
      year: 2018,
    }),
  },
  // SEC Rules (e.g. SEC Rule 17a-4, 17 CFR § 240.17a-4, SEC Rule 13a-14)
  {
    regex: /\b(?:SEC\s+Rule|17\s+CFR\s*(?:§|Section)?)\s*([0-9]+[a-z]?-[0-9]+(?:\([a-z0-9]+\))?|240\.[0-9]+[a-z]?-[0-9]+)\b/gi,
    extract: (m) => ({
      actTitle: "Securities Exchange Act of 1934 / SEC Rules",
      section: `Rule ${m[1]}`,
      jurisdiction: "US",
      year: 1934,
    }),
  },
  // HIPAA Rules / CFR (e.g. HIPAA Security Rule, 45 CFR § 164.306, 45 CFR §164.312)
  {
    regex: /\b(?:HIPAA\s+Security\s+Rule|45\s+CFR\s*(?:§|Section)?\s*164\.(3\d{2}))\b/gi,
    extract: (m) => ({
      actTitle: "HIPAA Security Rule",
      section: m[1] ? `45 CFR § 164.${m[1]}` : "45 CFR §164.308-312",
      jurisdiction: "US",
      year: 1996,
    }),
  },
  // SOX Sections (e.g. SOX §302, Sarbanes-Oxley Act § 404, SOX Section 906)
  {
    regex: /\b(?:SOX|Sarbanes[- ]Oxley(?:\s+Act)?)\s*,?\s*(?:§|Section|Sec\.?)\s*(\d{3,4})\b/gi,
    extract: (m) => ({
      actTitle: "Sarbanes-Oxley Act (SOX)",
      section: `Section ${m[1]}`,
      jurisdiction: "US",
      year: 2002,
    }),
  },
  // Bangladesh Acts (e.g. Bangladesh Labour Act 2006 §26, BLA 2006 Section 26, Digital Security Act 2018 §26, Cyber Security Act 2023)
  {
    regex: /\b(?:Bangladesh\s+Labour\s+Act|BLA)\s*(?:,?\s*(\d{4}))?\s*,?\s*(?:§|Section|Sec\.?)\s*(\d+)\b/gi,
    extract: (m) => ({
      actTitle: "Bangladesh Labour Act",
      year: m[1] ? parseInt(m[1], 10) : 2006,
      section: `Section ${m[2]}`,
      jurisdiction: "BD",
    }),
  },
  {
    regex: /\b(Digital\s+Security\s+Act|Cyber\s+Security\s+Act)\s*(?:,?\s*(\d{4}))?(?:\s*,?\s*(?:§|Section|Sec\.?)\s*(\d+))?\b/gi,
    extract: (m) => ({
      actTitle: m[1].includes("Digital") ? "Digital Security Act 2018" : "Cyber Security Act 2023",
      year: m[2] ? parseInt(m[2], 10) : m[1].includes("Digital") ? 2018 : 2023,
      section: m[3] ? `Section ${m[3]}` : undefined,
      jurisdiction: "BD",
    }),
  },
  // Bangladesh Acts in Bangla script (e.g. বাংলাদেশ শ্রম আইন ২০০৬ এর ২৬ ধারা, ডিজিটাল নিরাপত্তা আইন ২০১৮, সাইবার নিরাপত্তা আইন ২০২৩)
  {
    regex: /(?:বাংলাদেশ\s+)?(শ্রম\s+আইন|ডিজিটাল\s+নিরাপত্তা\s+আইন|সাইবার\s+নিরাপত্তা\s+আইন)\s*(?:২০০৬|২০১৮|২০২৩)?(?:\s*এর\s*([০-৯0-9]+)\s*ধারা)?/gi,
    extract: (m) => {
      const isLabour = m[1].includes("শ্রম");
      const isDsa = m[1].includes("ডিজিটাল");
      const secNum = m[2]
        ? m[2]
            .replace(/০/g, "0")
            .replace(/১/g, "1")
            .replace(/২/g, "2")
            .replace(/৩/g, "3")
            .replace(/৪/g, "4")
            .replace(/৫/g, "5")
            .replace(/৬/g, "6")
            .replace(/৭/g, "7")
            .replace(/৮/g, "8")
            .replace(/৯/g, "9")
        : undefined;
      return {
        actTitle: isLabour
          ? "Bangladesh Labour Act"
          : isDsa
            ? "Digital Security Act 2018"
            : "Cyber Security Act 2023",
        year: isLabour ? 2006 : isDsa ? 2018 : 2023,
        section: secNum ? `Section ${secNum}` : undefined,
        jurisdiction: "BD",
      };
    },
  },
  // Bangladesh Bank Circulars / Directives
  {
    regex: /\bBangladesh\s+Bank\s+(?:Digital\s+Payment\s+Security\s+Circular|PSD\s+Circular(?:\s+Letter)?\s*No\.?\s*(\d+))\s*(?:\(?(\d{4})\)?)?\b/gi,
    extract: (m) => ({
      actTitle: "Bangladesh Bank Digital Payment Security Circular",
      section: m[1] ? `Circular ${m[1]}` : undefined,
      year: m[2] ? parseInt(m[2], 10) : 2023,
      jurisdiction: "BD",
    }),
  },
  // EU Commission Decisions / Directives (e.g. Commission Decision 2021/914, Directive 95/46/EC)
  {
    regex: /\b(?:Commission\s+(?:Implementing\s+)?Decision\s*\(?EU\)?\s*(\d{4}\/\d+)|Directive\s*(\d{2,4}\/\d+\/(?:EC|EU)))\b/gi,
    extract: (m) => ({
      actTitle: m[1] ? `Commission Decision (EU) ${m[1]}` : `Directive ${m[2]}`,
      jurisdiction: "EU",
      year: m[1] ? parseInt(m[1].split("/")[0], 10) : undefined,
    }),
  },
  // Transatlantic Data Transfer Frameworks (EU-US Privacy Shield, Safe Harbor, EU-US Data Privacy Framework)
  {
    regex: /\b(?:EU[- ]US\s+)?(Privacy\s+Shield|Safe\s+Harbor|Data\s+Privacy\s+Framework)(?:\s+(?:Framework|Decision|Agreement))?\b/gi,
    extract: (m) => ({
      actTitle: `EU-US ${m[1].trim()}`,
      jurisdiction: "EU",
    }),
  },
  // Generic legal citation format: "[Act Name] [Year] [Section/§ X]" or "[Act Name] § [Number]"
  {
    regex: /\b([A-Z][A-Za-z0-9\s,'-]{2,45})\s+(?:Act|Code|Statute|Regulation|Directive|Rule)\s+(?:of\s+)?(\d{4})?\s*,?\s*(?:§|Section|Sec\.?|Art\.?|Article)\s*(\d+[a-z]?(?:\.[0-9]+)?(?:\([a-z0-9]+\))*)\b/gi,
    extract: (m) => ({
      actTitle: `${m[1].trim()} Act`,
      year: m[2] ? parseInt(m[2], 10) : undefined,
      section: `Section ${m[3]}`,
    }),
  },
  // Case law / Regulatory decisions citation (e.g., "CJEU Case C-311/18 (Schrems II)")
  {
    regex: /\b(?:CJEU|ECJ)\s+(?:Case\s+)?(C-\d+\/\d+)(?:\s*\(([^)]+)\))?\b/gi,
    extract: (m) => ({
      actTitle: `CJEU ${m[1]}${m[2] ? ` (${m[2]})` : ""}`,
      section: m[1],
      jurisdiction: "EU",
    }),
  },
];

/**
 * Extract all legal references and source URLs from input text
 */
export function extractCitations(text: string): ExtractedCitation[] {
  if (!text || typeof text !== "string") return [];

  const citations: ExtractedCitation[] = [];
  const seenKeys = new Set<string>();

  // Extract all URLs present in the text
  const extractedUrls: Array<{ url: string; index: number }> = [];
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = URL_REGEX.exec(text)) !== null) {
    extractedUrls.push({ url: urlMatch[0], index: urlMatch.index });
  }

  // Iterate over patterns
  for (const { regex, extract } of CITATION_PATTERNS) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      const rawText = match[0].trim();
      const extracted = extract(match);

      if (!extracted.actTitle && !rawText) continue;

      const actTitle = extracted.actTitle ?? rawText;
      const section = extracted.section;
      const year = extracted.year;
      const jurisdiction = extracted.jurisdiction;

      // Find nearest source URL within 250 characters of this citation if any
      const nearbyUrl = extractedUrls.find(
        (u) => Math.abs(u.index - matchIndex) < 300,
      )?.url;

      const normAct = normalizeActName(actTitle);
      const normSec = normalizeSection(section);
      const normalizedKey = `${normAct}::${normSec ?? "all"}::${year ?? "any"}`;

      if (!seenKeys.has(normalizedKey)) {
        seenKeys.add(normalizedKey);

        const charStart = matchIndex;
        const charEnd = matchIndex + rawText.length;
        const snippetStart = Math.max(0, matchIndex - 60);
        const snippetEnd = Math.min(text.length, charEnd + 60);
        const contextSnippet = text.slice(snippetStart, snippetEnd).trim();

        citations.push({
          rawText,
          actTitle,
          section,
          year,
          jurisdiction,
          sourceUrl: nearbyUrl,
          normalizedKey,
          charStart,
          charEnd,
          contextSnippet,
        });
      }
    }
  }

  // Also include standalone recognized URL citations (e.g. direct links to legislation.gov.uk, eur-lex, ecfr.gov)
  for (const item of extractedUrls) {
    const u = item.url;
    if (
      u.includes("eur-lex.europa.eu") ||
      u.includes("ecfr.gov") ||
      u.includes("sec.gov") ||
      u.includes("legislation.gov") ||
      u.includes("bdlaws.minlaw.gov.bd")
    ) {
      const urlKey = `url::${u}`;
      if (!seenKeys.has(urlKey)) {
        seenKeys.add(urlKey);
        citations.push({
          rawText: u,
          actTitle: "Official Regulatory Source Link",
          sourceUrl: u,
          normalizedKey: urlKey,
          charStart: item.index,
          charEnd: item.index + u.length,
          contextSnippet: text
            .slice(Math.max(0, item.index - 50), Math.min(text.length, item.index + u.length + 50))
            .trim(),
        });
      }
    }
  }

  return citations;
}
