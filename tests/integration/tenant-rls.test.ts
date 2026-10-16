import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

const { Client } = pg;

const appDbUrl =
  process.env.APP_DATABASE_URL ||
  "postgresql://clausegraph_app:clausegraph_app_dev_pw@localhost:5435/clausegraph";
const superDbUrl =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5435/clausegraph";

describe("Tenant RLS and Role Isolation (Phase 2 T2.5)", () => {
  let appClient: pg.Client;
  let superClient: pg.Client;
  let canConnectApp = false;
  let canConnectSuper = false;

  beforeAll(async () => {
    try {
      appClient = new Client({ connectionString: appDbUrl, connectionTimeoutMillis: 1500 });
      await appClient.connect();
      canConnectApp = true;
    } catch {
      canConnectApp = false;
    }

    try {
      superClient = new Client({ connectionString: superDbUrl, connectionTimeoutMillis: 1500 });
      await superClient.connect();
      canConnectSuper = true;
    } catch {
      canConnectSuper = false;
    }
  });

  afterAll(async () => {
    if (canConnectApp) {
      await appClient.end();
    }
    if (canConnectSuper) {
      await superClient.end();
    }
  });

  it("fails closed on tenant contracts when app.org_id is not set", async () => {
    if (!canConnectApp) return;
    const res = await appClient.query("SELECT * FROM public.contracts");
    expect(res.rows.length).toBe(0);
  });

  it("isolates contracts to the active tenant when app.org_id is set", async () => {
    if (!canConnectApp) return;
    // Query a known demo org
    const orgRes = await appClient.query<{ id: string }>(
      "SELECT id FROM public.organizations LIMIT 1",
    );
    if (orgRes.rows.length === 0) return;
    const targetOrgId = orgRes.rows[0].id;

    // Inside transaction, set app.org_id
    await appClient.query("BEGIN");
    await appClient.query("SELECT set_config('app.org_id', $1, true)", [targetOrgId]);
    const res = await appClient.query<{ org_id: string }>("SELECT org_id FROM public.contracts");
    await appClient.query("COMMIT");

    expect(res.rows.length).toBeGreaterThan(0);
    for (const row of res.rows) {
      expect(row.org_id).toBe(targetOrgId);
    }
  });

  it("allows reading reference legal instruments", async () => {
    if (!canConnectApp) return;
    const res = await appClient.query(
      "SELECT id, title, official_url FROM public.legal_instruments WHERE status = 'in_force'",
    );
    expect(res.rows.length).toBeGreaterThan(0);
    for (const row of res.rows) {
      expect(row.official_url).toBeDefined();
    }
  });

  it("prohibits deleting or updating audit_log (permission denied for app role, trigger for superuser)", async () => {
    if (canConnectApp) {
      // App role has no DELETE grant
      await expect(
        appClient.query("DELETE FROM public.audit_log WHERE id = 999999"),
      ).rejects.toThrow(/permission denied/);
    }
    if (canConnectSuper) {
      // Insert a dummy log entry
      const insertRes = await superClient.query<{ id: string }>(
        "INSERT INTO public.audit_log (action, target_type) VALUES ('test_audit_entry', 'test') RETURNING id",
      );
      const logId = insertRes.rows[0].id;

      // Attempting to delete the row fires the BEFORE DELETE FOR EACH ROW trigger
      await expect(
        superClient.query("DELETE FROM public.audit_log WHERE id = $1", [logId]),
      ).rejects.toThrow(/audit_log is append-only/);

      // Attempting to update the row also fires the trigger
      await expect(
        superClient.query("UPDATE public.audit_log SET action = 'tampered' WHERE id = $1", [logId]),
      ).rejects.toThrow(/audit_log is append-only/);
    }
  });
});
