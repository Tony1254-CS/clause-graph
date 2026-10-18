// ============================================================================
// Citation Regex Engine: src/lib/stale/citation-regex.ts
// Robust deterministic extractor for legal citations across English and Bengali,
// handling sections, articles, statutory acronyms, years, and provision IDs.
// ============================================================================

export interface RegexCitationHit {
  raw_citation: string;
  law_name?: string;
  article?: string;
  year?: number;
  acronym?: string;
  confidence: number;
  start_index: number;
  end_index: number;
  extraction_method: 'regex';
}

// Bengali to Western numeral map
const BENGALI_NUMERALS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function normalizeBengaliNumerals(input: string): string {
  return input.replace(/[০-৯]/g, (digit) => BENGALI_NUMERALS[digit] || digit);
}

// Known statutory aliases and law patterns
const KNOWN_ACRONYMS = [
  'GDPR',
  'DSA',
  'CSA',
  'BTRC',
  'HIPAA',
  'SOX',
  'CCPA',
  'DORA',
  'CSRD',
  'DPDP',
  'ICTA',
  'BLA',
];

/**
 * Helper to resolve known statutory acronyms from law names or acronym tokens
 */
export function resolveAcronym(name: string): string | undefined {
  if (!name) return undefined;
  const lower = name.toLowerCase();
  if (lower.includes('digital security') || lower.includes('ডিজিটাল সিকিউরিটি') || lower.includes('ডিজিটাল নিরাপত্তা')) return 'DSA';
  if (lower.includes('cyber security') || lower.includes('সাইবার নিরাপত্তা')) return 'CSA';
  if (lower.includes('general data protection') || lower.includes('gdpr')) return 'GDPR';
  if (lower.includes('labour act') || lower.includes('labor act') || lower.includes('শ্রম আইন')) return 'BLA';
  if (lower.includes('telecommunication') || lower.includes('btrc')) return 'BTRC';
  if (lower.includes('health insurance') || lower.includes('hipaa')) return 'HIPAA';
  if (lower.includes('sarbanes') || lower.includes('sox')) return 'SOX';
  if (lower.includes('california consumer') || lower.includes('ccpa')) return 'CCPA';
  if (lower.includes('digital operational') || lower.includes('dora')) return 'DORA';
  if (lower.includes('corporate sustainability') || lower.includes('csrd')) return 'CSRD';
  if (lower.includes('data protection and digital') || lower.includes('dpdp')) return 'DPDP';
  if (lower.includes('information and communication') || lower.includes('ict act') || lower.includes('icta')) return 'ICTA';

  for (const acr of KNOWN_ACRONYMS) {
    if (new RegExp(`\\b${acr}\\b`, 'i').test(name)) {
      return acr.toUpperCase();
    }
  }
  return undefined;
}

/**
 * Extracts candidate legal citations from text using layered regex matching.
 * Handles Sections, Articles, Paragraphs, Bengali provisions, and Statute names with years.
 */
