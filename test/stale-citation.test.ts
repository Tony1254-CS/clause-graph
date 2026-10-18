// ============================================================================
// Stale Citation Test Suite: test/stale-citation.test.ts
// Comprehensive unit, integration, and temporal correctness tests covering
// the 6 mandatory categories, Bengali language support, and backtest metrics.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { runRegexExtractor, normalizeBengaliNumerals } from '../src/lib/stale/citation-regex';
import { resolveCitationAgainstOntology } from '../src/lib/stale/citation-extraction.functions';
import {
  evaluateCitationStaleness,
  type RegulationTemporalMetadata,
} from '../src/lib/stale/detector';
import {
  DSA_2018_BACKTEST_DATASET,
  evaluateBacktestDataset,
} from '../src/lib/stale/backtest.functions';

describe('1. Regex Citation Extraction Engine', () => {
  it('extracts "Section 57 of the Digital Security Act 2018"', () => {
    const text = 'Contractor shall comply with Section 57 of the Digital Security Act 2018 in all communications.';
    const hits = runRegexExtractor(text);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    const hit = hits[0];
    expect(hit.raw_citation).toContain('Section 57 of the Digital Security Act 2018');
    expect(hit.article).toBe('57');
    expect(hit.year).toBe(2018);
    expect(hit.acronym).toBe('DSA');
  });

  it('extracts multiple citations from the same clause (DSA + GDPR)', () => {
    const text = 'Contractor shall comply with Section 57 of the Digital Security Act 2018 and Article 44 of GDPR.';
    const hits = runRegexExtractor(text);
    expect(hits.length).toBe(2);
    expect(hits.map((h) => h.acronym)).toContain('DSA');
    expect(hits.map((h) => h.acronym)).toContain('GDPR');
  });

  it('normalizes Bengali numerals accurately', () => {
    expect(normalizeBengaliNumerals('২০১৮')).toBe('2018');
    expect(normalizeBengaliNumerals('৫৭')).toBe('57');
    expect(normalizeBengaliNumerals('১২৩৪৫৬৭৮৯০')).toBe('1234567890');
  });

  it('extracts Bengali legal references (ডিজিটাল নিরাপত্তা আইন ২০১৮)', () => {
    const text = 'ডিজিটাল নিরাপত্তা আইন, ২০১৮ এর ৫৭ ধারা অনুযায়ী তথ্য প্রকাশ নিষিদ্ধ।';
    const hits = runRegexExtractor(text);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    const hit = hits[0];
    expect(hit.acronym).toBe('DSA');
    expect(hit.article).toBe('57');
    expect(hit.year).toBe(2018);
  });

  it('extracts section references with alphanumeric IDs like 17a-4 and §26', () => {
    const text = 'Broker must comply with Sec. 17a-4 of SEC Rule and §26 of Bangladesh Labour Act 2006.';
    const hits = runRegexExtractor(text);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    const secHit = hits.find((h) => h.article === '17a-4');
    expect(secHit).toBeDefined();
  });
});

describe('2. Legal Ontology Resolution Engine', () => {
  const ontology: RegulationTemporalMetadata[] = [
    {
      id: 'BD-DSA',
      title: 'Digital Security Act 2018 (Act No. 46 of 2018)',
      jurisdiction: 'BD',
      status: 'repealed',
      effective_from: '2018-10-08',
      effective_to: '2023-10-01',
      repealed_by: 'BD-CSA',
      superseded_by: 'BD-CSA',
      current_version: 1,
      official_source_url: 'http://bdlaws.minlaw.gov.bd/act-1264.html',
      gazette_reference: 'Bangladesh Gazette, 8 Oct 2018',
    },
    {
      id: 'BD-CSA',
      title: 'Cyber Security Act 2023 (Act No. 37 of 2023)',
      jurisdiction: 'BD',
      status: 'active',
      effective_from: '2023-10-01',
      effective_to: null,
      repealed_by: null,
      superseded_by: null,
      current_version: 1,
      official_source_url: 'http://bdlaws.minlaw.gov.bd/act-1454.html',
      gazette_reference: 'Bangladesh Gazette, 1 Oct 2023',
    },
    {
      id: 'REG-GDPR-44',
      title: 'GDPR Article 44 — International Data Transfers',
      jurisdiction: 'EU',
      status: 'amended',
      effective_from: '2018-05-25',
      effective_to: null,
      repealed_by: null,
      superseded_by: null,
      current_version: 2,
      official_source_url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
      gazette_reference: 'OJ L 119',
    },
  ];

  it('resolves DSA 2018 candidate to BD-DSA', () => {
    const res = resolveCitationAgainstOntology(
      { raw_text: 'Section 57 of Digital Security Act 2018', law_name: 'Digital Security Act', year: 2018, acronym: 'DSA' },
      ontology
    );
    expect(res.is_resolved).toBe(true);
    expect(res.regulation_id).toBe('BD-DSA');
  });

  it('resolves CSA 2023 candidate to BD-CSA', () => {
    const res = resolveCitationAgainstOntology(
      { raw_text: 'Section 28 of Cyber Security Act 2023', law_name: 'Cyber Security Act', year: 2023, acronym: 'CSA' },
      ontology
    );
    expect(res.is_resolved).toBe(true);
    expect(res.regulation_id).toBe('BD-CSA');
  });

  it('preserves unresolved state for unknown foreign law without guessing', () => {
    const res = resolveCitationAgainstOntology(
      { raw_text: 'Singapore PDPA Section 11', law_name: 'PDPA', year: 2012 },
      ontology
    );
    expect(res.is_resolved).toBe(false);
    expect(res.regulation_id).toBeNull();
  });
});

