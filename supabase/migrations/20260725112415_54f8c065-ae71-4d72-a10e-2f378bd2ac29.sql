
-- 1. Clear dependent rows in FK-safe order
DELETE FROM public.regulation_amendments;
DELETE FROM public.clauses WHERE contract_id IN (SELECT id FROM public.contracts WHERE is_sample = true);
DELETE FROM public.contracts WHERE is_sample = true;
DELETE FROM public.sample_clauses;
DELETE FROM public.sample_contracts;
DELETE FROM public.regulations;

-- 2. Insert the new 10 regulations (3 GDPR + 4 US + 3 Bangladesh)
INSERT INTO public.regulations (id, jurisdiction, title, summary, obligations, news_signal_boost) VALUES
('REG-GDPR-5', 'EU', 'GDPR Article 5 — Principles / Data Minimization',
 'Personal data must be adequate, relevant, and limited to what is necessary for the purpose it was collected for. Controllers must be able to demonstrate compliance with the principles of lawfulness, purpose limitation, accuracy, storage limitation, and integrity.',
 '["data_minimization","purpose_limitation","storage_limitation","accountability","accuracy"]'::jsonb, 0.05),
('REG-GDPR-33', 'EU', 'GDPR Article 33 — Personal Data Breach Notification',
 'A controller must notify the competent supervisory authority of a personal data breach without undue delay and, where feasible, within 72 hours of becoming aware of it. The notification must describe the nature, likely consequences, and mitigation measures.',
 '["72h_breach_notification","breach_documentation","risk_assessment","processor_notification"]'::jsonb, 0.10),
('REG-GDPR-44', 'EU', 'GDPR Article 44 — International Data Transfers',
 'Any transfer of personal data to a third country or international organization may take place only if the controller and processor comply with the transfer chapter, including adequacy decisions, appropriate safeguards, or specific derogations. The level of protection must not be undermined.',
 '["adequacy_or_safeguards","transfer_impact_assessment","onward_transfer_controls","data_subject_rights_preserved"]'::jsonb, 0.15),
('REG-SEC-17A4', 'US', 'SEC Rule 17a-4 — Broker-Dealer Records',
 'Broker-dealers must preserve specified records for prescribed periods in a non-rewriteable, non-erasable format (or an equivalent audit-trail electronic system) and provide a designated executive officer who can produce records on demand.',
 '["immutable_retention","audit_trail","designated_executive","prompt_production","offsite_backup"]'::jsonb, 0.08),
('REG-CCPA-1798.120', 'US', 'CCPA §1798.120 — Right to Opt Out of Sale/Sharing',
 'California consumers have the right to direct a business that sells or shares their personal information to third parties not to sell or share their personal information. Businesses must provide a clear and conspicuous opt-out link and honor global opt-out signals.',
 '["opt_out_link","global_privacy_control","sharing_disclosure","12_month_cooldown","minor_opt_in"]'::jsonb, 0.12),
('REG-HIPAA-SEC', 'US', 'HIPAA Security Rule (45 CFR §164.306–.312)',
 'Covered entities and business associates must implement administrative, physical, and technical safeguards to ensure the confidentiality, integrity, and availability of electronic protected health information, and must document policies, workforce training, and incident response.',
 '["access_controls","audit_controls","encryption_in_transit_and_at_rest","risk_analysis","workforce_training","incident_response"]'::jsonb, 0.14),
('REG-SOX-302', 'US', 'SOX §302 — Officer Certification',
 'The principal executive and financial officers of an issuer must personally certify each quarterly and annual report, including the design and effectiveness of disclosure controls and internal control over financial reporting, and disclose any material weaknesses to the audit committee.',
 '["officer_certification","disclosure_controls","icfr_assessment","audit_committee_disclosure"]'::jsonb, 0.06),
('REG-BB-DPS-2023', 'BD', 'Bangladesh Bank Digital Payment Security Circular (2023)',
 'Payment service providers and banks offering digital payment products in Bangladesh must implement layered authentication, transaction monitoring, tokenization of card data, and incident reporting to Bangladesh Bank within 6 hours of a material security event.',
 '["strong_customer_authentication","tokenization","transaction_monitoring","6h_incident_report","customer_liability_limits"]'::jsonb, 0.09),
