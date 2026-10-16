import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";

export const inviteTeammate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { email: string; fullName?: string }) => {
    const email = String(input?.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Valid email required");
    return { email, fullName: String(input?.fullName ?? "").trim() || null };
  })
  .handler(async ({ data, context }) => {
    const { userId, orgId } = context;

    if (!orgId) throw new Error("Organization not found");

    const { assertAdmin } = await import("./team.server");
    const { query, transaction } = await import("./db.server");
    const { hashPassword } = await import("./auth.server");

    // Admin check is scoped to *this* workspace
    await assertAdmin(userId, orgId);

    // Enforce seat quota in PostgreSQL
    try {
      await query(`SELECT assert_within_quota($1, 'invite_teammate')`, [orgId]);
    } catch (quotaErr) {
      throw new Error(quotaErr instanceof Error ? quotaErr.message : "Seat quota exceeded");
    }

    const teammateId = await transaction(async (client) => {
      // Check if user already exists
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM auth.users WHERE LOWER(email) = $1`,
        [data.email],
      );

      let targetUserId: string;

      if (existing.rows.length > 0) {
        targetUserId = existing.rows[0].id;
      } else {
        // Create user account with a temporary default password hash
        const tempPass = await hashPassword("TeammateInvite2026!");
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
           VALUES ($1, $2, $3::jsonb)
           RETURNING id`,
          [data.email, tempPass, JSON.stringify({ full_name: data.fullName })],
        );
        targetUserId = inserted.rows[0].id;
      }

      // Add profile and role in this org if not exists
      await client.query(
        `INSERT INTO public.profiles (id, org_id, full_name, email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET org_id = EXCLUDED.org_id`,
        [targetUserId, orgId, data.fullName, data.email],
      );

      await client.query(
        `INSERT INTO public.user_roles (user_id, org_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (user_id, org_id, role) DO NOTHING`,
        [targetUserId, orgId],
      );

      return targetUserId;
    });

    return { ok: true, userId: teammateId };
  });

export const removeTeammate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input: { userId: string }) => {
    const id = String(input?.userId ?? "");
    if (!id) throw new Error("userId required");
    return { userId: id };
  })
  .handler(async ({ data, context }) => {
    const { userId, orgId } = context;
    if (data.userId === userId) throw new Error("Cannot remove yourself");
    if (!orgId) throw new Error("Organization not found");

    const { assertAdmin } = await import("./team.server");
    const { transaction } = await import("./db.server");

    await assertAdmin(userId, orgId);

    // Remove role and profile for this workspace in PostgreSQL
    await transaction(async (client) => {
      await client.query(`DELETE FROM public.user_roles WHERE user_id = $1 AND org_id = $2`, [
        data.userId,
        orgId,
      ]);
      await client.query(`DELETE FROM public.profiles WHERE id = $1 AND org_id = $2`, [
        data.userId,
        orgId,
      ]);
    });

    return { ok: true };
  });