describe('3. Mandatory 6-Category Deterministic Staleness Matrix', () => {
  const dsaReg: RegulationTemporalMetadata = {
    id: 'BD-DSA',
    title: 'Digital Security Act 2018',
    jurisdiction: 'BD',
    status: 'repealed',
    effective_from: '2018-10-08',
    effective_to: '2023-10-01',
    repealed_by: 'BD-CSA',
    superseded_by: 'BD-CSA',
    current_version: 1,
    official_source_url: 'http://bdlaws.minlaw.gov.bd/act-1264.html',
    gazette_reference: 'Bangladesh Gazette, 8 Oct 2018',
    versions: [
      {
        version: 1,
        effective_from: '2018-10-08',
        effective_to: '2023-10-01',
        amendment_type: 'repeal',
        summary: 'Enactment of DSA 2018; repealed in Oct 2023.',
        diff_from_previous: { unverified_mapping: { old_section: '57', new_section: '28', note: 'Provision recast into CSA 2023 §28.' } },
        obligations: [],
        official_source_url: 'http://bdlaws.minlaw.gov.bd/act-1264.html',
      },
    ],
  };

  const gdprReg: RegulationTemporalMetadata = {
    id: 'REG-GDPR-44',
    title: 'GDPR Article 44 — International Data Transfers',
    jurisdiction: 'EU',
    status: 'amended',
    effective_from: '2018-05-25',
    effective_to: null,
    repealed_by: null,
    superseded_by: null,
    current_version: 2,
    official_source_url: 'https://eur-lex.europa.eu',
    gazette_reference: 'OJ L 119',
    versions: [
      {
        version: 1,
        effective_from: '2018-05-25',
        effective_to: '2021-06-03',
        amendment_type: null,
        summary: 'Legacy 2001/2010 SCCs',
        diff_from_previous: {},
        obligations: [],
        official_source_url: 'https://eur-lex.europa.eu',
      },
      {
        version: 2,
        effective_from: '2021-06-04',
        effective_to: null,
        amendment_type: 'substantive',
        summary: 'Modernized SCCs adopted under Decision 2021/914; Schrems II TIA required.',
        diff_from_previous: { transition_grace_period_end: '2022-12-27' },
        obligations: [],
        official_source_url: 'https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj',
      },
    ],
  };

  const btrcReg: RegulationTemporalMetadata = {
    id: 'BD-BTRC-LOC',
    title: 'BTRC Directive on Telecommunication Data Localization',
    jurisdiction: 'BD',
    status: 'amended',
    effective_from: '2021-03-01',
    effective_to: null,
    repealed_by: null,
    superseded_by: null,
    current_version: 2,
    official_source_url: 'https://www.btrc.gov.bd',
    gazette_reference: 'Directive No. 14.32.0000',
    versions: [
      {
        version: 1,
        effective_from: '2021-03-01',
        effective_to: '2023-06-14',
        amendment_type: null,
        summary: 'Initial data localization mandate',
        diff_from_previous: {},
        obligations: [],
        official_source_url: 'https://www.btrc.gov.bd',
      },
      {
        version: 2,
        effective_from: '2023-06-15',
        effective_to: null,
        amendment_type: 'cosmetic',
        summary: 'Clarified 48-hour filing notice for off-shore replica testing',
        diff_from_previous: {},
        obligations: [],
        official_source_url: 'https://www.btrc.gov.bd',
      },
    ],
  };

  const csaReg: RegulationTemporalMetadata = {
    id: 'BD-CSA',
    title: 'Cyber Security Act 2023',
    jurisdiction: 'BD',
    status: 'active',
    effective_from: '2023-10-01',
    effective_to: null,
    repealed_by: null,
    superseded_by: null,
    current_version: 1,
    official_source_url: 'http://bdlaws.minlaw.gov.bd/act-1454.html',
    gazette_reference: 'Bangladesh Gazette, 1 Oct 2023',
    versions: [],
  };

  // Test 1: Repealed Regulation
  it('Category 1 (Repealed): DSA 2018 Section 57 evaluated today produces critical/repealed', () => {
    const finding = evaluateCitationStaleness(
      {
        id: 'c1',
        raw_citation: 'Section 57 of the Digital Security Act 2018',
        cited_article: '57',
        cited_year: 2018,
        contract_value: 1000000,
        regulation_id: 'BD-DSA',
      },
      dsaReg,
      { evaluationDate: '2026-10-17' }
    );

    expect(finding).not.toBeNull();
    expect(finding?.severity).toBe('critical');
    expect(finding?.staleness_type).toBe('repealed');
    expect(finding?.financial_exposure).toBe(1000000);
    expect(finding?.evidence.repealed_by).toBe('BD-CSA');
  });

  // Test 2: Substantive Amendment
  it('Category 2 (Substantive Amendment): GDPR Article 44 v1 produces high/substantive_amendment', () => {
    const finding = evaluateCitationStaleness(
      {
        id: 'c2',
        raw_citation: 'Article 44 of GDPR',
        cited_article: '44',
        cited_version: 1,
        contract_value: 500000,
        regulation_id: 'REG-GDPR-44',
      },
      gdprReg,
      { evaluationDate: '2026-10-17' }
    );

    expect(finding).not.toBeNull();
    expect(finding?.severity).toBe('high');
    expect(finding?.staleness_type).toBe('substantive_amendment');
    expect(finding?.transition_deadline).toBe('2022-12-27');
    expect(finding?.financial_exposure).toBe(250000); // 50% proxy
  });

  // Test 3: Cosmetic Amendment
  it('Category 3 (Cosmetic Amendment): BTRC Directive v1 produces medium/cosmetic', () => {
    const finding = evaluateCitationStaleness(
      {
        id: 'c3',
        raw_citation: 'BTRC Directive 2021',
        cited_version: 1,
        contract_value: 200000,
        regulation_id: 'BD-BTRC-LOC',
      },
      btrcReg,
      { evaluationDate: '2026-10-17' }
    );

    expect(finding).not.toBeNull();
    expect(finding?.severity).toBe('medium');
    expect(finding?.staleness_type).toBe('cosmetic');
  });

  // Test 4: Active Regulation
  it('Category 4 (Active): CSA 2023 Section 28 produces NO finding (True Negative)', () => {
    const finding = evaluateCitationStaleness(
      {
        id: 'c4',
        raw_citation: 'Section 28 of Cyber Security Act 2023',
        cited_article: '28',
        cited_year: 2023,
        regulation_id: 'BD-CSA',
      },
      csaReg,
      { evaluationDate: '2026-10-17' }
    );

    expect(finding).toBeNull();
  });

  // Test 5: Bengali Citation
  it('Category 5 (Bengali Citation): ডিজিটাল নিরাপত্তা আইন ২০১৮ evaluated today produces critical/repealed', () => {
    const finding = evaluateCitationStaleness(
      {
        id: 'c5',
        raw_citation: 'ডিজিটাল নিরাপত্তা আইন, ২০১৮ এর ৫৭ ধারা',
        cited_article: '57',
        cited_year: 2018,
        regulation_id: 'BD-DSA',
      },
      dsaReg,
      { evaluationDate: '2026-10-17' }
    );

    expect(finding).not.toBeNull();
    expect(finding?.severity).toBe('critical');
    expect(finding?.staleness_type).toBe('repealed');
  });

  // Test 6: Temporal Historical Correctness
  it('Category 6 (Temporal Correctness): DSA 2018 evaluated in May 2020 was ACTIVE law (No finding)', () => {
    const finding = evaluateCitationStaleness(
      {
        id: 'c6',
        raw_citation: 'Section 26 of Digital Security Act 2018',
        cited_article: '26',
        cited_year: 2018,
        as_of_date: '2020-05-15',
        regulation_id: 'BD-DSA',
      },
      dsaReg,
      { evaluationDate: '2020-05-15' } // Historical evaluation date!
    );

    expect(finding).toBeNull(); // Was valid law when signed/evaluated in 2020!
  });
});

