import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./team.server";

export const inviteTeammate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; fullName?: string }) => {
    const email = String(input?.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Valid email required");
    return { email, fullName: String(input?.fullName ?? "").trim() || null };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (pErr) throw new Error("Could not load your workspace");
    if (!profile?.org_id) throw new Error("Organization not found");

    // Admin check is scoped to *this* workspace, not "admin anywhere".
    await assertAdmin(supabase as never, userId, profile.org_id as string);

    // Enforce seat quota
    const { error: quotaErr } = await supabase.rpc("assert_within_quota", {
      _org: profile.org_id,
      _action: "invite_teammate",
    });
    if (quotaErr) throw new Error(quotaErr.message);

    // Invite link must land on the app, not on the backend URL.
    const origin =
      getRequestHeader("origin") ??
      (getRequestHeader("referer") ? new URL(getRequestHeader("referer")!).origin : null) ??
      process.env.APP_URL ??
      "";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error: iErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      data.email,
      {
        data: { invited_org_id: profile.org_id, full_name: data.fullName },
        ...(origin ? { redirectTo: `${origin}/dashboard` } : {}),
      },
    );
    if (iErr) {
      // Never forward the provider message: it discloses whether an address
      // is already registered (account enumeration).
      console.error("[team] invite failed", iErr.message);
      throw new Error("Could not send that invite. Check the address and try again.");
    }

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

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", userId)
      .maybeSingle();
    if (!myProfile?.org_id) throw new Error("Organization not found");

    await assertAdmin(supabase as never, userId, myProfile.org_id as string);

    const { data: target } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", data.userId)
      .maybeSingle();
    if (target?.org_id !== myProfile.org_id) {
      throw new Error("User not in your organization");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Best-effort: remove role + profile. Leave auth account intact (they may belong elsewhere).
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("org_id", myProfile.org_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId).eq("org_id", myProfile.org_id);
    return { ok: true };
  });
