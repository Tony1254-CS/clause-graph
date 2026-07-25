
-- 1. Extend regulations
ALTER TABLE public.regulations
  ADD COLUMN IF NOT EXISTS news_signal_boost numeric NOT NULL DEFAULT 0
    CHECK (news_signal_boost >= 0 AND news_signal_boost <= 1);

-- 2. Extend simulation_runs
ALTER TABLE public.simulation_runs
  ADD COLUMN IF NOT EXISTS run_type text NOT NULL DEFAULT 'reactive'
    CHECK (run_type IN ('reactive','forecast','what_if'));

-- 3. Amendment history table
CREATE TABLE public.regulation_amendments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  regulation_id text NOT NULL REFERENCES public.regulations(id) ON DELETE CASCADE,
  amended_on date NOT NULL,
  summary text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('tightened','loosened','clarified','expanded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX regulation_amendments_reg_idx
  ON public.regulation_amendments(regulation_id, amended_on DESC);

GRANT SELECT ON public.regulation_amendments TO authenticated;
GRANT ALL ON public.regulation_amendments TO service_role;

ALTER TABLE public.regulation_amendments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Any authenticated user can read amendment history"
  ON public.regulation_amendments
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Seed amendment history (public record; realistic dates, directional patterns)
INSERT INTO public.regulation_amendments (regulation_id, amended_on, summary, direction) VALUES
  ('REG-GDPR-32', '2018-05-25', 'GDPR Article 32 enters into force replacing the 1995 Data Protection Directive.', 'tightened'),
  ('REG-GDPR-32', '2021-06-04', 'EDPB Guidelines 01/2021 clarify appropriate technical and organisational measures for data controllers.', 'clarified'),
  ('REG-GDPR-32', '2023-11-27', 'EDPB expanded guidance on encryption of data at rest and in transit for high-risk processing.', 'expanded'),

  ('REG-SEC-10B5', '2000-08-15', 'Rule 10b5-1 and 10b5-2 added, defining trading plans and duties of trust or confidence.', 'clarified'),
  ('REG-SEC-10B5', '2022-12-14', 'SEC adopted amendments to 10b5-1 introducing cooling-off periods and enhanced disclosure requirements.', 'tightened'),

  ('REG-SEC-REGBI', '2019-06-05', 'Regulation Best Interest adopted, replacing the previous suitability standard.', 'tightened'),
  ('REG-SEC-REGBI', '2023-01-30', 'SEC staff bulletin reinforced conflicts-of-interest obligations under Reg BI.', 'clarified'),

  ('REG-SEC-REGSHO', '2005-01-03', 'Regulation SHO effective, replacing legacy short-sale rules.', 'tightened'),
  ('REG-SEC-REGSHO', '2010-02-24', 'Alternative uptick rule (Rule 201) added, restricting short sales after 10% declines.', 'tightened'),
  ('REG-SEC-REGSHO', '2023-10-13', 'SEC adopted Rule 13f-2 requiring institutional short-position reporting.', 'expanded'),

  ('REG-SOX-302', '2002-07-30', 'Sarbanes-Oxley §302 enacted, mandating principal officer certifications.', 'tightened'),
  ('REG-SOX-302', '2018-05-24', 'PCAOB AS 2201 updated internal-control-over-financial-reporting audit standards.', 'clarified'),

  ('REG-FINRA-4511', '2011-12-05', 'FINRA Rule 4511 adopted, consolidating NASD/NYSE record-keeping requirements.', 'clarified'),
  ('REG-FINRA-4511', '2022-10-11', 'FINRA extended electronic recordkeeping requirements to cover business text messaging.', 'expanded'),

  ('REG-CFTC-P45', '2012-01-13', 'CFTC Part 45 adopted, establishing swap data reporting under Dodd-Frank.', 'tightened'),
  ('REG-CFTC-P45', '2020-11-25', 'CFTC amended Part 45 harmonising with CPMI-IOSCO critical data elements.', 'clarified'),
  ('REG-CFTC-P45', '2023-12-04', 'CFTC finalised Phase II amendments expanding UPI and reporting fields.', 'expanded'),

  ('REG-DODD-VOLCKER', '2013-12-10', 'Volcker Rule final rules jointly adopted by five agencies.', 'tightened'),
  ('REG-DODD-VOLCKER', '2019-11-14', 'Agencies simplified Volcker Rule compliance program requirements (Volcker 2.0).', 'loosened'),
  ('REG-DODD-VOLCKER', '2020-06-25', 'Covered-fund provisions revised, expanding permitted activities.', 'loosened'),

  ('REG-BASEL3-CAPITAL', '2013-07-02', 'US agencies finalised Basel III capital rule implementation.', 'tightened'),
  ('REG-BASEL3-CAPITAL', '2019-10-29', 'Tailoring rule adjusted capital requirements by bank category.', 'loosened'),
  ('REG-BASEL3-CAPITAL', '2023-07-27', 'Agencies proposed Basel III endgame amendments expanding standardised risk-weighting.', 'tightened'),

  ('REG-EU-MIFID2-24', '2018-01-03', 'MiFID II entered into force replacing MiFID I conduct requirements.', 'tightened'),
  ('REG-EU-MIFID2-24', '2022-02-28', 'ESMA guidelines on MiFID II product governance updated for sustainability preferences.', 'expanded'),
  ('REG-EU-MIFID2-24', '2024-03-08', 'MiFIR/MiFID II Review adopted, revising research-payment and best-execution rules.', 'clarified');

-- 5. Editorial news-signal boost — hand-set for demo credibility.
-- (Basel III endgame and GDPR are active regulatory battlegrounds in 2026.)
UPDATE public.regulations SET news_signal_boost = 0.35 WHERE id = 'REG-BASEL3-CAPITAL';
UPDATE public.regulations SET news_signal_boost = 0.28 WHERE id = 'REG-GDPR-32';
UPDATE public.regulations SET news_signal_boost = 0.22 WHERE id = 'REG-SEC-REGSHO';
UPDATE public.regulations SET news_signal_boost = 0.15 WHERE id = 'REG-EU-MIFID2-24';
UPDATE public.regulations SET news_signal_boost = 0.10 WHERE id = 'REG-CFTC-P45';