('REG-BD-DSA-2018', 'BD', 'Digital Security Act 2018 §26 — Unauthorized Use of Identity Information',
 'Collecting, selling, holding, transferring, or using another person''s identity information without lawful authority is an offense. Service providers must implement reasonable safeguards over identity information they hold and cooperate with investigating authorities on lawful production requests.',
 '["identity_info_safeguards","lawful_production","data_localization_option","incident_cooperation"]'::jsonb, 0.11),
('REG-BD-LA-2006', 'BD', 'Bangladesh Labour Act 2006 §26 — Notice of Termination',
 'A permanent worker may be terminated with 120 days'' written notice (or wages in lieu) and a temporary worker with 30 days'' notice. The employer must provide the reason in writing, pay compensation, and deposit dues within the statutory period.',
 '["written_notice_period","reason_in_writing","statutory_compensation","dues_deposit_timeline"]'::jsonb, 0.04);

-- 3. Insert amendment history (~40 rows), grounded in real public record where possible
INSERT INTO public.regulation_amendments (regulation_id, amended_on, summary, direction) VALUES
-- GDPR-5
('REG-GDPR-5', '2019-02-13', 'EDPB Guidelines 4/2019 on data protection by design and by default reinforced the minimization principle as an engineering requirement.', 'clarified'),
('REG-GDPR-5', '2020-09-07', 'EDPB Guidelines 07/2020 on the concepts of controller/processor sharpened responsibility for minimization across joint operations.', 'clarified'),
('REG-GDPR-5', '2022-05-18', 'EDPB Guidelines 05/2022 on facial recognition in law enforcement extended minimization expectations to biometric templates.', 'tightened'),
('REG-GDPR-5', '2023-10-24', 'EDPB opinion on the use of personal data in AdTech tightened acceptable retention and profiling scopes under Article 5.', 'tightened'),
-- GDPR-33
('REG-GDPR-33', '2018-02-06', 'WP29 Guidelines on personal data breach notification finalized before GDPR became applicable.', 'clarified'),
('REG-GDPR-33', '2019-10-01', 'EDPB endorsed the WP29 breach notification guidelines as its own, giving them formal standing.', 'clarified'),
('REG-GDPR-33', '2021-01-14', 'EDPB Guidelines 01/2021 published 18 worked breach examples, expanding what qualifies as a notifiable event.', 'expanded'),
('REG-GDPR-33', '2023-03-28', 'EDPB Guidelines 9/2022 (final version) tightened non-EU controller notification duties and cross-border coordination.', 'tightened'),
-- GDPR-44
('REG-GDPR-44', '2020-07-16', 'CJEU Schrems II invalidated Privacy Shield and required transfer impact assessments for SCC-based transfers.', 'tightened'),
('REG-GDPR-44', '2021-06-04', 'Commission Decision 2021/914 adopted new modular Standard Contractual Clauses.', 'expanded'),
('REG-GDPR-44', '2021-06-18', 'EDPB Recommendations 01/2020 on supplementary measures set out mandatory technical and organizational controls for third-country transfers.', 'tightened'),
('REG-GDPR-44', '2023-07-10', 'Commission adopted the EU-US Data Privacy Framework adequacy decision, restoring a simplified transfer path to certified US importers.', 'loosened'),
('REG-GDPR-44', '2024-03-14', 'EDPB clarified onward-transfer obligations for DPF-certified importers, closing an ambiguity in the July 2023 decision.', 'clarified'),
-- SEC-17A4
('REG-SEC-17A4', '1997-10-31', 'SEC introduced electronic storage requirements including the original non-rewriteable, non-erasable (WORM) standard.', 'tightened'),
('REG-SEC-17A4', '2003-05-08', 'SEC issued interpretive guidance clarifying acceptable electronic storage technologies under 17a-4(f).', 'clarified'),
('REG-SEC-17A4', '2022-10-12', 'SEC adopted amendments allowing an audit-trail alternative to WORM storage for records retention.', 'loosened'),
('REG-SEC-17A4', '2023-11-17', 'Conforming amendments aligned 17a-4 preservation periods with related recordkeeping rules for security-based swap dealers.', 'clarified'),
-- CCPA-1798.120
('REG-CCPA-1798.120', '2020-11-03', 'California voters passed Proposition 24 (CPRA), extending the opt-out right to cover data sharing for cross-context behavioral advertising.', 'expanded'),
('REG-CCPA-1798.120', '2023-01-01', 'CPRA amendments to §1798.120 took effect, expanding the covered categories and triggering the sensitive personal information regime.', 'tightened'),
('REG-CCPA-1798.120', '2023-03-29', 'CPPA final regulations under §7026 mandated Global Privacy Control recognition and layered opt-out UX.', 'tightened'),
('REG-CCPA-1798.120', '2024-11-08', 'CPPA proposed rules on automated decisionmaking technology extended opt-out coverage to certain ADMT uses.', 'tightened'),
-- HIPAA-SEC
('REG-HIPAA-SEC', '2003-04-21', 'HIPAA Security Rule became effective, establishing the administrative, physical, and technical safeguards framework.', 'tightened'),
('REG-HIPAA-SEC', '2013-01-25', 'HITECH Omnibus Rule extended Security Rule obligations directly to business associates and subcontractors.', 'expanded'),
('REG-HIPAA-SEC', '2021-01-05', 'HITECH amendment created a safe harbor requiring HHS to consider recognized security practices when assessing fines.', 'loosened'),
('REG-HIPAA-SEC', '2024-12-27', 'HHS NPRM proposed mandatory encryption, MFA, and asset-inventory updates to the Security Rule.', 'tightened'),
-- SOX-302
('REG-SOX-302', '2003-08-14', 'SEC Rule 13a-14 implemented the §302 officer certification requirement across periodic reports.', 'clarified'),
('REG-SOX-302', '2007-06-27', 'PCAOB Auditing Standard No. 5 replaced AS 2, reducing internal-control audit scope for smaller filers.', 'loosened'),
('REG-SOX-302', '2020-03-25', 'SEC granted conditional 45-day filing relief in response to COVID-19 operational disruptions.', 'loosened'),
('REG-SOX-302', '2023-07-26', 'SEC cybersecurity disclosure rule amendments cross-reference §302 for material cyber incident certification.', 'expanded'),
-- BB-DPS-2023
('REG-BB-DPS-2023', '2016-06-19', 'Bangladesh Bank PSD Circular Letter No. 03 issued initial digital payment security guidelines.', 'clarified'),
('REG-BB-DPS-2023', '2019-09-04', 'BRPD Circular on cyber security for scheduled banks introduced mandatory board-level cyber governance.', 'tightened'),
('REG-BB-DPS-2023', '2023-01-31', 'Bangladesh Bank issued the consolidated Digital Payment Security Circular replacing prior instructions.', 'tightened'),
('REG-BB-DPS-2023', '2023-11-16', 'Annexure introduced mandatory tokenization for stored card credentials and cross-border wallet flows.', 'tightened'),
('REG-BB-DPS-2023', '2024-06-25', 'Updated guideline expanded reporting scope to include cross-border digital wallets and remittance corridors.', 'expanded'),
-- BD-DSA-2018
('REG-BD-DSA-2018', '2020-05-13', 'MoICT rules under the DSA clarified procedural safeguards for §26 lawful production requests.', 'clarified'),
('REG-BD-DSA-2018', '2023-09-13', 'Cyber Security Act 2023 replaced parts of the DSA, softening some penalties while retaining §26 identity-info offense.', 'loosened'),
('REG-BD-DSA-2018', '2024-02-01', 'Draft rules on identity information storage introduced stronger local storage and audit requirements.', 'tightened'),
-- BD-LA-2006
('REG-BD-LA-2006', '2013-07-22', 'Amendment Act 2013 expanded worker protections including strengthened notice and compensation on termination.', 'expanded'),
('REG-BD-LA-2006', '2018-11-14', 'Amendment Act 2018 reformed §26 notice periods and tightened wages-in-lieu computation.', 'tightened'),
('REG-BD-LA-2006', '2022-01-20', 'Bangladesh Labour Rules 2022 clarified retrenchment procedure and dues-deposit timelines.', 'clarified');

