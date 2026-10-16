import { queryOne } from "./db.server";

export async function getUserOrg(userId: string): Promise<string | null> {
  const row = await queryOne<{ org_id: string }>(
    `SELECT org_id FROM public.profiles WHERE id = $1`,
    [userId]
  );
  return row?.org_id ?? null;
}