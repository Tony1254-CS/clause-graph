import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";
import type { PaddleEnv } from "./paddle.server";

/** Schedule workspace deletion 30 days out. Admin-only. */
export const requestWorkspaceDeletion = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { userId, orgId } = context;
    if (!orgId) throw new Error("No workspace");

    const { assertAdmin } = await import("./team.server");
    const { isDemoWorkspace } = await import("./auth.server");
    const { queryOne } = await import("./db.server");

    // S-6: Admin check must happen before any side effects like Paddle cancellation
    await assertAdmin(userId, orgId);

    // S-10: Demo workspace cannot be deleted
    if (await isDemoWorkspace(orgId)) {
      throw new Error("Evaluation workspace cannot be deleted.");
    }

    // Best-effort: cancel any active Paddle subscription so we don't keep billing.
    try {
      const sub = await queryOne<{
        paddle_subscription_id: string;
        environment: string;
        status: string;
      }>(
        `SELECT paddle_subscription_id, environment, status 
         FROM public.subscriptions 
         WHERE org_id = $1 AND status IN ('active', 'trialing', 'past_due') 
         ORDER BY created_at DESC LIMIT 1`,
        [orgId],
      );

      if (sub?.paddle_subscription_id) {
        const { getPaddleClient } = await import("./paddle.server");
        const paddle = getPaddleClient(sub.environment as PaddleEnv);
        await paddle.subscriptions.cancel(sub.paddle_subscription_id, {
          effectiveFrom: "next_billing_period",
        });
      }
    } catch (e) {
      console.warn("[deletion] paddle cancel best-effort failed", e);
    }

    const row = await queryOne<{ request_workspace_deletion: string }>(
      `SELECT request_workspace_deletion($1, $2)`,
      [orgId, userId],
    );

    return { scheduledAt: row?.request_workspace_deletion ?? new Date().toISOString() };
  });

export const cancelWorkspaceDeletion = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { userId, orgId } = context;
    if (!orgId) throw new Error("No workspace");

    const { assertAdmin } = await import("./team.server");
    const { isDemoWorkspace } = await import("./auth.server");
    const { query } = await import("./db.server");

    // S-6: Admin check before cancellation
    await assertAdmin(userId, orgId);

    // S-10: Demo workspace protection
    if (await isDemoWorkspace(orgId)) {
      throw new Error("Evaluation workspace cannot be modified.");
    }

    await query(`SELECT cancel_workspace_deletion($1, $2)`, [orgId, userId]);
    return { ok: true };
  });