describe('4. Reproducible Ground-Truth Backtest Dataset', () => {
  it('contains at least 5 labeled real-world clauses', () => {
    expect(DSA_2018_BACKTEST_DATASET.length).toBeGreaterThanOrEqual(5);
  });

  it('has documented source provenance for every sample', () => {
    for (const sample of DSA_2018_BACKTEST_DATASET) {
      expect(sample.source_provenance).toBeDefined();
      expect(sample.source_provenance.length).toBeGreaterThan(10);
      expect(sample.evaluation_date).toBeDefined();
    }
  });

  it('accurately distinguishes positive and negative cases', () => {
    const positives = DSA_2018_BACKTEST_DATASET.filter((s) => s.expected_is_stale);
    const negatives = DSA_2018_BACKTEST_DATASET.filter((s) => !s.expected_is_stale);
    expect(positives.length).toBeGreaterThanOrEqual(3);
    expect(negatives.length).toBeGreaterThanOrEqual(1);
  });

  it('runs full backtest evaluation achieving 100% precision, recall, and accuracy', () => {
    const results = evaluateBacktestDataset(DSA_2018_BACKTEST_DATASET);
    expect(results.total_clauses).toBe(6);
    expect(results.passed_clauses).toBe(6);
    expect(results.failed_clauses).toBe(0);
    expect(results.confusion_matrix.true_positives).toBe(4);
    expect(results.confusion_matrix.true_negatives).toBe(2);
    expect(results.confusion_matrix.false_positives).toBe(0);
    expect(results.confusion_matrix.false_negatives).toBe(0);
    expect(results.metrics.precision).toBe(1.0);
    expect(results.metrics.recall).toBe(1.0);
    expect(results.metrics.f1_score).toBe(1.0);
    expect(results.metrics.accuracy).toBe(1.0);
  });
});

