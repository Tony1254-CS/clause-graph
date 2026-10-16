import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

try {
  process.loadEnvFile?.();
} catch {
  // Ignore
}

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/clausegraph";

export async function runMigrations(opts?: { targetDbUrl?: string }): Promise<string[]> {
  const dbUrl = opts?.targetDbUrl || connectionString;
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const appliedVersions: string[] = [];

  try {
    // 1. Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // 2. Read already applied migrations
    const res = await client.query<{ version: string }>(
      `SELECT version FROM public.schema_migrations ORDER BY version ASC`,
    );
    const appliedSet = new Set(res.rows.map((r) => r.version));

    // 3. Locate migration files
    const migrationsDir = path.resolve(process.cwd(), "db/migrations");
    if (!fs.existsSync(migrationsDir)) {
      console.log(`[migrate] No migrations directory found at ${migrationsDir}`);
      return [];
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    // Check if database was already bootstrapped with baseline init.sql
    if (!appliedSet.has("0000_baseline.sql") && files.includes("0000_baseline.sql")) {
      const checkTables = await client.query<{ count: string }>(`
        SELECT count(*)::text as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'organizations'
      `);
      if (Number(checkTables.rows[0]?.count ?? 0) > 0) {
        console.log(
          `[migrate] Existing baseline detected. Recording 0000_baseline.sql as applied.`,
        );
        await client.query(`INSERT INTO public.schema_migrations (version) VALUES ($1)`, [
          "0000_baseline.sql",
        ]);
        appliedSet.add("0000_baseline.sql");
        appliedVersions.push("0000_baseline.sql");
      }
    }

    // 4. Apply unapplied migrations in order
    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      console.log(`[migrate] Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`INSERT INTO public.schema_migrations (version) VALUES ($1)`, [file]);
        await client.query("COMMIT");
        console.log(`[migrate] Successfully applied ${file}`);
        appliedVersions.push(file);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[migrate] Failed to apply ${file}:`, err);
        throw err;
      }
    }

    console.log(`[migrate] Schema up to date. (${appliedVersions.length} migrations applied)`);
    return appliedVersions;
  } finally {
    await client.end();
  }
}

// Run directly if invoked via CLI
if (process.argv[1]?.endsWith("migrate.ts")) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[migrate] Fatal error:", err);
      process.exit(1);
    });
}
