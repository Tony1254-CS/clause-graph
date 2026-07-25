import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PaddleEnv } from "./paddle.server";

async function getUserOrg(
  supabase: ReturnType<typeof requireSupabaseAuth.build> extends never
    ? never
    : Awaited<ReturnType<typeof requireSupabaseAuth>>["context"]["supabase"],
  userId: string,
) {
  const { data } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", userId)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

/** Schedule workspace deletion 30 days out. Admin-only (enforced in SQL). */
export const requestWorkspaceDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getUserOrg(supabase, userId);
    if (!orgId) throw new Error("No workspace");

    // Best-effort: cancel any active Paddle subscription so we don't keep billing.
    try {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("paddle_subscription_id, environment, status")
        .eq("org_id", orgId)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub?.paddle_subscription_id) {
        const { getPaddleClient } = await import("./paddle.server");
        const paddle = getPaddleClient(sub.environment as PaddleEnv);
        await paddle.subscriptions.cancel(sub.paddle_subscription_id as string, {
          effectiveFrom: "next_billing_period",
        });
      }
    } catch (e) {
      console.warn("[deletion] paddle cancel best-effort failed", e);
    }

    const { data, error } = await supabase.rpc("request_workspace_deletion", {
      _org: orgId,
      _by: userId,
    });
    if (error) throw error;
    return { scheduledAt: data as unknown as string };
  });

export const cancelWorkspaceDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const orgId = await getUserOrg(supabase, userId);
    if (!orgId) throw new Error("No workspace");
    const { error } = await supabase.rpc("cancel_workspace_deletion", {
      _org: orgId,
      _by: userId,
    });
    if (error) throw error;
    return { ok: true };
  });