describe('5. Edge Cases & Safety Guardrails', () => {
  it('handles empty, null, and non-string inputs safely in regex extractor', () => {
    expect(runRegexExtractor('')).toEqual([]);
    // @ts-expect-error test invalid inputs
    expect(runRegexExtractor(null)).toEqual([]);
    // @ts-expect-error test invalid inputs
    expect(runRegexExtractor(undefined)).toEqual([]);
  });

  it('handles renumbered statute provision with explicit mapping', () => {
    const renumberedReg: RegulationTemporalMetadata = {
      id: 'BD-DSA-RENUMBER',
      title: 'Digital Security Act 2018',
      jurisdiction: 'BD',
      status: 'active',
      effective_from: '2018-10-08',
      effective_to: null,
      repealed_by: null,
      superseded_by: null,
      current_version: 1,
      official_source_url: 'http://bdlaws.minlaw.gov.bd/act-1264.html',
      gazette_reference: null,
      versions: [
        {
          version: 1,
          effective_from: '2018-10-08',
          effective_to: null,
          amendment_type: 'renumbering',
          summary: 'Section renumbering test',
          diff_from_previous: {
            renumbered_sections: {
              '57': '28',
            },
          },
          obligations: [],
          official_source_url: 'http://bdlaws.minlaw.gov.bd/act-1264.html',
        },
      ],
    };

    const finding = evaluateCitationStaleness(
      {
        id: 'renum-1',
        raw_citation: 'Section 57 of Digital Security Act 2018',
        cited_article: '57',
        cited_year: 2018,
        regulation_id: 'BD-DSA-RENUMBER',
      },
      renumberedReg,
      { evaluationDate: '2026-10-17' }
    );

    expect(finding).not.toBeNull();
    expect(finding?.staleness_type).toBe('renumbered');
    expect(finding?.suggested_citation).toContain('Section 28');
  });

  it('bounds exposure calculation and formats financial impact as proxy', () => {
    const finding = evaluateCitationStaleness(
      {
        id: 'exp-1',
        raw_citation: 'Section 57 of the Digital Security Act 2018',
        cited_article: '57',
        contract_value: 2500000,
        regulation_id: 'BD-DSA',
      },
      {
        id: 'BD-DSA',
        title: 'Digital Security Act 2018',
        jurisdiction: 'BD',
        status: 'repealed',
        effective_from: '2018-10-08',
        effective_to: '2023-10-01',
        repealed_by: 'BD-CSA',
        superseded_by: 'BD-CSA',
        current_version: 1,
        official_source_url: 'http://bdlaws.minlaw.gov.bd',
        gazette_reference: null,
        versions: [],
      },
      { evaluationDate: '2026-10-17' }
    );

    expect(finding?.financial_exposure).toBe(2500000);
  });
});
