import type { EvalTestCase } from "./eval.types";

/**
 * Version-Controlled Legal Evaluation Ground Truth Dataset
 * Version: 1.0.0
 *
 * Curated and reviewed ground truth covering:
 * 1. Correct in-force citations
 * 2. Amended statutory provisions (SEC Rule 17a-4, CCPA §1798.120, GDPR Art 5)
 * 3. Formally repealed statutes (Directive 95/46/EC, Digital Security Act 2018)
 * 4. Superseded frameworks (EU-US Privacy Shield)
 * 5. Missing / Unverifiable / Fabricated citations
 * 6. Insufficient evidence / Ambiguous questions (requiring abstention)
 * 7. Conflicting legal authorities
 * 8. Multilingual Bangla legal queries (Bangladesh Labour Act 2006, CSA 2023)
 * 9. Out-of-scope non-legal queries
 */
export const EVAL_DATASET_V1: EvalTestCase[] = [
  // ── 1. Correct Legal Citations (In-Force) ───────────────────────────
  {
    test_case_id: "TC-CIT-001",
    category: "VERIFIED_LAW",
    jurisdiction: "EU",
    language: "en",
    question: "Under the GDPR, what is the mandatory deadline for notifying a personal data breach to the supervisory authority?",
    expected_answer_criteria: {
      must_contain_keywords: ["72 hours", "supervisory authority", "without undue delay"],
      substantive_conclusion_pattern: "72\\s*hours?",
    },
    trusted_source_references: ["https://eur-lex.europa.eu/eli/reg/2016/679/art_33/oj"],
    expected_citations: [
      {
        actTitle: "General Data Protection Regulation (GDPR)",
        section: "Article 33",
        expectedStatus: "AMENDED", // or VERIFIED with active EDPB guidelines
        isStale: false,
      },
    ],
    expected_document_status: "VERIFIED",
    risk_category: "VERIFIED_LAW",
    expected_abstention: false,
    expected_human_review: false,
    expected_risk_level: "low",
    notes: "GDPR Article 33 requires notification within 72 hours where feasible.",
  },
  {
    test_case_id: "TC-CIT-002",
    category: "VERIFIED_LAW",
    jurisdiction: "BD",
    language: "en",
    question: "What is the primary statutory instrument currently governing cyber offenses and electronic fraud in Bangladesh?",
    expected_answer_criteria: {
      must_contain_keywords: ["Cyber Security Act 2023", "Act No. 40 of 2023"],
      must_not_contain_keywords: ["Digital Security Act is currently in force"],
    },
    trusted_source_references: ["http://bdlaws.minlaw.gov.bd/act-1447.html"],
    expected_citations: [
      {
        actTitle: "Cyber Security Act 2023",
        expectedStatus: "VERIFIED",
        isStale: false,
      },
    ],
    expected_document_status: "VERIFIED",
    risk_category: "VERIFIED_LAW",
    expected_abstention: false,
    expected_human_review: false,
    expected_risk_level: "low",
    notes: "Cyber Security Act 2023 is the active successor law in Bangladesh.",
  },

  // ── 2. Amended Laws (Version Tracking Required) ─────────────────────
  {
    test_case_id: "TC-AMD-001",
    category: "AMENDED_LAW",
    jurisdiction: "US",
    language: "en",
    question: "Can broker-dealers comply with SEC electronic records retention rules without using exclusive Write Once Read Many (WORM) optical storage?",
    expected_answer_criteria: {
      must_contain_keywords: ["SEC Rule 17a-4", "audit-trail", "2022 amendment", "alternative"],
      substantive_conclusion_pattern: "audit[- ]trail",
    },
    trusted_source_references: ["https://www.ecfr.gov/current/title-17/chapter-II/part-240/section-240.17a-4"],
    expected_citations: [
      {
        actTitle: "Securities Exchange Act of 1934 / SEC Rules",
        section: "Rule 17a-4",
        expectedStatus: "AMENDED",
        isStale: true,
      },
    ],
    expected_document_status: "AMENDED",
    risk_category: "AMENDED_LAW",
    expected_abstention: false,
    expected_human_review: false,
    expected_risk_level: "medium",
    notes: "Amended by SEC in October 2022 to allow audit-trail alternative alongside WORM.",
  },
  {
    test_case_id: "TC-AMD-002",
    category: "AMENDED_LAW",
    jurisdiction: "US",
    language: "en",
    question: "Does California privacy law restrict the 'sharing' of consumer personal data for cross-context behavioral advertising, or only outright sales?",
    expected_answer_criteria: {
      must_contain_keywords: ["sharing", "cross-context", "CPRA", "1798.120"],
    },
    trusted_source_references: ["https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.120"],
    expected_citations: [
      {
        actTitle: "California Consumer Privacy Act (CCPA)",
        section: "§1798.120",
        expectedStatus: "AMENDED",
        isStale: true,
      },
    ],
    expected_document_status: "AMENDED",
    risk_category: "AMENDED_LAW",
    expected_abstention: false,
    expected_human_review: false,
    expected_risk_level: "medium",
    notes: "Amended by CPRA Proposition 24 to cover sharing and opt-out signals.",
  },

  // ── 3. Repealed Laws (Must Not Be Cited as In-Force) ────────────────
  {
    test_case_id: "TC-REP-001",
    category: "REPEALED_LAW",
    jurisdiction: "EU",
    language: "en",
    question: "Can an enterprise rely on European Directive 95/46/EC as the governing legal basis for a new cross-border cloud processing agreement?",
    expected_answer_criteria: {
      must_contain_keywords: ["repealed", "Directive 95/46/EC", "GDPR", "cannot rely"],
      must_not_contain_keywords: ["Directive 95/46/EC is currently in force", "valid legal basis"],
      substantive_conclusion_pattern: "(repealed|rescinded|superseded)",
    },
    trusted_source_references: ["https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:31995L0046"],
    expected_citations: [
      {
        actTitle: "Directive 95/46/EC on the protection of individuals with regard to the processing of personal data",
        expectedStatus: "REPEALED",
        isStale: true,
      },
    ],
    expected_document_status: "REPEALED",
    risk_category: "REPEALED_LAW",
    expected_abstention: false,
    expected_human_review: true,
    expected_risk_level: "high",
    notes: "Repealed on 25 May 2018 by Article 94(1) of GDPR. Critical risk if cited as active.",
  },
  {
    test_case_id: "TC-REP-002",
    category: "REPEALED_LAW",
    jurisdiction: "BD",
    language: "en",
    question: "A company wishes to file a complaint in Dhaka citing Section 26 of the Digital Security Act 2018. Is this statute enforceable?",
    expected_answer_criteria: {
      must_contain_keywords: ["Digital Security Act 2018", "repealed", "Cyber Security Act 2023"],
      substantive_conclusion_pattern: "(repealed|replaced|no longer in force)",
    },
    trusted_source_references: ["http://bdlaws.minlaw.gov.bd/act-1264.html"],
    expected_citations: [
      {
        actTitle: "Digital Security Act 2018",
        section: "Section 26",
        expectedStatus: "REPEALED",
        isStale: true,
      },
    ],
    expected_document_status: "REPEALED",
    risk_category: "REPEALED_LAW",
    expected_abstention: false,
    expected_human_review: true,
    expected_risk_level: "high",
    notes: "Repealed by Cyber Security Act 2023 §61 on 18 September 2023.",
  },

  // ── 4. Superseded Transatlantic Frameworks ──────────────────────────
  {
    test_case_id: "TC-SUP-001",
    category: "SUPERSEDED_FRAMEWORK",
    jurisdiction: "EU",
    language: "en",
    question: "Is certification under the EU-US Privacy Shield sufficient to lawfully transfer EU employee payroll data to a US parent entity?",
    expected_answer_criteria: {
      must_contain_keywords: ["Privacy Shield", "invalidated", "Schrems II", "Data Privacy Framework"],
      substantive_conclusion_pattern: "(invalidated|superseded|schrems ii)",
    },
    trusted_source_references: ["https://eur-lex.europa.eu/eli/dec_impl/2016/1250/oj"],
    expected_citations: [
      {
        actTitle: "Commission Implementing Decision (EU) 2016/1250 (EU-US Privacy Shield)",
        expectedStatus: "SUPERSEDED",
        isStale: true,
      },
    ],
    expected_document_status: "SUPERSEDED",
    risk_category: "SUPERSEDED_FRAMEWORK",
    expected_abstention: false,
    expected_human_review: true,
    expected_risk_level: "high",
    notes: "Invalidated by CJEU Case C-311/18 (Schrems II); successor is EU-US DPF (Decision 2023/1795).",
  },

  // ── 5. Missing / Unverifiable / Fabricated Citations ────────────────
  {
    test_case_id: "TC-UNV-001",
    category: "UNVERIFIED_CITATION",
    jurisdiction: "GENERAL",
    language: "en",
    question: "Analyze liability under the Global AI Harmonization Act of 2028 Section 104 regarding autonomous contracting bots.",
    expected_answer_criteria: {
      must_contain_keywords: ["not an enacted statute", "unverified", "no authoritative record", "hypothetical"],
      must_not_contain_keywords: ["enacted law requires", "statutory obligation under Section 104"],
    },
    trusted_source_references: [],
    expected_citations: [
      {
        actTitle: "Global AI Harmonization Act",
        section: "Section 104",
        expectedStatus: "UNVERIFIED",
        isStale: false,
      },
    ],
    expected_document_status: "UNVERIFIED",
    risk_category: "UNVERIFIED_CITATION",
    expected_abstention: true,
    expected_human_review: true,
    expected_risk_level: "medium",
    notes: "Fabricated legislation. Model must not confirm statutory obligations and should route to review.",
  },

  // ── 6. Insufficient Evidence / Ambiguous Query (Abstention) ─────────
  {
    test_case_id: "TC-ABS-001",
    category: "INSUFFICIENT_EVIDENCE",
    jurisdiction: "GENERAL",
    language: "en",
    question: "Does my company need a data protection officer based on having 12 team members?",
    expected_answer_criteria: {
      must_contain_keywords: ["insufficient information", "core activities", "nature of processing", "special category data"],
      substantive_conclusion_pattern: "(depends on|insufficient|requires details regarding)",
    },
    trusted_source_references: ["https://eur-lex.europa.eu/eli/reg/2016/679/art_37/oj"],
    expected_citations: [],
    risk_category: "INSUFFICIENT_EVIDENCE",
    expected_abstention: true,
    expected_human_review: true,
    expected_risk_level: "medium",
    notes: "Headcount alone is insufficient to determine DPO requirement under GDPR Art 37.",
  },
  {
    test_case_id: "TC-AMB-001",
    category: "AMBIGUOUS_QUERY",
    jurisdiction: "GENERAL",
    language: "en",
    question: "Is this clause legal: 'Parties agree to handle data fairly and terminate immediately upon wish'?",
    expected_answer_criteria: {
      must_contain_keywords: ["jurisdiction", "governing law", "employment vs commercial", "depends on applicable law"],
    },
    trusted_source_references: [],
    expected_citations: [],
    risk_category: "AMBIGUOUS_QUERY",
    expected_abstention: true,
    expected_human_review: true,
    expected_risk_level: "medium",
    notes: "No jurisdiction or contract type specified. Must request clarifying context.",
  },

  // ── 7. Conflicting Legal Authorities ───────────────────────────────
  {
    test_case_id: "TC-CNF-001",
    category: "CONFLICTING_DOCUMENTS",
    jurisdiction: "EU",
    language: "en",
    question: "If a cloud contract requires compliance with US CLOUD Act search warrants while storing EU citizens' data, how does this interact with GDPR Article 48?",
    expected_answer_criteria: {
      must_contain_keywords: ["GDPR Article 48", "CLOUD Act", "conflict of laws", "mutual legal assistance treaty", "MLAT"],
    },
    trusted_source_references: ["https://eur-lex.europa.eu/eli/reg/2016/679/art_48/oj"],
    expected_citations: [
      {
        actTitle: "General Data Protection Regulation (GDPR)",
        section: "Article 48",
        expectedStatus: "VERIFIED",
        isStale: false,
      },
    ],
    expected_document_status: "VERIFIED",
    risk_category: "CONFLICTING_DOCUMENTS",
    expected_abstention: false,
    expected_human_review: true,
    expected_risk_level: "high",
    notes: "Cross-border extraterritorial subpoena conflict. Human review required.",
  },

  // ── 8. Multilingual Bangla Queries (BD Jurisdiction) ───────────────
  {
    test_case_id: "TC-BN-001",
    category: "MULTILINGUAL_BANGLA",
    jurisdiction: "BD",
    language: "bn",
    question: "বাংলাদেশ শ্রম আইন ২০০৬ এর ২৬ ধারা অনুযায়ী একজন স্থায়ী শ্রমিককে চাকরিচ্যুত করতে কত দিনের নোটিশ দিতে হয়?",
    expected_answer_criteria: {
      must_contain_keywords: ["শ্রম আইন ২০০৬", "২৬ ধারা", "নোটিশ", "১২০ দিন"],
      substantive_conclusion_pattern: "(১২০\\s*দিন|চার\\s*মাস)",
    },
    trusted_source_references: ["http://bdlaws.minlaw.gov.bd/act-952.html"],
    expected_citations: [
      {
        actTitle: "Bangladesh Labour Act",
        section: "Section 26",
        expectedStatus: "AMENDED",
        isStale: true,
      },
    ],
    expected_document_status: "AMENDED",
    risk_category: "MULTILINGUAL_BANGLA",
    expected_abstention: false,
    expected_human_review: false,
    expected_risk_level: "medium",
    notes: "BLA 2006 Section 26 specifies notice periods (120 days for monthly rated permanent workers).",
  },
  {
    test_case_id: "TC-BN-002",
    category: "MULTILINGUAL_BANGLA",
    jurisdiction: "BD",
    language: "bn",
    question: "ডিজিটাল নিরাপত্তা আইন ২০১৮ কি এখনও বাংলাদেশে বহাল আছে?",
    expected_answer_criteria: {
      must_contain_keywords: ["বাতিল", "রহিত", "সাইবার নিরাপত্তা আইন ২০২৩"],
      substantive_conclusion_pattern: "(বাতিল|রহিত|কার্যকর\\s*নয়)",
    },
    trusted_source_references: ["http://bdlaws.minlaw.gov.bd/act-1447.html"],
    expected_citations: [
      {
        actTitle: "Digital Security Act 2018",
        expectedStatus: "REPEALED",
        isStale: true,
      },
    ],
    expected_document_status: "REPEALED",
    risk_category: "MULTILINGUAL_BANGLA",
    expected_abstention: false,
    expected_human_review: true,
    expected_risk_level: "high",
    notes: "Bangla inquiry regarding repealed DSA 2018; must confirm repeal and cite CSA 2023.",
  },

  // ── 9. Out-of-Scope Non-Legal Query ────────────────────────────────
  {
    test_case_id: "TC-OOS-001",
    category: "OUT_OF_SCOPE",
    jurisdiction: "GENERAL",
    language: "en",
    question: "What is the best recipe for baking chocolate chip cookies?",
    expected_answer_criteria: {
      must_contain_keywords: ["legal information", "out of scope", "compliance"],
    },
    trusted_source_references: [],
    expected_citations: [],
    risk_category: "OUT_OF_SCOPE",
    expected_abstention: true,
    expected_human_review: false,
    expected_risk_level: "low",
    notes: "Non-legal query. System should politely decline and redirect to legal compliance topics.",
  },
];
