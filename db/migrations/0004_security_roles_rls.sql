-- 0004_security_roles_rls.sql
-- Creates the non-superuser application role and configures Row-Level Security (RLS) on tenant tables

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'clausegraph_app') THEN
    CREATE ROLE clausegraph_app WITH LOGIN PASSWORD 'clausegraph_app_dev_pw' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO clausegraph_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO clausegraph_app;

-- Grant read-only access to reference ontology tables
GRANT SELECT ON TABLE
  public.sources,
  public.legal_instruments,
  public.instrument_versions,
  public.provisions,
  public.obligations,
  public.regulatory_events,
  public.legacy_reg_map,
  public.regulations,
  public.regulation_amendments,
  public.sample_contracts,
  public.sample_clauses
TO clausegraph_app;

-- Grant CRUD on tenant and operational tables
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.organizations,
  public.profiles,
  public.contracts,
  public.clauses,
  public.simulation_runs,
  public.impact_assessments,
  public.compliance_artifacts,
  public.invitations,
  public.supply_chain_nodes,
  public.supply_chain_edges,
  public.jobs
TO clausegraph_app;

-- Grant append-only access to audit_log
GRANT SELECT, INSERT ON TABLE public.audit_log TO clausegraph_app;

-- ── Enable Row-Level Security on Tenant Tables ─────────────────────────────
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_chain_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_chain_edges ENABLE ROW LEVEL SECURITY;

-- Helper function to extract current tenant org id from GUC app.org_id safely
CREATE OR REPLACE FUNCTION public.current_app_org_id()
RETURNS uuid AS $$
BEGIN
  RETURN NULLIF(current_setting('app.org_id', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Contracts Policy
DROP POLICY IF EXISTS contracts_tenant_policy ON public.contracts;
CREATE POLICY contracts_tenant_policy ON public.contracts
  USING (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- Clauses Policy (joins to contract)
DROP POLICY IF EXISTS clauses_tenant_policy ON public.clauses;
CREATE POLICY clauses_tenant_policy ON public.clauses
  USING (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = clauses.contract_id
        AND (c.org_id = public.current_app_org_id() OR current_setting('app.bypass_rls', true) = 'on')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = clauses.contract_id
        AND (c.org_id = public.current_app_org_id() OR current_setting('app.bypass_rls', true) = 'on')
    )
  );

-- Simulation Runs Policy
DROP POLICY IF EXISTS simulation_runs_tenant_policy ON public.simulation_runs;
CREATE POLICY simulation_runs_tenant_policy ON public.simulation_runs
  USING (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- Impact Assessments Policy
DROP POLICY IF EXISTS impact_assessments_tenant_policy ON public.impact_assessments;
CREATE POLICY impact_assessments_tenant_policy ON public.impact_assessments
  USING (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- Compliance Artifacts Policy
DROP POLICY IF EXISTS compliance_artifacts_tenant_policy ON public.compliance_artifacts;
CREATE POLICY compliance_artifacts_tenant_policy ON public.compliance_artifacts
  USING (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- Invitations Policy
DROP POLICY IF EXISTS invitations_tenant_policy ON public.invitations;
CREATE POLICY invitations_tenant_policy ON public.invitations
  USING (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- Supply Chain Nodes Policy
DROP POLICY IF EXISTS supply_chain_nodes_tenant_policy ON public.supply_chain_nodes;
CREATE POLICY supply_chain_nodes_tenant_policy ON public.supply_chain_nodes
  USING (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  );

-- Supply Chain Edges Policy
DROP POLICY IF EXISTS supply_chain_edges_tenant_policy ON public.supply_chain_edges;
CREATE POLICY supply_chain_edges_tenant_policy ON public.supply_chain_edges
  USING (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  )
  WITH CHECK (
    org_id = public.current_app_org_id()
    OR current_setting('app.bypass_rls', true) = 'on'
  );