-- 4. Insert 15 new sample_contracts
INSERT INTO public.sample_contracts (id, name, counterparty, value, position) VALUES
('SC-001', 'Data Processing Agreement — Helix Analytics (EU SaaS)', 'Helix Analytics BV', 12500000, 0),
('SC-002', 'Standard Contractual Clauses Addendum — Aegis Cloud',   'Aegis Cloud GmbH',   9800000, 1),
('SC-003', 'Consumer Terms of Service — EU Consumers',              'Nord Retail S.A.',   4200000, 2),
('SC-004', 'Employee Privacy Notice — EU Workforce',                'Internal — DE/FR HR', 1800000, 3),
('SC-005', 'Consumer Privacy Notice — California',                  'Internal — US Legal', 2600000, 4),
('SC-006', 'Adtech Data-Sharing Agreement — Pinecrest Media',       'Pinecrest Media Inc.', 6400000, 5),
('SC-007', 'Business Associate Agreement — Cedar Health',           'Cedar Health Systems, LLC', 15750000, 6),
('SC-008', 'Cloud Hosting Master Agreement — HealthStack',          'HealthStack Cloud, Inc.', 22000000, 7),
('SC-009', 'Broker-Dealer Recordkeeping SLA — Ridgefield Securities','Ridgefield Securities LLC', 3400000, 8),
('SC-010', 'Audit Committee Charter — Ridgefield Holdings',         'Ridgefield Holdings, Inc.', 950000, 9),
('SC-011', 'Merchant Acquiring Agreement — bKash Payments',         'bKash Limited',       18300000, 10),
('SC-012', 'Mobile Wallet Terms of Use — Nagad Consumers',          'Nagad Limited',       5900000, 11),
('SC-013', 'ISP Data-Retention Compliance Policy — GrameenNet',     'GrameenNet Communications Ltd.', 2200000, 12),
('SC-014', 'Fixed-Term Employment Contract — Padma Knitwear',       'Padma Knitwear Mills Ltd.', 420000, 13),
('SC-015', 'Cross-Border Support Services Agreement — BD→EU flow',  'Delta Support Services Ltd. → Helix Analytics BV', 7800000, 14);

