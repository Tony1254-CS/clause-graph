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
    const { isDemoWorkspace, signInviteToken } = await import("./auth.server");

    // Admin check is scoped to *this* workspace
    await assertAdmin(userId, orgId);

    // S-10: Demo workspace cannot invite external users
    if (await isDemoWorkspace(orgId)) {
      throw new Error("Teammate invitations are disabled in the evaluation workspace.");
    }

    // Enforce seat quota in PostgreSQL
    try {
      await query(`SELECT assert_within_quota($1, 'invite_teammate')`, [orgId]);
    } catch (quotaErr) {
      throw new Error(quotaErr instanceof Error ? quotaErr.message : "Seat quota exceeded");
    }

    const result = await transaction(async (client) => {
      // Check if user already exists
      const existing = await client.query<{
        id: string;
        email: string;
        encrypted_password: string | null;
      }>(`SELECT id, email, encrypted_password FROM auth.users WHERE LOWER(email) = $1`, [
        data.email,
      ]);

      let targetUserId: string;

      if (existing.rows.length > 0) {
        targetUserId = existing.rows[0].id;
        // S-2: Check if existing user belongs to a DIFFERENT organization
        const profile = await client.query<{ org_id: string }>(
          `SELECT org_id FROM public.profiles WHERE id = $1`,
          [targetUserId],
        );

        if (profile.rows.length > 0 && profile.rows[0].org_id !== orgId) {
          throw new Error(
            "This user is already registered in another organization and cannot be moved.",
          );
        }

        // If user already belongs to this organization, ensure role and return early
        if (profile.rows.length > 0 && profile.rows[0].org_id === orgId) {
          await client.query(
            `INSERT INTO public.user_roles (user_id, org_id, role)
             VALUES ($1, $2, 'member')
             ON CONFLICT (user_id, org_id, role) DO NOTHING`,
            [targetUserId, orgId],
          );
          return { userId: targetUserId, alreadyMember: true, inviteLink: null };
        }
      } else {
        // S-1: Never set a hardcoded password. Create user with encrypted_password = NULL
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO auth.users (email, encrypted_password, raw_user_meta_data)
           VALUES ($1, NULL, $2::jsonb)
           RETURNING id`,
          [
            data.email,
            JSON.stringify({
              full_name: data.fullName,
              invited_org_id: orgId,
              invited_role: "member",
            }),
          ],
        );
        targetUserId = inserted.rows[0].id;
      }

      // Ensure profile and role are linked to this org
      await client.query(
        `INSERT INTO public.profiles (id, org_id, full_name, email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [targetUserId, orgId, data.fullName, data.email],
      );

      await client.query(
        `INSERT INTO public.user_roles (user_id, org_id, role)
         VALUES ($1, $2, 'member')
         ON CONFLICT (user_id, org_id, role) DO NOTHING`,
        [targetUserId, orgId],
      );

      // S-1/S-2: Generate a signed invite token (7-day expiration)
      const token = await signInviteToken({
        userId: targetUserId,
        email: data.email,
        orgId,
        role: "member",
        invitedBy: userId,
      });

      return {
        userId: targetUserId,
        alreadyMember: false,
        inviteToken: token,
        inviteLink: `/accept-invite?token=${token}`,
      };
    });

    return { ok: true, ...result };
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
    const { isDemoWorkspace } = await import("./auth.server");
    const { transaction } = await import("./db.server");

    await assertAdmin(userId, orgId);

    // S-10: Demo workspace cannot remove teammates
    if (await isDemoWorkspace(orgId)) {
      throw new Error("Teammates cannot be removed in the evaluation workspace.");
    }

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
