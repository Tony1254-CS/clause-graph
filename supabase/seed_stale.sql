-- ============================================================================
-- Seed Data: supabase/seed_stale.sql
-- Description: Verified Temporal Legal Ontology and Historical Version Fixtures
-- Includes Bangladesh Digital Security Act 2018 (repealed),
-- Cyber Security Act 2023 (active), and BTRC Telecomm Directive (amended).
-- ============================================================================

-- ── 1. Seed or Update Regulations with Temporal Data ─────────────────────────

-- 1.1 Digital Security Act 2018 (Repealed)
INSERT INTO public.regulations (
  id, jurisdiction, title, summary, obligations, news_signal_boost,
  status, effective_from, effective_to, repealed_by, superseded_by,
  current_version, official_source_url, gazette_reference, last_verified_at
) VALUES (
  'BD-DSA',
  'BD',
  'Digital Security Act 2018 (Act No. 46 of 2018) / ডিজিটাল নিরাপত্তা আইন, ২০১৮',
  'Enacted in October 2018 to ensure national digital security and prevent cyber crimes. Explicitly repealed on October 1, 2023 by Section 61 of the Cyber Security Act 2023.',
  '["identity_info_safeguards","critical_digital_infrastructure_protection","cyber_offense_prevention","content_takedown_compliance"]'::jsonb,
  0.18,
  'repealed',
  '2018-10-08',
  '2023-10-01',
  'BD-CSA',
  'BD-CSA',
  1,
  'http://bdlaws.minlaw.gov.bd/act-1264.html',
  'Bangladesh Gazette Extra-Ordinary, 8 October 2018',
  '2026-10-17 00:00:00+00'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  repealed_by = EXCLUDED.repealed_by,
  superseded_by = EXCLUDED.superseded_by,
  official_source_url = EXCLUDED.official_source_url,
  gazette_reference = EXCLUDED.gazette_reference,
  last_verified_at = EXCLUDED.last_verified_at;

-- 1.2 Cyber Security Act 2023 (Active)
INSERT INTO public.regulations (
  id, jurisdiction, title, summary, obligations, news_signal_boost,
  status, effective_from, effective_to, repealed_by, superseded_by,
  current_version, official_source_url, gazette_reference, last_verified_at
) VALUES (
  'BD-CSA',
  'BD',
  'Cyber Security Act 2023 (Act No. 37 of 2023) / সাইবার নিরাপত্তা আইন, ২০২৩',
  'Enacted on October 1, 2023 replacing the repealed Digital Security Act 2018. Restructures criminal penalties and modifies electronic evidence rules.',
  '["critical_information_infrastructure","cyber_incident_reporting","electronic_data_safeguards","technical_compliance_audit"]'::jsonb,
  0.20,
  'active',
  '2023-10-01',
  NULL,
  NULL,
  NULL,
  1,
  'http://bdlaws.minlaw.gov.bd/act-1454.html',
  'Bangladesh Gazette Extra-Ordinary, 1 October 2023',
  '2026-10-17 00:00:00+00'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  official_source_url = EXCLUDED.official_source_url,
  gazette_reference = EXCLUDED.gazette_reference,
  last_verified_at = EXCLUDED.last_verified_at;

-- 1.3 BTRC Telecommunication Directive 2021 (Amended v2)
INSERT INTO public.regulations (
  id, jurisdiction, title, summary, obligations, news_signal_boost,
  status, effective_from, effective_to, repealed_by, superseded_by,
  current_version, official_source_url, gazette_reference, last_verified_at
) VALUES (
  'BD-BTRC-LOC',
  'BD',
  'BTRC Directive on Telecommunication Data Localization & Retention (2021)',
  'Directs telecom operators and enterprise data conduits regarding domestic data residency, metadata storage, and cross-border replication reporting.',
  '["data_localization","call_detail_record_retention","cross_border_routing_report","incident_disclosure"]'::jsonb,
  0.10,
  'amended',
  '2021-03-01',
  NULL,
  NULL,
  NULL,
  2,
  'https://www.btrc.gov.bd/directives/data-security-2021',
  'BTRC Regulatory Directive No. 14.32.0000.400.25.001.21',
  '2026-10-17 00:00:00+00'
) ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  effective_from = EXCLUDED.effective_from,
  current_version = EXCLUDED.current_version,
  official_source_url = EXCLUDED.official_source_url,
  gazette_reference = EXCLUDED.gazette_reference,
  last_verified_at = EXCLUDED.last_verified_at;

-- 1.4 Update Existing REG-GDPR-44 with Temporal Metadata (Substantive Amendment Fixture)
UPDATE public.regulations SET
  status = 'amended',
  effective_from = '2018-05-25',
  current_version = 2,
  official_source_url = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679',
  gazette_reference = 'OJ L 119, 4.5.2016, p. 1–88',
  last_verified_at = '2026-10-17 00:00:00+00'
WHERE id = 'REG-GDPR-44';


-- ── 2. Seed Historical Regulation Versions ────────────────────────────────────

-- 2.1 DSA 2018 Version 1 (Historical - Terminated upon repeal)
INSERT INTO public.regulation_versions (
  regulation_id, version, effective_from, effective_to,
  amendment_type, summary, diff_from_previous, full_text,
  obligations, official_source_url
) VALUES (
  'BD-DSA',
  1,
  '2018-10-08',
  '2023-10-01',
  'repeal',
  'Original enactment of Digital Security Act 2018. Replaced previous ICT Act Section 57 frameworks. Later formally repealed by Cyber Security Act 2023.',
  '{"enactment": true, "repealed_on": "2023-10-01", "unverified_mapping": {"old_section": "57", "new_section": "28", "note": "Section 57 provisions conceptually recast into Section 28 of CSA 2023; statutory equivalents require verification before automated substitution."}}'::jsonb,
  'Full statutory text of Act No. 46 of 2018. Section 57 / 28 provisions regarding publishing offensive, false or defamatory information in digital media.',
  '["identity_info_safeguards","critical_digital_infrastructure_protection","cyber_offense_prevention"]'::jsonb,
  'http://bdlaws.minlaw.gov.bd/act-1264.html'
) ON CONFLICT (regulation_id, version) DO UPDATE SET
  summary = EXCLUDED.summary,
  diff_from_previous = EXCLUDED.diff_from_previous;

-- 2.2 CSA 2023 Version 1 (Current Active)
INSERT INTO public.regulation_versions (
  regulation_id, version, effective_from, effective_to,
  amendment_type, summary, diff_from_previous, full_text,
  obligations, official_source_url
) VALUES (
  'BD-CSA',
  1,
  '2023-10-01',
  NULL,
  'substantive',
  'First enactment of Cyber Security Act 2023 repealing Digital Security Act 2018. Decriminalized certain non-bailable clauses and overhauled institutional cyber powers.',
  '{"repeals_act": "BD-DSA", "transition_deadline": "2024-04-01", "reorganized_sections": [{"old": "DSA §57/§25", "new": "CSA §28"}]}'::jsonb,
  'Full statutory text of Act No. 37 of 2023. Section 28 penalizes publication of information that harms religious values or causes communal disharmony.',
  '["critical_information_infrastructure","cyber_incident_reporting","electronic_data_safeguards"]'::jsonb,
  'http://bdlaws.minlaw.gov.bd/act-1454.html'
) ON CONFLICT (regulation_id, version) DO UPDATE SET
  summary = EXCLUDED.summary,
  diff_from_previous = EXCLUDED.diff_from_previous;

-- 2.3 BTRC Directive Version 1 (Historical)
INSERT INTO public.regulation_versions (
  regulation_id, version, effective_from, effective_to,
  amendment_type, summary, diff_from_previous, full_text,
  obligations, official_source_url
) VALUES (
  'BD-BTRC-LOC',
  1,
  '2021-03-01',
  '2023-06-14',
  NULL,
  'Initial version mandating domestic localization of call logs and telecommunication metadata.',
  '{"initial_version": true}'::jsonb,
  'Directive text establishing mandatory physical servers inside Bangladesh jurisdiction for subscriber metadata.',
  '["data_localization","call_detail_record_retention"]'::jsonb,
  'https://www.btrc.gov.bd/directives/data-security-2021'
) ON CONFLICT (regulation_id, version) DO UPDATE SET
  summary = EXCLUDED.summary;

-- 2.4 BTRC Directive Version 2 (Current - Cosmetic Amendment)
INSERT INTO public.regulation_versions (
  regulation_id, version, effective_from, effective_to,
  amendment_type, summary, diff_from_previous, full_text,
  obligations, official_source_url
) VALUES (
  'BD-BTRC-LOC',
  2,
  '2023-06-15',
  NULL,
  'cosmetic',
  'Clarified reporting windows for backup synchronization without changing core localization mandate.',
  '{"amendment": "cosmetic", "clarified_sections": ["Section 4.2 filing deadline extended from 24h to 48h for routine backup logs"]}'::jsonb,
  'Revised text specifying 48h notice for off-shore disaster-recovery replica testing.',
  '["data_localization","call_detail_record_retention","cross_border_routing_report"]'::jsonb,
  'https://www.btrc.gov.bd/directives/data-security-2021-v2'
) ON CONFLICT (regulation_id, version) DO UPDATE SET
  summary = EXCLUDED.summary,
  diff_from_previous = EXCLUDED.diff_from_previous;

-- 2.5 GDPR Article 44 Version 1 (Pre-June 2021 Old SCCs)
INSERT INTO public.regulation_versions (
  regulation_id, version, effective_from, effective_to,
  amendment_type, summary, diff_from_previous, full_text,
  obligations, official_source_url
) VALUES (
  'REG-GDPR-44',
  1,
  '2018-05-25',
  '2021-06-03',
  NULL,
  'Original GDPR transfer rules relying on legacy 2001/2010 Standard Contractual Clauses.',
  '{"legacy_scc": true}'::jsonb,
  'Chapter V international data transfer baseline under Commission Decisions 2001/497/EC and 2010/87/EU.',
  '["adequacy_or_safeguards","legacy_scc_execution"]'::jsonb,
  'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679'
) ON CONFLICT (regulation_id, version) DO UPDATE SET
  summary = EXCLUDED.summary;

-- 2.6 GDPR Article 44 Version 2 (Substantive Amendment - Modernized SCCs & Schrems II)
INSERT INTO public.regulation_versions (
  regulation_id, version, effective_from, effective_to,
  amendment_type, summary, diff_from_previous, full_text,
  obligations, official_source_url
) VALUES (
  'REG-GDPR-44',
  2,
  '2021-06-04',
  NULL,
  'substantive',
  'Implementation of Commission Implementing Decision (EU) 2021/914 (Modernized SCCs) and mandatory Transfer Impact Assessments following Schrems II.',
  '{"amendment": "substantive", "repealed_legacy_sccs": true, "transition_grace_period_end": "2022-12-27", "mandatory_tia": true}'::jsonb,
  'Modernized SCC modular architecture (Controller-to-Controller, Controller-to-Processor, Processor-to-Processor, Processor-to-Controller) with mandatory local surveillance risk evaluation.',
  '["adequacy_or_safeguards","transfer_impact_assessment","modern_scc_adoption","supplementary_technical_measures"]'::jsonb,
  'https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj'
) ON CONFLICT (regulation_id, version) DO UPDATE SET
  summary = EXCLUDED.summary,
  diff_from_previous = EXCLUDED.diff_from_previous;