export function runRegexExtractor(text: string): RegexCitationHit[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Bound maximum input to prevent ReDoS / excessive computation
  const sanitized = text.slice(0, 10000);
  const normalizedText = normalizeBengaliNumerals(sanitized);
  const hits: RegexCitationHit[] = [];
  const hitSignatures = new Set<string>();

  // Helper to add unique hits
  const addHit = (hit: RegexCitationHit) => {
    const sig = `${hit.raw_citation.trim().toLowerCase()}|${hit.start_index}`;
    if (!hitSignatures.has(sig)) {
      hitSignatures.add(sig);
      hits.push(hit);
    }
  };

  // ── Pattern 1: Section/Article followed by law and year ──────────────────────
  // e.g. "Section 57 of the Digital Security Act 2018", "Article 44 of GDPR"
  // e.g. "§26 of Bangladesh Labour Act 2006", "Sec. 17a-4 of SEC Rule"
  const secLawYearRegex =
    /(?:(?:Section|Sec\.|Article|Art\.|§)\s*([0-9]+[A-Za-z0-9\.\-]*))\s+(?:of\s+(?:the\s+)?)?([A-Za-z\s\(\)]+?\b(?:Act|Directive|Regulation|Rule|Order|GDPR|DSA|CSA|BTRC|HIPAA|SOX|CCPA)\b)(?:\s*,?\s*(\b[12][0-9]{3}\b))?/gi;

  let match: RegExpExecArray | null;
  while ((match = secLawYearRegex.exec(normalizedText)) !== null) {
    const raw = match[0].trim();
    const article = match[1]?.trim();
    const lawName = match[2]?.trim();
    const yearStr = match[3]?.trim();
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    const acronym = resolveAcronym(lawName);

    addHit({
      raw_citation: raw,
      law_name: lawName,
      article,
      year,
      acronym,
      confidence: 0.90,
      start_index: match.index,
      end_index: match.index + raw.length,
      extraction_method: 'regex',
    });
  }

  // ── Pattern 2: Law followed by Section/Article ───────────────────────────────
  // e.g. "Digital Security Act 2018 Section 57", "GDPR Article 44", "CSA 2023 §28"
  const lawSecRegex =
    /([A-Za-z\s\(\)]+?\b(?:Act|Directive|Regulation|Rule|Order|GDPR|DSA|CSA|BTRC|HIPAA|SOX|CCPA)\b)(?:\s+([12][0-9]{3}))?\s+(?:Section|Sec\.|Article|Art\.|§)\s*([0-9]+[A-Za-z0-9\.\-]*)/gi;

  while ((match = lawSecRegex.exec(normalizedText)) !== null) {
    const raw = match[0].trim();
    const lawName = match[1]?.trim();
    const yearStr = match[2]?.trim();
    const article = match[3]?.trim();
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    const acronym = resolveAcronym(lawName);

    addHit({
      raw_citation: raw,
      law_name: lawName,
      article,
      year,
      acronym,
      confidence: 0.92,
      start_index: match.index,
      end_index: match.index + raw.length,
      extraction_method: 'regex',
    });
  }

  // ── Pattern 3: Standalone Statute with Year ──────────────────────────────────
  // e.g. "Digital Security Act 2018", "Cyber Security Act 2023", "Labour Act 2006"
  const lawYearRegex =
    /\b([A-Z][A-Za-z\s]{3,40}(?:Act|Directive|Regulation|Order|Code))\s+([12][0-9]{3})\b/g;

  while ((match = lawYearRegex.exec(normalizedText)) !== null) {
    const raw = match[0].trim();
    const lawName = match[1]?.trim();
    const year = parseInt(match[2]?.trim(), 10);

    // Skip if already captured inside a broader Section hit
    const overlaps = hits.some(
      (h) => match!.index >= h.start_index && match!.index < h.end_index
    );
    if (!overlaps) {
      const acronym = resolveAcronym(lawName);

      addHit({
        raw_citation: raw,
        law_name: `${lawName} ${year}`,
        year,
        acronym,
        confidence: 0.85,
        start_index: match.index,
        end_index: match.index + raw.length,
        extraction_method: 'regex',
      });
    }
  }

  // ── Pattern 4: Bengali Legal Citations ───────────────────────────────────────
  // e.g. "ডিজিটাল নিরাপত্তা আইন, ২০১৮ এর ৫৭ ধারা", "সাইবার নিরাপত্তা আইন ২০২৩ এর ধারা ২৮"
  // e.g. "ডিজিটাল সিকিউরিটি আইন ২০১৮", "বাংলাদেশ শ্রম আইন ২০০৬"
  const bengaliLawRegex =
    /((?:ডিজিটাল\s*(?:নিরাপত্তা|সিকিউরিটি)\s*আইন|সাইবার\s*নিরাপত্তা\s*আইন|বাংলাদেশ\s*শ্রম\s*আইন|তথ্য\s*ও\s*যোগাযোগ\s*প্রযুক্তি\s*আইন)(?:[\s,]*([০-৯]{4}|[12][0-9]{3}))?)(?:[^\n]*?(?:এর\s*)?(?:(?:ধারা|অনুচ্ছেদ)\s*([০-৯]+|[0-9]+[A-Za-z]?)|([০-৯]+|[0-9]+[A-Za-z]?)\s*(?:ধারা|ধারার|অনুচ্ছেদ)))?/gu;

  while ((match = bengaliLawRegex.exec(sanitized)) !== null) {
    const raw = match[0].trim();
    const rawLawPart = match[1]?.trim();
    const rawYearPart = match[2]?.trim();
    const rawArticlePart = match[3]?.trim() || match[4]?.trim();

    const normalizedYear = rawYearPart
      ? parseInt(normalizeBengaliNumerals(rawYearPart), 10)
      : undefined;
    const normalizedArticle = rawArticlePart
      ? normalizeBengaliNumerals(rawArticlePart)
      : undefined;

    let acronym: string | undefined;
    if (rawLawPart.includes('ডিজিটাল')) acronym = 'DSA';
    else if (rawLawPart.includes('সাইবার')) acronym = 'CSA';
    else if (rawLawPart.includes('শ্রম')) acronym = 'BLA';
    else if (rawLawPart.includes('তথ্য ও যোগাযোগ')) acronym = 'ICTA';

    addHit({
      raw_citation: raw,
      law_name: rawLawPart,
      article: normalizedArticle,
      year: normalizedYear,
      acronym,
      confidence: 0.95,
      start_index: match.index,
      end_index: match.index + raw.length,
      extraction_method: 'regex',
    });
  }

  // ── Pattern 5: Direct Acronym + Article / Section ────────────────────────────
  // e.g. "GDPR Art. 44", "DSA Sec 57", "BTRC Directive 2021"
  const acronymArticleRegex =
    /\b(GDPR|DSA|CSA|BTRC|HIPAA|SOX|CCPA|DORA|CSRD|DPDP)\s+(?:Article|Art\.|Section|Sec\.|§)?\s*([0-9]+[A-Za-z0-9\.\-]*)/gi;

  while ((match = acronymArticleRegex.exec(normalizedText)) !== null) {
    const raw = match[0].trim();
    const acr = match[1]?.toUpperCase();
    const article = match[2]?.trim();

    const overlaps = hits.some(
      (h) => match!.index >= h.start_index && match!.index < h.end_index
    );
    if (!overlaps) {
      addHit({
        raw_citation: raw,
        law_name: acr,
        article,
        acronym: acr,
        confidence: 0.88,
        start_index: match.index,
        end_index: match.index + raw.length,
        extraction_method: 'regex',
      });
    }
  }

  // Sort hits by position in text
  return hits.sort((a, b) => a.start_index - b.start_index);
}
