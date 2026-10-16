import pg from "pg";

const { Pool } = pg;

// Connection string from environment with robust fallback for local dev / docker
const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5435/clausegraph";

let _pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    _pool.on("error", (err) => {
      console.error("[PostgreSQL Pool Error]", err);
    });
  }
  return _pool;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T = any>(text: string, params?: unknown[]): Promise<T[]> {
  const pool = getPool();
  const res = await pool.query(text, params);
  return res.rows as T[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryOne<T = any>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function transaction<T>(callback: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function withOrg<T>(
  orgId: string,
  callback: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.org_id', $1, true)", [orgId]);
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDbHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    console.error("[PostgreSQL Health Check Error]", err);
    return { ok: false, latencyMs: Date.now() - start };
  }
}
