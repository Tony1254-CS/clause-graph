import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";

// ── Contracts ─────────────────────────────────────────────────────────────

export const getContractsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { query } = await import("./db.server");
    const rows = await query(
      `SELECT 
        c.id, c.name, c.counterparty, c.value, c.extraction_status, c.extraction_error, c.is_sample, c.source_file_url,
        COALESCE(
          json_agg(
            json_build_object('id', cl.id, 'text', cl.text, 'linked_regs', cl.linked_regs, 'position', cl.position)
            ORDER BY cl.position ASC
          ) FILTER (WHERE cl.id IS NOT NULL),
          '[]'::json
        ) AS clauses
       FROM public.contracts c
       LEFT JOIN public.clauses cl ON cl.contract_id = c.id
       WHERE c.org_id = $1
       GROUP BY c.id
       ORDER BY c.created_at ASC`,
      [context.orgId]
    );
    return rows;
  });

export const getContractByIdFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((input: { id: string }) => {
    const id = String(input?.id ?? "").trim();
    if (!id) throw new Error("Contract ID required");
    return { id };
  })
  .handler(async ({ data, context }) => {
    const { queryOne } = await import("./db.server");
    const row = await queryOne(
      `SELECT 
        c.id, c.name, c.counterparty, c.value, c.extraction_status, c.extraction_error, c.is_sample, c.source_file_url,
        COALESCE(
          json_agg(
            json_build_object('id', cl.id, 'text', cl.text, 'linked_regs', cl.linked_regs, 'position', cl.position)
            ORDER BY cl.position ASC
          ) FILTER (WHERE cl.id IS NOT NULL),
          '[]'::json
        ) AS clauses
       FROM public.contracts c
       LEFT JOIN public.clauses cl ON cl.contract_id = c.id
       WHERE c.id = $1 AND c.org_id = $2
       GROUP BY c.id`,
      [data.id, context.orgId]
    );
    return row;
  });

// ── Regulations ───────────────────────────────────────────────────────────

export const getRegulationsFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { query } = await import("./db.server");
    const rows = await query(
      `SELECT id, jurisdiction, title, summary, obligations 
       FROM public.regulations 
       ORDER BY id ASC`
    );
    return rows;
  });

export const getRegulationByIdFn = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => {
    const id = String(input?.id ?? "").trim();
    if (!id) throw new Error("Regulation ID required");
    return { id };
  })
  .handler(async ({ data }) => {
    const { queryOne } = await import("./db.server");
    const row = await queryOne(
      `SELECT id, jurisdiction, title, summary, obligations 
       FROM public.regulations 
       WHERE id = $1`,
      [data.id]
    );
    return row;
  });

// ── Profile & Workspace ───────────────────────────────────────────────────

export const getProfileFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { queryOne } = await import("./db.server");
    const row = await queryOne<{
      id: string;
      email: string;
      full_name: string | null;
      org: { id: string; name: string; plan: string } | null;
    }>(
      `SELECT 
        p.id, 
        p.email, 
        p.full_name, 
        json_build_object('id', o.id, 'name', o.name, 'plan', o.plan) AS org
       FROM public.profiles p
       LEFT JOIN public.organizations o ON o.id = p.org_id
       WHERE p.id = $1`,
      [context.userId]
    );
    return row;
  });

// ── Backtest Cases ────────────────────────────────────────────────────────

export const getBacktestCasesFn = createServerFn({ method: "GET" })
  .handler(async () => {
    const { query } = await import("./db.server");
    const rows = await query(
      `SELECT id, company, fine_usd, case_date, regulation, summary, source, reconstructed_prompt, reconstructed_clauses, fallback, position
       FROM public.backtest_cases
       ORDER BY position ASC`
    );
    return rows;
  });

// ── Simulation Runs ───────────────────────────────────────────────────────

export const getSimulationRunsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { query } = await import("./db.server");
    const rows = await query(
      `SELECT id, created_at, run_type, input_regulation_text, result_json
       FROM public.simulation_runs
       WHERE org_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [context.orgId]
    );
    return rows;
  });

// ── Compliance Artifacts ──────────────────────────────────────────────────

export const getComplianceArtifactsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { query } = await import("./db.server");
    const rows = await query(
      `SELECT id, created_at, regulation_id, gap, stack, runbook, audit_script, remediation, test_cases
       FROM public.compliance_artifacts
       WHERE org_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [context.orgId]
    );
    return rows;
  });

// ── Team Members & Role ───────────────────────────────────────────────────

export const getTeamMembersFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { query } = await import("./db.server");
    const rows = await query<{
      id: string;
      email: string | null;
      full_name: string | null;
      role: "admin" | "member" | null;
    }>(
      `SELECT p.id, p.email, p.full_name, r.role
       FROM public.profiles p
       LEFT JOIN public.user_roles r ON r.user_id = p.id AND r.org_id = p.org_id
       WHERE p.org_id = $1
       ORDER BY p.created_at ASC`,
      [context.orgId]
    );
    return rows.map((r) => ({
      ...r,
      is_self: r.id === context.userId,
    }));
  });

export const getMyRoleFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { queryOne } = await import("./db.server");
    const row = await queryOne<{ role: "admin" | "member" }>(
      `SELECT role FROM public.user_roles WHERE user_id = $1 AND org_id = $2 LIMIT 1`,
      [context.userId, context.orgId]
    );
    return row?.role ?? null;
  });
