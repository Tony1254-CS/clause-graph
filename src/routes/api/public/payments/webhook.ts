import { createFileRoute } from "@tanstack/react-router";
import { query, queryOne, transaction } from "@/lib/db.server";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

// Map human-readable Paddle product IDs → app plan tier.
function productToPlan(productExternalId: string | undefined): "free" | "pro" | "team" {
  if (productExternalId === "pro_plan") return "pro";
  if (productExternalId === "team_plan") return "team";
  return "free";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCreatedOrUpdated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, scheduledChange, customData } = data;
  const userId = customData?.userId as string | undefined;
  const orgId = customData?.orgId as string | undefined;

  const item = items?.[0];
  const priceExt = item?.price?.importMeta?.externalId as string | undefined;
  const productExt = item?.product?.importMeta?.externalId as string | undefined;
  if (!priceExt || !productExt) {
    console.warn("[paddle] skip: missing importMeta.externalId", { id });
    return;
  }

  const plan = productToPlan(productExt);
  const periodEnd = currentBillingPeriod?.endsAt as string | undefined;
  const cancelAtPeriodEnd = scheduledChange?.action === "cancel";

  await transaction(async (client) => {
    // Upsert subscription row in PostgreSQL
    if (userId) {
      await client.query(
        `INSERT INTO public.subscriptions 
          (user_id, org_id, paddle_subscription_id, paddle_customer_id, product_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, environment, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
         ON CONFLICT (paddle_subscription_id) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          org_id = EXCLUDED.org_id,
          paddle_customer_id = EXCLUDED.paddle_customer_id,
          product_id = EXCLUDED.product_id,
          price_id = EXCLUDED.price_id,
          status = EXCLUDED.status,
          current_period_start = EXCLUDED.current_period_start,
          current_period_end = EXCLUDED.current_period_end,
          cancel_at_period_end = EXCLUDED.cancel_at_period_end,
          environment = EXCLUDED.environment,
          updated_at = now()`,
        [
          userId,
          orgId ?? null,
          id,
          customerId,
          productExt,
          priceExt,
          status,
          currentBillingPeriod?.startsAt ?? null,
          periodEnd ?? null,
          cancelAtPeriodEnd,
          env,
        ]
      );
    }

    // Update org plan
    if (orgId) {
      const orgPlan = status === "canceled" && !cancelAtPeriodEnd ? "free" : plan;
      const paying = ["active", "trialing", "past_due", "paused"].includes(status);

      await client.query(
        `UPDATE public.organizations
         SET plan = $1,
             plan_status = $2,
             plan_renews_at = $3,
             paddle_customer_id = $4,
             trial_ends_at = CASE WHEN $5 THEN NULL ELSE trial_ends_at END
         WHERE id = $6`,
        [
          orgPlan,
          status,
          periodEnd ?? null,
          customerId,
          paying,
          orgId,
        ]
      );
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  const orgId = data.customData?.orgId as string | undefined;

  await transaction(async (client) => {
    await client.query(
      `UPDATE public.subscriptions 
       SET status = 'canceled', updated_at = now() 
       WHERE paddle_subscription_id = $1 AND environment = $2`,
      [data.id, env]
    );

    if (orgId) {
      await client.query(
        `UPDATE public.organizations 
         SET plan = 'free', plan_status = 'canceled' 
         WHERE id = $1`,
        [orgId]
      );
    }
  });
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          const event = await verifyWebhook(request, env);

          // Idempotency: skip if we've already processed this event
          try {
            const inserted = await queryOne(
              `INSERT INTO public.paddle_events (event_id, event_type)
               VALUES ($1, $2)
               ON CONFLICT (event_id) DO NOTHING
               RETURNING event_id`,
              [event.eventId, event.eventType]
            );
            if (!inserted) {
              return Response.json({ received: true, duplicate: true });
            }
          } catch {
            return Response.json({ received: true, duplicate: true });
          }

          switch (event.eventType) {
            case EventName.SubscriptionCreated:
            case EventName.SubscriptionUpdated:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await handleSubscriptionCreatedOrUpdated(event.data as any, env);
              break;
            case EventName.SubscriptionCanceled:
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await handleSubscriptionCanceled(event.data as any, env);
              break;
            case EventName.TransactionPaymentFailed: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const d = event.data as any;
              const orgId = d?.customData?.orgId as string | undefined;
              if (orgId) {
                await query(
                  `UPDATE public.organizations SET plan_status = 'past_due' WHERE id = $1`,
                  [orgId]
                );
              }
              break;
            }
            default:
              console.log("[paddle] unhandled event:", event.eventType);
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("[paddle] webhook error", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
