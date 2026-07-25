import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: {
  from: (t: string) => {
    select: (c: string) => {
      eq: (a: string, b: string) => { maybeSingle: () => Promise<{ data: { role?: string } | null }> };
    };
  };
}, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.role !== "admin") throw new Error("Admins only");
}

export const inviteTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; fullName?: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Valid email required");
    return { email, fullName: String(input?.fullName ?? "").trim() || null };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase as never, userId);

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) throw pErr;
    if (!profile?.org_id) throw new Error("Organization not found");

    // Enforce seat quota
    const { error: quotaErr } = await supabase.rpc("assert_within_quota", {
      _org: profile.org_id,
      _action: "invite_teammate",
    });
    if (quotaErr) throw new Error(quotaErr.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error: iErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { invited_org_id: profile.org_id, full_name: data.fullName },
      redirectTo: `${process.env.SUPABASE_URL}`,
    });
    if (iErr) throw new Error(iErr.message);

    return { ok: true, userId: invited.user?.id ?? null };
  });

export const removeTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    const id = String(input?.userId ?? "");
    if (!id) throw new Error("userId required");
    return { userId: id };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.userId === userId) throw new Error("Cannot remove yourself");
    await assertAdmin(supabase as never, userId);

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    const { data: target } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (!myProfile?.org_id || target?.org_id !== myProfile.org_id) {
      throw new Error("User not in your organization");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Best-effort: remove role + profile. Leave auth account intact (they may belong elsewhere).
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("org_id", myProfile.org_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId).eq("org_id", myProfile.org_id);
    return { ok: true };
  });