-- 5. Insert sample_clauses (3–4 per contract, ~52 rows)
INSERT INTO public.sample_clauses (id, sample_contract_id, text, linked_regs, position) VALUES
-- SC-001: DPA — GDPR-5, 33, 44
('SCL-001-0', 'SC-001', 'Processor shall process personal data only on documented instructions from Controller and only for the purposes set out in Annex I, and shall not retain personal data beyond the retention periods specified therein.', ARRAY['REG-GDPR-5'], 0),
('SCL-001-1', 'SC-001', 'Processor shall notify Controller of any personal data breach without undue delay and in any event within 24 hours of becoming aware of it, providing the information necessary for Controller to comply with its notification obligation to the competent supervisory authority within 72 hours.', ARRAY['REG-GDPR-33'], 1),
('SCL-001-2', 'SC-001', 'Any transfer of personal data by Processor to a country outside the European Economic Area shall be made only under the Standard Contractual Clauses attached as Annex III, and Processor shall carry out a transfer impact assessment prior to any such transfer.', ARRAY['REG-GDPR-44'], 2),
('SCL-001-3', 'SC-001', 'Processor shall assist Controller in demonstrating compliance with the principles of lawfulness, fairness, transparency, purpose limitation, and data minimization, and shall make available all information reasonably necessary to demonstrate such compliance.', ARRAY['REG-GDPR-5'], 3),
-- SC-002: SCC Addendum — GDPR-44
('SCL-002-0', 'SC-002', 'The parties adopt the Standard Contractual Clauses set out in Commission Implementing Decision (EU) 2021/914, Module Two (controller to processor), as incorporated herein by reference.', ARRAY['REG-GDPR-44'], 0),
('SCL-002-1', 'SC-002', 'Data importer represents that it has no reason to believe that the laws and practices in the destination country prevent it from fulfilling its obligations under these Clauses, and shall notify data exporter promptly if such circumstances change.', ARRAY['REG-GDPR-44'], 1),
('SCL-002-2', 'SC-002', 'Data importer shall implement the supplementary technical and organizational measures set out in Annex II, including end-to-end encryption of personal data in transit and pseudonymization prior to any government access request.', ARRAY['REG-GDPR-44'], 2),
-- SC-003: EU consumer ToS — GDPR-5, 33
('SCL-003-0', 'SC-003', 'We collect only the personal data strictly necessary to provide and secure the Services described in Section 2, and we retain it only for the periods disclosed in our Privacy Notice.', ARRAY['REG-GDPR-5'], 0),
('SCL-003-1', 'SC-003', 'In the event of a personal data breach that is likely to result in a risk to your rights and freedoms, we will notify the competent supervisory authority within 72 hours and, where the risk is high, notify affected users without undue delay.', ARRAY['REG-GDPR-33'], 1),
('SCL-003-2', 'SC-003', 'This Agreement shall be governed by the laws of the member state in which you have your habitual residence, without prejudice to any mandatory consumer protection provisions.', ARRAY[]::text[], 2),
-- SC-004: EU Employee Privacy Notice — GDPR-5
('SCL-004-0', 'SC-004', 'The Company processes employee personal data solely for purposes strictly necessary to the employment relationship, including payroll, benefits administration, performance management, and legal compliance, in accordance with the principle of data minimization.', ARRAY['REG-GDPR-5'], 0),
('SCL-004-1', 'SC-004', 'Special category data (such as health data collected for sick leave certification) is processed only where necessary for carrying out obligations under employment and social security law and is retained no longer than statutorily required.', ARRAY['REG-GDPR-5'], 1),
('SCL-004-2', 'SC-004', 'Employees may exercise their rights of access, rectification, erasure, and objection by contacting the Data Protection Officer at the address set forth on the Company intranet.', ARRAY[]::text[], 2),
-- SC-005: California Privacy Notice — CCPA
('SCL-005-0', 'SC-005', 'California residents have the right to direct us not to sell or share their personal information. To exercise this right, use the "Do Not Sell or Share My Personal Information" link at the footer of every page of the Service.', ARRAY['REG-CCPA-1798.120'], 0),
('SCL-005-1', 'SC-005', 'We honor opt-out preference signals transmitted through Global Privacy Control (GPC), and treat any such signal as a valid opt-out request under §1798.120 for the browser or device from which it is received.', ARRAY['REG-CCPA-1798.120'], 1),
('SCL-005-2', 'SC-005', 'We do not knowingly sell or share the personal information of consumers under 16 years of age without affirmative authorization in accordance with §1798.120(c).', ARRAY['REG-CCPA-1798.120'], 2),
('SCL-005-3', 'SC-005', 'Verifiable consumer requests may be submitted through the online request portal or by calling the toll-free number published in Section 12 of this Notice.', ARRAY[]::text[], 3),
-- SC-006: Adtech data-sharing — CCPA + GDPR-44
('SCL-006-0', 'SC-006', 'Partner may receive Site Data for the purpose of cross-context behavioral advertising as defined under the CCPA; such disclosure is deemed a "sharing" for which each user has the right to opt out.', ARRAY['REG-CCPA-1798.120'], 0),
('SCL-006-1', 'SC-006', 'Partner shall pass through and honor any opt-out preference signal, including GPC, and shall not enable downstream monetization of the affected identifier for at least 12 months.', ARRAY['REG-CCPA-1798.120'], 1),
('SCL-006-2', 'SC-006', 'Where Site Data relates to identifiable EU data subjects, Partner shall not transfer such data outside the EEA except under an adequacy decision or Standard Contractual Clauses accompanied by a documented transfer impact assessment.', ARRAY['REG-GDPR-44'], 2),
('SCL-006-3', 'SC-006', 'Partner shall provide monthly attestation reports listing the number of opt-out signals received and the corresponding suppression actions taken.', ARRAY['REG-CCPA-1798.120'], 3),
-- SC-007: BAA — HIPAA
('SCL-007-0', 'SC-007', 'Business Associate shall implement administrative, physical, and technical safeguards that reasonably and appropriately protect the confidentiality, integrity, and availability of electronic protected health information it creates, receives, maintains, or transmits on behalf of Covered Entity.', ARRAY['REG-HIPAA-SEC'], 0),
('SCL-007-1', 'SC-007', 'Business Associate shall report any Security Incident of which it becomes aware to Covered Entity within 24 hours, and shall report any Breach of Unsecured PHI without unreasonable delay and no later than 30 calendar days after discovery.', ARRAY['REG-HIPAA-SEC'], 1),
('SCL-007-2', 'SC-007', 'Business Associate shall ensure that any subcontractor that creates, receives, maintains, or transmits Electronic PHI on its behalf agrees in writing to the same restrictions and conditions that apply to Business Associate.', ARRAY['REG-HIPAA-SEC'], 2),
('SCL-007-3', 'SC-007', 'Business Associate shall encrypt Electronic PHI at rest and in transit using algorithms consistent with NIST SP 800-111 and SP 800-52, respectively.', ARRAY['REG-HIPAA-SEC'], 3),
-- SC-008: Cloud hosting — HIPAA + GDPR-33
('SCL-008-0', 'SC-008', 'Provider shall maintain SOC 2 Type II and HITRUST attestations covering all in-scope services and shall provide Customer with the latest reports upon request.', ARRAY['REG-HIPAA-SEC'], 0),
('SCL-008-1', 'SC-008', 'Provider shall notify Customer of any confirmed unauthorized access to Customer content within 6 hours of confirmation, and shall provide sufficient information for Customer to comply with its 72-hour supervisory-authority notification obligation.', ARRAY['REG-HIPAA-SEC','REG-GDPR-33'], 1),
('SCL-008-2', 'SC-008', 'Provider shall not access, use, or disclose Customer content except as necessary to maintain or provide the Services, or as required by applicable law after providing Customer with prompt notice unless legally prohibited.', ARRAY['REG-HIPAA-SEC'], 2),
('SCL-008-3', 'SC-008', 'Data at rest shall be encrypted using AES-256 with keys managed under a FIPS 140-2 Level 2 or higher validated module.', ARRAY['REG-HIPAA-SEC'], 3),
-- SC-009: Broker-dealer recordkeeping — SEC-17A4 + SOX-302
('SCL-009-0', 'SC-009', 'Service Provider shall preserve all books and records specified in Schedule A in a non-rewriteable, non-erasable format, or in an electronic recordkeeping system that maintains a complete, time-stamped audit trail of all record modifications, in either case for the periods prescribed by SEC Rule 17a-4.', ARRAY['REG-SEC-17A4'], 0),
('SCL-009-1', 'SC-009', 'Service Provider shall designate at least one executive officer who has independent access to the required records and who is authorized to promptly produce such records to the Commission upon request.', ARRAY['REG-SEC-17A4'], 1),
('SCL-009-2', 'SC-009', 'Service Provider shall provide sufficient documentation of controls over the preservation systems described herein to enable Client''s principal executive and financial officers to certify the effectiveness of Client''s disclosure controls and internal control over financial reporting.', ARRAY['REG-SOX-302','REG-SEC-17A4'], 2),
('SCL-009-3', 'SC-009', 'Service Provider shall maintain an offsite backup of preserved records that can be restored to a fully readable state within 24 hours of a documented request.', ARRAY['REG-SEC-17A4'], 3),
-- SC-010: Audit Committee Charter — SOX-302
('SCL-010-0', 'SC-010', 'The Audit Committee shall review, prior to filing, the quarterly and annual reports of the Company and the certifications required to be delivered by the principal executive officer and principal financial officer pursuant to §302 of the Sarbanes-Oxley Act.', ARRAY['REG-SOX-302'], 0),
('SCL-010-1', 'SC-010', 'The Committee shall receive from management, at least quarterly, an assessment of the design and operating effectiveness of the Company''s disclosure controls and procedures and internal control over financial reporting.', ARRAY['REG-SOX-302'], 1),
('SCL-010-2', 'SC-010', 'The Committee shall be promptly informed of any material weakness in internal control over financial reporting and any fraud, whether or not material, that involves management or other employees with a significant role in internal control.', ARRAY['REG-SOX-302'], 2),
-- SC-011: Merchant acquiring BD — BB-DPS-2023
('SCL-011-0', 'SC-011', 'Merchant shall implement transaction authentication mechanisms consistent with the Bangladesh Bank Digital Payment Security Circular, including two-factor authentication for all customer-initiated transactions above BDT 5,000.', ARRAY['REG-BB-DPS-2023'], 0),
('SCL-011-1', 'SC-011', 'Acquirer shall tokenize primary account numbers at the point of capture and shall not permit storage of full PANs on merchant systems.', ARRAY['REG-BB-DPS-2023'], 1),
('SCL-011-2', 'SC-011', 'Merchant shall report any confirmed security incident affecting the payment environment to Acquirer and to Bangladesh Bank within 6 hours of confirmation.', ARRAY['REG-BB-DPS-2023'], 2),
('SCL-011-3', 'SC-011', 'Chargebacks arising from unauthorized transactions where the merchant failed to enforce required authentication shall be borne by Merchant.', ARRAY['REG-BB-DPS-2023'], 3),
-- SC-012: Mobile wallet ToS BD — BB-DPS-2023, DSA-2018
('SCL-012-0', 'SC-012', 'Users must complete identity verification using a government-issued National ID or biometric registration in accordance with the applicable KYC guidelines before the wallet may be activated for peer transfers.', ARRAY['REG-BB-DPS-2023'], 0),
('SCL-012-1', 'SC-012', 'The Company shall implement reasonable safeguards over identity information collected in connection with wallet registration and shall not sell, transfer, or use such information for purposes other than those disclosed to the user or required by lawful authority.', ARRAY['REG-BD-DSA-2018'], 1),
('SCL-012-2', 'SC-012', 'The Company will cooperate with lawful production requests from designated investigating authorities under §26 of the Digital Security Act 2018 upon receipt of a written order specifying the identity information sought.', ARRAY['REG-BD-DSA-2018'], 2),
('SCL-012-3', 'SC-012', 'Any incident that materially affects the confidentiality or availability of user funds or credentials will be reported to Bangladesh Bank within 6 hours of confirmation.', ARRAY['REG-BB-DPS-2023'], 3),
-- SC-013: ISP data-retention policy BD — DSA-2018
('SCL-013-0', 'SC-013', 'Subscriber identity information shall be retained in accordance with statutory retention orders and shall be released only in response to a written lawful production request from an authorized officer.', ARRAY['REG-BD-DSA-2018'], 0),
('SCL-013-1', 'SC-013', 'Access to stored identity information shall be limited to a documented list of authorized personnel; all access shall be logged and reviewed monthly.', ARRAY['REG-BD-DSA-2018'], 1),
('SCL-013-2', 'SC-013', 'Copies of any material provided under §26 lawful production requests shall be retained for at least three years together with the underlying request.', ARRAY['REG-BD-DSA-2018'], 2),
-- SC-014: Fixed-term employment BD — LA-2006
('SCL-014-0', 'SC-014', 'This engagement is a permanent worker engagement within the meaning of §4 of the Bangladesh Labour Act 2006. Either party may terminate this engagement upon 120 days'' written notice, or payment of wages in lieu of such notice.', ARRAY['REG-BD-LA-2006'], 0),
('SCL-014-1', 'SC-014', 'Where termination is initiated by the Employer, the reason for termination shall be recorded in writing and communicated to the Worker.', ARRAY['REG-BD-LA-2006'], 1),
('SCL-014-2', 'SC-014', 'Statutory compensation, wages due, and any leave encashment payable to the Worker shall be deposited in the Worker''s designated bank account within 30 days of the effective date of termination.', ARRAY['REG-BD-LA-2006'], 2),
-- SC-015: Cross-border support BD→EU — LA-2006 + GDPR-44
('SCL-015-0', 'SC-015', 'Service Provider shall provide customer support services from its Dhaka delivery center to Customer''s data subjects located in the European Economic Area, on the terms set out in the applicable Statement of Work.', ARRAY[]::text[], 0),
('SCL-015-1', 'SC-015', 'Where Service Provider''s personnel access personal data of EU data subjects, such access constitutes a transfer under Article 44 GDPR and shall be governed by the Standard Contractual Clauses in Annex II supplemented by the technical measures in Annex III.', ARRAY['REG-GDPR-44'], 1),
('SCL-015-2', 'SC-015', 'Termination of any support agent engaged under this Agreement shall comply with the notice, written-reason, and dues-deposit obligations of §26 of the Bangladesh Labour Act 2006 and shall not disrupt the continuity obligations owed to Customer.', ARRAY['REG-BD-LA-2006'], 2),
('SCL-015-3', 'SC-015', 'Service Provider shall implement the pseudonymization and access-logging measures in Annex III prior to any onward transfer, whether internal or external.', ARRAY['REG-GDPR-44'], 3);

-- 6. Reseed every existing organization from the new sample_* templates
DO $$
DECLARE
  v_org record;
  v_sc  record;
  v_new_contract_id uuid;
  v_uploader uuid;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations LOOP
    SELECT id INTO v_uploader FROM public.profiles WHERE org_id = v_org.id LIMIT 1;
    FOR v_sc IN SELECT * FROM public.sample_contracts ORDER BY position LOOP
      INSERT INTO public.contracts (org_id, name, counterparty, value, extraction_status, is_sample, uploaded_by)
      VALUES (v_org.id, v_sc.name, v_sc.counterparty, v_sc.value, 'complete', true, v_uploader)
      RETURNING id INTO v_new_contract_id;

      INSERT INTO public.clauses (contract_id, text, linked_regs, position, confidence)
      SELECT v_new_contract_id, scl.text, scl.linked_regs, scl.position, 1.0
      FROM public.sample_clauses scl
      WHERE scl.sample_contract_id = v_sc.id
      ORDER BY scl.position;
    END LOOP;
  END LOOP;
END $$;
