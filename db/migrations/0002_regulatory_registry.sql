-- 0002_regulatory_registry.sql
-- Establishes the authoritative Legal Instrument, Provision, Obligation, and Regulatory Events schema

-- 1. Official Sources Registry
CREATE TABLE IF NOT EXISTS public.sources (
  id text PRIMARY KEY,
  jurisdiction text NOT NULL,
  name text NOT NULL,
  base_url text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('api','html','manual')),
  reliability text NOT NULL CHECK (reliability IN ('official_authentic','official_documentary','secondary')),
  license_note text,
  enabled boolean NOT NULL DEFAULT true,
  last_success_at timestamptz,
  last_error text
);

-- 2. Legal Instruments Registry
CREATE TABLE IF NOT EXISTS public.legal_instruments (
  id text PRIMARY KEY,
  jurisdiction text NOT NULL,
  title text NOT NULL,
  short_title text,
  instrument_type text NOT NULL CHECK (instrument_type IN ('act','ordinance','regulation','rule','circular','guidance','decision')),
  status text NOT NULL CHECK (status IN ('proposed','adopted','in_force','partially_in_force','amended','repealed','superseded','expired','unknown')),
  adopted_on date,
  in_force_from date,
  repealed_on date,
  superseded_by text REFERENCES public.legal_instruments(id),
  official_url text NOT NULL,
  source_id text REFERENCES public.sources(id),
  verification text NOT NULL DEFAULT 'unverified' CHECK (verification IN ('verified','unverified','disputed')),
  verified_by uuid,
  verified_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Instrument Versions (Snapshots)
CREATE TABLE IF NOT EXISTS public.instrument_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id text NOT NULL REFERENCES public.legal_instruments(id),
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  source_url text NOT NULL,
  content_sha256 text NOT NULL,
  content_text text NOT NULL,
  content_format text NOT NULL,
  valid_from date,
  valid_to date,
  UNIQUE (instrument_id, content_sha256)
);

-- 4. Provisions (Articles / Sections)
CREATE TABLE IF NOT EXISTS public.provisions (
  id text PRIMARY KEY,
  instrument_id text NOT NULL REFERENCES public.legal_instruments(id),
  version_id uuid REFERENCES public.instrument_versions(id),
  label text NOT NULL,
  text text NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', label || ' ' || text)) STORED
);
CREATE INDEX IF NOT EXISTS provisions_tsv_idx ON public.provisions USING gin (tsv);

-- 5. Obligations (Normalized Duties)
CREATE TABLE IF NOT EXISTS public.obligations (
  id text PRIMARY KEY,
  provision_id text NOT NULL REFERENCES public.provisions(id),
  tag text NOT NULL,
  statement text NOT NULL,
  quote text NOT NULL,
  origin text NOT NULL CHECK (origin IN ('human','ai_draft')),
  review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected'))
);

-- 6. Regulatory Events (Ingested & Ported Chronology)
CREATE TABLE IF NOT EXISTS public.regulatory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id text REFERENCES public.legal_instruments(id),
  source_id text NOT NULL REFERENCES public.sources(id),
  external_id text,
  event_type text NOT NULL CHECK (event_type IN ('proposed','published','adopted','amended','repealed','effective','guidance','enforcement')),
  title text NOT NULL,
  url text NOT NULL,
  published_on date,
  effective_on date,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_sha256 text,
  is_synthetic boolean NOT NULL DEFAULT false,
  verification text NOT NULL DEFAULT 'unverified' CHECK (verification IN ('verified','unverified','disputed')),
  triage_status text NOT NULL DEFAULT 'new' CHECK (triage_status IN ('new','relevant','not_relevant','duplicate')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, external_id)
);
CREATE INDEX IF NOT EXISTS regulatory_events_instrument_idx ON public.regulatory_events (instrument_id);
CREATE INDEX IF NOT EXISTS regulatory_events_published_idx ON public.regulatory_events (published_on DESC);

-- 7. Legacy Regulation Mapping Table (Preserves backward compatibility with REG-* IDs)
CREATE TABLE IF NOT EXISTS public.legacy_reg_map (
  legacy_id text NOT NULL REFERENCES public.regulations(id) ON DELETE CASCADE,
  provision_id text NOT NULL REFERENCES public.provisions(id) ON DELETE CASCADE,
  PRIMARY KEY (legacy_id, provision_id)
);

