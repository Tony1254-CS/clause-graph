import { queryOne } from "./db.server";

/**
 * Admin check scoped to a specific workspace. Uses the security-definer
 * `has_role(user, org, role)` function so a stale admin row in *another* org
 * can never authorise a mutation here.
 */
export async function assertAdmin(userId: string, orgId: string) {
  const row = await queryOne<{ has_role: boolean }>(`SELECT has_role($1, $2, 'admin')`, [
    userId,
    orgId,
  ]);
  if (!row || row.has_role !== true) {
    throw new Error("Admins only");
  }
}