-- ─── SEED DATA ──────────────────────────────────────────────────────────────

-- Seed Sources
INSERT INTO public.sources (id, jurisdiction, name, base_url, kind, reliability, license_note) VALUES
('us-federal-register', 'US', 'Federal Register', 'https://www.federalregister.gov', 'api', 'official_authentic', 'U.S. Government work - public domain'),
('us-ecfr', 'US', 'Electronic Code of Federal Regulations', 'https://www.ecfr.gov', 'api', 'official_authentic', 'U.S. Government work - public domain'),
('eu-eurlex', 'EU', 'EUR-Lex / Publications Office of the European Union', 'https://eur-lex.europa.eu', 'api', 'official_authentic', 'Decision 2011/833/EU'),
('bd-bdlaws', 'BD', 'Laws of Bangladesh (Legislative & Parliamentary Affairs)', 'http://bdlaws.minlaw.gov.bd', 'html', 'official_authentic', 'Government of Bangladesh official repository'),
('bd-bangladesh-bank', 'BD', 'Bangladesh Bank Payment Systems Department', 'https://www.bb.org.bd', 'html', 'official_authentic', 'Bangladesh Bank circulars'),
('ca-oag', 'US', 'California Office of the Attorney General / CPPA', 'https://cppa.ca.gov', 'html', 'official_authentic', 'State of California official repository')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  reliability = EXCLUDED.reliability;

-- Seed Legal Instruments
-- All 13 verified/documented instruments across US, EU, and Bangladesh
INSERT INTO public.legal_instruments (
  id, jurisdiction, title, short_title, instrument_type, status,
  adopted_on, in_force_from, repealed_on, superseded_by, official_url, source_id, verification, notes
) VALUES
('eu-gdpr', 'EU', 'Regulation (EU) 2016/679 (General Data Protection Regulation)', 'GDPR', 'regulation', 'in_force',
 '2016-04-27', '2018-05-25', NULL, NULL, 'https://eur-lex.europa.eu/eli/reg/2016/679/oj', 'eu-eurlex', 'verified', 'Comprehensive EU data protection framework.'),

('us-ccpa', 'US', 'California Consumer Privacy Act of 2018 (as amended by CPRA)', 'CCPA/CPRA', 'act', 'in_force',
 '2018-06-28', '2020-01-01', NULL, NULL, 'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=CIV&division=3.&title=1.81.5.', 'ca-oag', 'verified', 'California Civil Code § 1798.100 et seq.'),

('us-hipaa-security-rule', 'US', 'HIPAA Security Standards for the Protection of ePHI (45 CFR Part 164 Subpart C)', 'HIPAA Security Rule', 'rule', 'in_force',
 '2003-02-20', '2003-04-21', NULL, NULL, 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-C', 'us-ecfr', 'verified', 'Enforced by HHS OCR.'),

('us-sec-rule-17a-4', 'US', 'SEC Rule 17a-4 — Records to Be Preserved by Certain Exchange Members, Brokers and Dealers', 'SEC Rule 17a-4', 'rule', 'in_force',
 '1997-10-31', '1997-10-31', NULL, NULL, 'https://www.ecfr.gov/current/title-17/chapter-II/part-240/section-240.17a-4', 'us-ecfr', 'verified', 'Broker-dealer record preservation rules, amended 2022 to allow audit-trail alternative to WORM.'),

('us-sox-act-2002', 'US', 'Sarbanes-Oxley Act of 2002 (Pub.L. 107–204)', 'SOX Act 2002', 'act', 'in_force',
 '2002-07-30', '2002-07-30', NULL, NULL, 'https://www.govinfo.gov/app/details/PLAW-107publ204', 'us-federal-register', 'verified', 'Public company accounting reform and investor protection.'),

('bd-digital-security-act-2018', 'BD', 'Digital Security Act 2018 (Act No. 46 of 2018)', 'DSA 2018', 'act', 'repealed',
 '2018-09-19', '2018-10-08', '2023-09-18', NULL, 'http://bdlaws.minlaw.gov.bd/act-1260.html', 'bd-bdlaws', 'verified', 'Repealed on 18 Sep 2023 by the Cyber Security Act 2023.'),

('bd-cyber-security-act-2023', 'BD', 'Cyber Security Act 2023 (Act No. 40 of 2023)', 'CSA 2023', 'act', 'repealed',
 '2023-09-13', '2023-09-18', '2025-05-21', NULL, 'http://bdlaws.minlaw.gov.bd/act-1454.html', 'bd-bdlaws', 'verified', 'Repealed on 21 May 2025 by the Cyber Security Ordinance 2025.'),

('bd-cyber-security-ordinance-2025', 'BD', 'Cyber Security Ordinance 2025 (Ordinance No. 25 of 2025)', 'CSO 2025', 'ordinance', 'in_force',
 '2025-05-21', '2025-05-21', NULL, NULL, 'http://dpp.gov.bd/bgpress/index.php/document/extraordinary', 'bd-bdlaws', 'verified', 'In force 21 May 2025, repealing CSA 2023.'),

('bd-personal-data-protection-ordinance-2025', 'BD', 'Personal Data Protection Ordinance 2025', 'PDPO 2025', 'ordinance', 'adopted',
 '2025-10-09', NULL, NULL, NULL, 'http://dpp.gov.bd/bgpress/index.php/document/extraordinary', 'bd-bdlaws', 'unverified', 'Approved by Council of Advisers on 9 Oct 2025; gazette publication date pending verification.'),

('bd-labour-act-2006', 'BD', 'Bangladesh Labour Act 2006 (Act No. 42 of 2006)', 'Labour Act 2006', 'act', 'in_force',
 '2006-10-11', '2006-10-11', NULL, NULL, 'http://bdlaws.minlaw.gov.bd/act-952.html', 'bd-bdlaws', 'verified', 'Consolidated labor code of Bangladesh.'),

('bd-bangladesh-bank-dps-2023', 'BD', 'Bangladesh Bank Payment Systems Instructions on 2FA and Card Security', 'BB PSD Instruction', 'circular', 'in_force',
 '2023-04-18', '2023-04-18', NULL, NULL, 'https://www.bb.org.bd/en/index.php/mediaroom/circular', 'bd-bangladesh-bank', 'unverified', 'PSD instruction on mandatory 2FA for card-not-present transactions.'),

('eu-ai-act', 'EU', 'Regulation (EU) 2024/1689 of the European Parliament and of the Council (Artificial Intelligence Act)', 'EU AI Act', 'regulation', 'in_force',
 '2024-06-13', '2024-08-01', NULL, NULL, 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj', 'eu-eurlex', 'verified', 'Risk-based governance of artificial intelligence systems in the EU.'),

('eu-reg-2026-1744', 'EU', 'Regulation (EU) 2026/1744 (Digital Omnibus on Artificial Intelligence)', 'AI Digital Omnibus', 'regulation', 'in_force',
 '2026-07-24', '2026-07-27', NULL, NULL, 'https://eur-lex.europa.eu/eli/reg/2026/1744/oj', 'eu-eurlex', 'verified', 'Amends Regulation 2024/1689; moves Annex III high-risk compliance date to 2 Dec 2027.')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  short_title = EXCLUDED.short_title,
  status = EXCLUDED.status,
  official_url = EXCLUDED.official_url,
  verification = EXCLUDED.verification,
  notes = EXCLUDED.notes;

-- Update superseded_by references
UPDATE public.legal_instruments SET superseded_by = 'bd-cyber-security-act-2023' WHERE id = 'bd-digital-security-act-2018';
UPDATE public.legal_instruments SET superseded_by = 'bd-cyber-security-ordinance-2025' WHERE id = 'bd-cyber-security-act-2023';

-- Seed Provisions
INSERT INTO public.provisions (id, instrument_id, label, text) VALUES
('eu-gdpr:art-5', 'eu-gdpr', 'Article 5 — Principles relating to processing of personal data',
 'Personal data shall be processed lawfully, fairly and in a transparent manner in relation to the data subject; collected for specified, explicit and legitimate purposes; adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed (data minimisation).'),

('eu-gdpr:art-33', 'eu-gdpr', 'Article 33 — Notification of a personal data breach to the supervisory authority',
 'In the case of a personal data breach, the controller shall without undue delay and, where feasible, not later than 72 hours after having become aware of it, notify the personal data breach to the supervisory authority competent in accordance with Article 55, unless the personal data breach is unlikely to result in a risk to the rights and freedoms of natural persons.'),

('eu-gdpr:art-44', 'eu-gdpr', 'Article 44 — General principle for transfers',
 'Any transfer of personal data which are undergoing processing or are intended for processing after transfer to a third country or to an international organisation shall take place only if, subject to the other provisions of this Regulation, the conditions laid down in this Chapter are complied with by the controller and processor.'),

('us-ccpa:sec-1798.120', 'us-ccpa', 'Section 1798.120 — Consumers Right to Opt Out of Sale or Sharing',
 'A consumer shall have the right, at any time, to direct a business that sells or shares personal information about the consumer to third parties not to sell or share the consumer''s personal information. This right may be referred to as the right to opt-out of sale or sharing.'),

('us-hipaa:subpart-c', 'us-hipaa-security-rule', '45 CFR Subpart C — Security Standards for the Protection of ePHI',
 'Covered entities and business associates must implement administrative, physical, and technical safeguards that reasonably and appropriately protect the confidentiality, integrity, and availability of the electronic protected health information that it creates, receives, maintains, or transmits.'),

('us-sec:rule-17a-4', 'us-sec-rule-17a-4', '17 CFR § 240.17a-4 — Records to be preserved by certain exchange members, brokers and dealers',
 'Every member, broker, and dealer subject to § 240.17a-3 shall preserve for a period of not less than 6 years, the first 2 years in an easily accessible place, all records required to be made pursuant to § 240.17a-3(a)(1), (a)(2), (a)(3), (a)(5), (a)(21), (a)(22), and analogous records.'),

('us-sox:sec-302', 'us-sox-act-2002', 'Section 302 — Corporate Responsibility for Financial Reports',
 'The commission shall, by rule, require, for each company filing periodic reports under section 13(a) or 15(d) of the Securities Exchange Act of 1934, that the principal executive officer or officers and the principal financial officer or officers certify in each annual or quarterly report filed that they have reviewed the report.'),

('bd-dsa:sec-26', 'bd-digital-security-act-2018', 'Section 26 — Unauthorized use of identity information',
 'If any person, without lawful authority, collects, sells, holds, supplies, or uses any citizen''s identity information, such act shall be an offense under this Act. (Repealed and superseded by Cyber Security Act 2023).'),

('bd-cso:sec-25', 'bd-cyber-security-ordinance-2025', 'Section 25 — Offenses concerning identity and digital system interference',
 'Unauthorized collection, possession, or exploitation of digital identity information or digital assets without explicit lawful consent constitutes a punishable offense under Ordinance 25/2025.'),

('bd-la:sec-26', 'bd-labour-act-2006', 'Section 26 — Notice of termination of employment by employer',
 'The employment of a permanent worker may be terminated by the employer by giving in writing 120 days notice in case of monthly rated workers, or by paying wages for 120 days in lieu of notice.'),

('bd-bb:dps-circular', 'bd-bangladesh-bank-dps-2023', 'PSD Circular — Digital Payment Authentication and Security Controls',
 'Scheduled banks and payment service providers shall implement mandatory two-factor authentication for all card-not-present transactions and ensure timely logging of customer payment authorizations.')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  text = EXCLUDED.text;

-- Seed Obligations
INSERT INTO public.obligations (id, provision_id, tag, statement, quote, origin, review_status) VALUES
('eu-gdpr:art-33:notify-72h', 'eu-gdpr:art-33', '72h_breach_notification',
 'Notify supervisory authority of personal data breach within 72 hours of awareness.',
 'not later than 72 hours after having become aware of it', 'human', 'approved'),

('eu-gdpr:art-5:minimization', 'eu-gdpr:art-5', 'data_minimization',
 'Collect and process only personal data adequate, relevant, and limited to necessity.',
 'adequate, relevant and limited to what is necessary', 'human', 'approved'),

('eu-gdpr:art-44:safeguards', 'eu-gdpr:art-44', 'adequacy_or_safeguards',
 'Transfer personal data to third countries only subject to appropriate safeguards.',
 'conditions laid down in this Chapter are complied with by the controller and processor', 'human', 'approved'),

('us-ccpa:opt-out', 'us-ccpa:sec-1798.120', 'opt_out_link',
 'Provide consumers with right and clear mechanism to opt out of sale or sharing of personal information.',
 'right, at any time, to direct a business that sells or shares personal information about the consumer to third parties not to sell or share', 'human', 'approved'),

('us-hipaa:encryption', 'us-hipaa:subpart-c', 'encryption_in_transit_and_at_rest',
 'Implement encryption and safeguards for electronic protected health information.',
 'protect the confidentiality, integrity, and availability of the electronic protected health information', 'human', 'approved'),

('us-sec:17a-4:retention', 'us-sec:rule-17a-4', 'immutable_retention',
 'Preserve broker-dealer records for minimum required statutory periods.',
 'preserve for a period of not less than 6 years, the first 2 years in an easily accessible place', 'human', 'approved'),

('us-sox:officer-cert', 'us-sox:sec-302', 'officer_certification',
 'Principal executive and financial officers must certify periodic financial reports.',
 'principal executive officer or officers and the principal financial officer or officers certify in each annual or quarterly report', 'human', 'approved'),

('bd-dsa:identity-safeguards', 'bd-dsa:sec-26', 'identity_info_safeguards',
 'Ensure lawful authority and security safeguards over customer identity data.',
 'without lawful authority, collects, sells, holds, supplies, or uses any citizen''s identity information', 'human', 'approved'),

('bd-la:written-notice', 'bd-la:sec-26', 'written_notice_period',
 'Provide minimum statutory written notice or compensation in lieu upon termination.',
 'giving in writing 120 days notice in case of monthly rated workers, or by paying wages for 120 days in lieu of notice', 'human', 'approved'),

('bd-bb:strong-auth', 'bd-bb:dps-circular', 'strong_customer_authentication',
 'Enforce two-factor authentication on payment transactions.',
 'mandatory two-factor authentication for all card-not-present transactions', 'human', 'approved')
ON CONFLICT (id) DO UPDATE SET
  statement = EXCLUDED.statement,
  quote = EXCLUDED.quote,
  tag = EXCLUDED.tag;

-- Seed Legacy Map
INSERT INTO public.legacy_reg_map (legacy_id, provision_id) VALUES
('REG-GDPR-5', 'eu-gdpr:art-5'),
('REG-GDPR-33', 'eu-gdpr:art-33'),
('REG-GDPR-44', 'eu-gdpr:art-44'),
('REG-CCPA-1798.120', 'us-ccpa:sec-1798.120'),
('REG-HIPAA-SEC', 'us-hipaa:subpart-c'),
('REG-SEC-17A4', 'us-sec:rule-17a-4'),
('REG-SOX-302', 'us-sox:sec-302'),
('REG-BD-DSA-2018', 'bd-dsa:sec-26'),
('REG-BD-LA-2006', 'bd-la:sec-26'),
('REG-BB-DPS-2023', 'bd-bb:dps-circular')
ON CONFLICT (legacy_id, provision_id) DO NOTHING;

-- ─── SEED REGULATORY EVENTS (PORTED & VERIFIED AMENDMENT CHRONOLOGY) ────────

INSERT INTO public.regulatory_events (
  instrument_id, source_id, external_id, event_type, title, url, published_on, effective_on, raw, verification, triage_status
) VALUES
-- GDPR Events
('eu-gdpr', 'eu-eurlex', 'edpb-guidelines-4-2019', 'guidance',
 'EDPB Guidelines 4/2019 on Data Protection by Design and by Default',
 'https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-42019-article-25-data-protection-design-and-default_en',
 '2019-02-13', '2019-02-13', '{"summary": "Reinforced the minimization principle as an engineering requirement."}', 'verified', 'relevant'),

('eu-gdpr', 'eu-eurlex', 'edpb-guidelines-7-2020', 'guidance',
 'EDPB Guidelines 07/2020 on the concepts of Controller and Processor in the GDPR',
 'https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-072020-concepts-controller-and-processor-gdpr_en',
 '2020-09-07', '2020-09-07', '{"summary": "Sharpened responsibility for minimization across joint operations."}', 'verified', 'relevant'),

('eu-gdpr', 'eu-eurlex', 'edpb-guidelines-5-2022', 'guidance',
 'EDPB Guidelines 05/2022 on Facial Recognition Technology in Law Enforcement',
 'https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052022-use-facial-recognition-technology-area-law_en',
 '2022-05-18', '2022-05-18', '{"summary": "Extended data minimization expectations to biometric templates."}', 'verified', 'relevant'),

('eu-gdpr', 'eu-eurlex', 'wp29-breach-guidelines', 'guidance',
 'WP29 Guidelines on Personal Data Breach Notification under Regulation 2016/679',
 'https://ec.europa.eu/newsroom/article29/items/612052',
 '2018-02-06', '2018-05-25', '{"summary": "Finalized statutory criteria for 72-hour breach reporting."}', 'verified', 'relevant'),

('eu-gdpr', 'eu-eurlex', 'edpb-guidelines-1-2021', 'guidance',
 'EDPB Guidelines 01/2021 on Examples regarding Personal Data Breach Notification',
 'https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-012021-examples-regarding-data-breach-notification_en',
 '2021-01-14', '2021-01-14', '{"summary": "Published 18 worked breach case studies expanding notifiable scenarios."}', 'verified', 'relevant'),

('eu-gdpr', 'eu-eurlex', 'edpb-guidelines-9-2022', 'guidance',
 'EDPB Guidelines 9/2022 on Personal Data Breach Notification (Final Version)',
 'https://edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-92022-personal-data-breach-notification-under-gdpr_en',
 '2023-03-28', '2023-03-28', '{"summary": "Tightened cross-border coordination and non-EU controller duties."}', 'verified', 'relevant'),

('eu-gdpr', 'eu-eurlex', 'cjeu-schrems-ii', 'enforcement',
 'CJEU Judgment in Case C-311/18 (Data Protection Commissioner v Facebook Ireland and Maximillian Schrems)',
 'https://curia.europa.eu/juris/document/document.jsf?text=&docid=228677&pageIndex=0&doclang=EN&mode=req&dir=&occ=first&part=1&cid=9745484',
 '2020-07-16', '2020-07-16', '{"summary": "Invalidated EU-US Privacy Shield; mandated transfer impact assessments."}', 'verified', 'relevant'),

('eu-gdpr', 'eu-eurlex', 'commission-decision-2021-914', 'adopted',
 'Commission Implementing Decision (EU) 2021/914 on Standard Contractual Clauses',
 'https://eur-lex.europa.eu/eli/dec_impl/2021/914/oj',
 '2021-06-04', '2021-06-27', '{"summary": "Modernized SCCs with modular provisions for international data transfers."}', 'verified', 'relevant'),

('eu-gdpr', 'eu-eurlex', 'edpb-rec-01-2020', 'guidance',
 'EDPB Recommendations 01/2020 on Measures that Supplement Transfer Tools',
 'https://edpb.europa.eu/our-work-tools/our-documents/recommendations/recommendations-012020-measures-supplement-transfer_en',
 '2021-06-18', '2021-06-18', '{"summary": "Established technical and contractual safeguard roadmap post-Schrems II."}', 'verified', 'relevant'),

('eu-gdpr', 'eu-eurlex', 'eu-us-dpf-adequacy', 'adopted',
 'European Commission Adequacy Decision for the EU-US Data Privacy Framework',
 'https://ec.europa.eu/commission/presscorner/detail/en/ip_23_3721',
 '2023-07-10', '2023-07-10', '{"summary": "Restored simplified transatlantic transfer mechanism for certified entities."}', 'verified', 'relevant'),

-- SEC Events
('us-sec-rule-17a-4', 'us-federal-register', 'sec-worm-1997', 'effective',
 'SEC Electronic Storage Media Release No. 34-38245 (WORM Standard)',
 'https://www.sec.gov/rules/final/34-38245.txt',
 '1997-02-12', '1997-10-31', '{"summary": "Introduced non-rewriteable, non-erasable storage standards for broker-dealers."}', 'verified', 'relevant'),

('us-sec-rule-17a-4', 'us-federal-register', 'sec-interpretive-2003', 'guidance',
 'SEC Interpretive Release No. 34-47806 on Electronic Storage Media',
 'https://www.sec.gov/rules/interp/34-47806.htm',
 '2003-05-08', '2003-05-08', '{"summary": "Clarified compliance requirements for optical disks and optical storage systems."}', 'verified', 'relevant'),

('us-sec-rule-17a-4', 'us-federal-register', 'sec-audit-trail-2022', 'amended',
 'SEC Release No. 34-96034 Electronic Recordkeeping Requirements for Broker-Dealers',
 'https://www.sec.gov/rules/final/2022/34-96034.pdf',
 '2022-10-12', '2023-01-03', '{"summary": "Amended Rule 17a-4 to permit audit-trail electronic recordkeeping alongside WORM."}', 'verified', 'relevant'),

-- CCPA Events
('us-ccpa', 'ca-oag', 'ca-prop-24-cpra', 'adopted',
 'California Proposition 24 — California Privacy Rights Act of 2020',
 'https://oag.ca.gov/privacy/ccpa',
 '2020-11-03', '2023-01-01', '{"summary": "Passed by voters; created CPPA and expanded opt-out rights to cross-context sharing."}', 'verified', 'relevant'),

('us-ccpa', 'ca-oag', 'cppa-gpc-regs-2023', 'effective',
 'California Privacy Protection Agency Final Regulations (Title 11 CCR)',
 'https://cppa.ca.gov/regulations/',
 '2023-03-29', '2023-03-29', '{"summary": "Mandated recognition of Global Privacy Control (GPC) opt-out signals."}', 'verified', 'relevant'),

('us-ccpa', 'ca-oag', 'cppa-admt-regs-2026', 'effective',
 'CPPA Regulations on Automated Decisionmaking Technology and Risk Assessments',
 'https://cppa.ca.gov/meetings/materials/20241108_item3_proposed_text.pdf',
 '2025-09-23', '2026-01-01', '{"summary": "Approved by California OAL; establishes phased cybersecurity audit and ADMT opt-out requirements."}', 'verified', 'relevant'),

-- HIPAA Events
('us-hipaa-security-rule', 'us-federal-register', 'hipaa-sec-final-2003', 'effective',
 'Health Insurance Reform: Security Standards Final Rule (68 FR 8334)',
 'https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html',
 '2003-02-20', '2003-04-21', '{"summary": "Established national administrative, physical, and technical safeguards for ePHI."}', 'verified', 'relevant'),

('us-hipaa-security-rule', 'us-federal-register', 'hipaa-hitech-omnibus-2013', 'effective',
 'Modifications to the HIPAA Privacy, Security, Enforcement, and Breach Notification Rules (78 FR 5566)',
 'https://www.federalregister.gov/documents/2013/01/25/2013-01073/modifications-to-the-hipaa-privacy-security-enforcement-and-breach-notification-rules-under-the',
 '2013-01-25', '2013-03-26', '{"summary": "Direct statutory liability extended to business associates and subcontractors."}', 'verified', 'relevant'),

('us-hipaa-security-rule', 'us-federal-register', 'hipaa-safe-harbor-2021', 'amended',
 'Public Law 116-321 (H.R. 7898) Recognized Security Practices Amendment',
 'https://www.congress.gov/bill/116th-congress/house-bill/7898',
 '2021-01-05', '2021-01-05', '{"summary": "HHS required to consider recognized security practices in audits and fine calculations."}', 'verified', 'relevant'),

('us-hipaa-security-rule', 'us-federal-register', 'hipaa-sec-nprm-2024', 'proposed',
 'HHS Notice of Proposed Rulemaking on HIPAA Security Standards Modernization',
 'https://www.federalregister.gov/documents/2024/12/27/',
 '2024-12-27', NULL, '{"summary": "NPRM proposed mandatory multi-factor authentication, data encryption, and regular audits (proposed rule, not yet in force)."}', 'verified', 'relevant'),

-- SOX Events
('us-sox-act-2002', 'us-federal-register', 'sec-rule-13a-14-sox302', 'effective',
 'SEC Release 33-8238 Certification of Disclosure in Companies Quarterly and Annual Reports',
 'https://www.sec.gov/rules/final/33-8238.htm',
 '2003-06-05', '2003-08-14', '{"summary": "Implemented formal statutory certification requirement under Section 302."}', 'verified', 'relevant'),

('us-sox-act-2002', 'us-federal-register', 'sec-cyber-disclosure-2023', 'effective',
 'SEC Release No. 33-11216 Cybersecurity Risk Management, Strategy, Governance, and Incident Disclosure',
 'https://www.sec.gov/rules/final/2023/33-11216.pdf',
 '2023-07-26', '2023-09-05', '{"summary": "Mandated Item 1.05 Form 8-K disclosures for material cyber incidents, impacting executive certification."}', 'verified', 'relevant'),

-- Bangladesh Repeal Chain & Cyber Law Events
('bd-digital-security-act-2018', 'bd-bdlaws', 'bd-dsa-enactment-2018', 'published',
 'Enactment of the Digital Security Act 2018 (Act 46 of 2018)',
 'http://bdlaws.minlaw.gov.bd/act-1260.html',
 '2018-09-19', '2018-10-08', '{"summary": "Enacted as primary cyber regulation; included §26 identity safeguards."}', 'verified', 'relevant'),

('bd-cyber-security-act-2023', 'bd-bdlaws', 'bd-csa-enactment-2023', 'repealed',
 'Enactment of Cyber Security Act 2023 (Act 40 of 2023) Repealing DSA 2018',
 'http://bdlaws.minlaw.gov.bd/act-1454.html',
 '2023-09-13', '2023-09-18', '{"summary": "Section 64 repealed Digital Security Act 2018; retained modified offenses."}', 'verified', 'relevant'),

('bd-cyber-security-ordinance-2025', 'bd-bdlaws', 'bd-cso-ordinance-2025', 'effective',
 'Promulgation of Cyber Security Ordinance 2025 (Ordinance 25 of 2025) Repealing CSA 2023',
 'http://dpp.gov.bd/bgpress/index.php/document/extraordinary',
 '2025-05-21', '2025-05-21', '{"summary": "Repealed Cyber Security Act 2023; updated digital offense frameworks and state oversight."}', 'verified', 'relevant'),

('bd-labour-act-2006', 'bd-bdlaws', 'bd-labour-amendment-2013', 'amended',
 'Bangladesh Labour (Amendment) Act 2013 (Act 30 of 2013)',
 'http://bdlaws.minlaw.gov.bd/act-952.html',
 '2013-07-22', '2013-07-22', '{"summary": "Strengthened workplace safety and termination wage provisions."}', 'verified', 'relevant'),

('bd-labour-act-2006', 'bd-bdlaws', 'bd-labour-amendment-2018', 'amended',
 'Bangladesh Labour (Amendment) Act 2018 (Act 63 of 2018)',
 'http://bdlaws.minlaw.gov.bd/act-952.html',
 '2018-11-14', '2018-11-14', '{"summary": "Standardized notice periods and statutory calculations under Section 26."}', 'verified', 'relevant'),

-- EU AI Act & Omnibus Events
('eu-ai-act', 'eu-eurlex', 'eu-ai-act-publication-2024', 'effective',
 'Regulation (EU) 2024/1689 (Artificial Intelligence Act) Published in Official Journal',
 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj',
 '2024-07-12', '2024-08-01', '{"summary": "Entered into force 1 August 2024 with phased implementation timeline."}', 'verified', 'relevant'),

('eu-reg-2026-1744', 'eu-eurlex', 'eu-ai-omnibus-2026', 'effective',
 'Regulation (EU) 2026/1744 (Digital Omnibus on AI) Enacted',
 'https://eur-lex.europa.eu/eli/reg/2026/1744/oj',
 '2026-07-24', '2026-07-27', '{"summary": "Amended Regulation 2024/1689; moved Annex III high-risk compliance date to 2 December 2027."}', 'verified', 'relevant'),

-- Unverified / Secondary Items (marked unverified for cadence exclusion per T2.3)
('bd-bangladesh-bank-dps-2023', 'bd-bangladesh-bank', 'bb-eid-circular-2023', 'guidance',
 'Bangladesh Bank PSD Eid Circular on 2FA for Card-Not-Present Transactions',
 'https://www.bb.org.bd/en/index.php/mediaroom/circular',
 '2023-04-18', '2023-04-18', '{"summary": "Secondary reporting of consolidated payment circular unconfirmed; PSD-2 2FA requirement verified."}', 'unverified', 'relevant'),

('bd-personal-data-protection-ordinance-2025', 'bd-bdlaws', 'bd-pdpo-advisers-approval', 'adopted',
 'Council of Advisers Approval of Personal Data Protection Ordinance 2025 Draft',
 'http://dpp.gov.bd/bgpress/index.php/document/extraordinary',
 '2025-10-09', NULL, '{"summary": "Cabinet approval recorded; official gazette publication date pending verification."}', 'unverified', 'relevant')
ON CONFLICT (source_id, external_id) DO UPDATE SET
  title = EXCLUDED.title,
  url = EXCLUDED.url,
  verification = EXCLUDED.verification,
  triage_status = EXCLUDED.triage_status;
