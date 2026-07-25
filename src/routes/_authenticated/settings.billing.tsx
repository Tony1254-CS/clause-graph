import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { profileQuery } from "@/data/queries";
import {
  getOrgUsage,
  createBillingPortalSession,
  changeSubscriptionPlan,
} from "@/lib/billing.functions";
import { PLANS, formatLimit, type PlanId } from "@/lib/plans";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { getPaddleEnvironment } from "@/lib/paddle";

export const Route = createFileRoute("/_authenticated/settings/billing")({
  head: () => ({
    meta: [
      { title: "Billing — ClauseGraph" },
      { name: "description", content: "Manage your ClauseGraph plan, usage, and invoices." },
      { property: "og:title", content: "Billing — ClauseGraph" },
      { property: "og:description", content: "Manage your ClauseGraph plan and usage." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const qc = useQueryClient();
  const profile = useQuery(profileQuery);
  const getUsage = useServerFn(getOrgUsage);
  const portal = useServerFn(createBillingPortalSession);
  const changePlan = useServerFn(changeSubscriptionPlan);
  const usage = useQuery({ queryKey: ["org-usage"], queryFn: () => getUsage() });
  const { openCheckout, loading: coLoading } = usePaddleCheckout();
  const [portalLoading, setPortalLoading] = useState(false);
  const [changing, setChanging] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("checkout") !== "success") return;
    // Poll usage query for up to 12s while the webhook lands.
    setPolling(true);
    setNotice("Finalizing your subscription…");
    let attempts = 0;
    const startPlan = usage.data?.plan ?? "free";
    const iv = window.setInterval(async () => {
      attempts += 1;
      const fresh = await qc.fetchQuery({ queryKey: ["org-usage"], queryFn: () => getUsage() });
      if (fresh?.plan && fresh.plan !== startPlan) {
        window.clearInterval(iv);
        setPolling(false);
        setNotice("Subscription active. Welcome aboard.");
        // Clean up the query string
        url.searchParams.delete("checkout");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      } else if (attempts >= 12) {
        window.clearInterval(iv);
        setPolling(false);
        setNotice("Payment received — plan should reflect shortly.");
      }
    }, 1000);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentPlan = (usage.data?.plan ?? "free") as PlanId;
  const userId = profile.data?.id;
  const orgId = profile.data?.org?.id;
  const onTrial = !!usage.data?.on_trial;
  const hasSubscription = !!usage.data?.has_subscription;

  async function handleSelect(planId: PlanId) {
    setError(null);
    setNotice(null);
    const price = PLANS[planId].priceId;
    if (!price || !userId || !orgId) return;
    // On a trial (or any state without a real subscription) the user must be
    // able to buy the plan they're trialling — never treat it as "current".
    if (planId === currentPlan && hasSubscription) return;

    // Only swap items when a real paid subscription exists.
    if (hasSubscription) {
      setChanging(planId);
      try {
        const res = await changePlan({
          data: { newPlanId: planId, environment: getPaddleEnvironment() },
        });
        if (res.changed) {
          setNotice(
            res.upgraded
              ? "Upgrade applied — pro-rated charge on your card now."
              : "Downgrade scheduled — takes effect on your next renewal.",
          );
        }
        await qc.invalidateQueries({ queryKey: ["org-usage"] });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not change plan");
      } finally {
        setChanging(null);
      }
      return;
    }

    // Free or trialling → open a fresh checkout.
    try {
      await openCheckout({
        priceId: price,
        userId,
        orgId,
        customerEmail: profile.data?.email ?? undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    }
  }

  async function handleManage() {
    setError(null);
    setPortalLoading(true);
    try {
      const { url } = await portal({ data: { environment: getPaddleEnvironment() } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open portal");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="w-full max-w-[1100px] flex flex-col gap-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass">Billing</p>
            <h1 className="mt-2 font-display text-[36px] leading-tight text-foreground">
              Plan & usage
            </h1>
            <p className="mt-2 text-[14px] text-muted-foreground max-w-[60ch]">
              Manage your subscription, monitor quota, and download invoices. Billing runs through
              our merchant of record — receipts show Paddle alongside ClauseGraph.
            </p>
          </div>
          {currentPlan !== "free" && (
            <button
              type="button"
              onClick={handleManage}
              disabled={portalLoading}
              className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--hairline-strong)] px-4 py-2 text-[13px] text-foreground transition-colors hover:border-brass hover:text-brass disabled:opacity-60"
            >
              {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              Manage subscription
            </button>
          )}
        </header>

        {error && (
          <div className="glass-panel border-risk/40 text-risk p-4 text-[13px]">{error}</div>
        )}
        {notice && (
          <div className="glass-panel p-4 text-[13px] text-foreground flex items-center gap-2">
            {polling && <Loader2 className="h-3.5 w-3.5 animate-spin text-brass" />}
            {notice}
          </div>
        )}

        <section className="glass-panel p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            This month
          </p>
          <div className="mt-4 grid gap-6 sm:grid-cols-3">
            <UsageStat
              label="Contracts"
              value={usage.data?.contracts ?? 0}
              limit={PLANS[currentPlan].contracts}
            />
            <UsageStat
              label="Simulations"
              value={usage.data?.simulations ?? 0}
              limit={PLANS[currentPlan].simulationsPerMonth}
            />
            <UsageStat
              label="Seats"
              value={usage.data?.members ?? 0}
              limit={PLANS[currentPlan].seats}
            />
          </div>
        </section>

        {onTrial && (
          <p className="font-mono text-[11px] text-muted-foreground">
            You&apos;re on a Pro trial
            {usage.data?.trial_days_left != null
              ? ` — ${usage.data.trial_days_left} day${usage.data.trial_days_left === 1 ? "" : "s"} left`
              : ""}
            . Subscribe below to keep Pro features after it ends.
          </p>
        )}

        <section className="grid gap-6 md:grid-cols-3">
          {(Object.keys(PLANS) as PlanId[]).map((id) => (
            <PlanCard
              key={id}
              plan={PLANS[id]}
              current={currentPlan === id}
              trialing={onTrial && currentPlan === id}
              purchasable={!hasSubscription}
              disabled={coLoading || changing !== null || !PLANS[id].priceId}
              busy={changing === id}
              onSelect={() => handleSelect(id)}
            />
          ))}
        </section>


        <p className="text-center font-mono text-[10.5px] text-muted-foreground">
          Payments are processed by Paddle, our merchant of record. Cancel anytime from the
          subscription portal.
        </p>
      </div>
    </AppShell>
  );
}

function UsageStat({ label, value, limit }: { label: string; value: number; limit: number }) {
  const pct = Math.min(100, limit > 0 ? Math.round((value / limit) * 100) : 0);
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-[28px] text-foreground">
        {value}
        <span className="ml-1 font-mono text-[13px] text-muted-foreground">/ {formatLimit(limit)}</span>
      </p>
      <div className="mt-2 h-1 rounded-full bg-[rgba(255,255,255,0.05)]">
        <div className="h-full rounded-full bg-brass" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  current,
  trialing,
  purchasable,
  disabled,
  busy,
  onSelect,
}: {
  plan: (typeof PLANS)[PlanId];
  current: boolean;
  trialing?: boolean;
  purchasable?: boolean;
  disabled: boolean;
  busy?: boolean;
  onSelect: () => void;
}) {
  // A trialling plan is "current" visually, but must stay clickable so the
  // user can convert the trial into a real subscription.
  const locked = current && !trialing && !(purchasable && plan.priceId);
  const label = !plan.priceId
    ? current
      ? "Current plan"
      : "Included"
    : trialing
      ? `Subscribe to ${plan.name}`
      : current
        ? "Current plan"
        : purchasable
          ? `Subscribe to ${plan.name}`
          : `Switch to ${plan.name}`;

  return (
    <div
      className={`glass-panel p-6 flex flex-col gap-4 ${
        current ? "border-brass/50 shadow-[0_0_32px_-12px_rgba(201,166,107,0.4)]" : ""
      }`}
    >
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[22px] text-foreground">{plan.name}</h3>
          {current && (
            <span className="rounded-full border border-brass/40 bg-brass/10 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-brass">
              {trialing ? "Trial" : "Current"}
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">{plan.tagline}</p>
      </div>
      <div>
        <span className="font-display text-[40px] text-foreground">${plan.priceUsd}</span>
        <span className="ml-1 font-mono text-[12px] text-muted-foreground">/ month</span>
      </div>
      <ul className="flex flex-col gap-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[13px] text-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" strokeWidth={2.2} />
            {f}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onSelect}
        disabled={locked || disabled}
        className={`mt-auto inline-flex items-center justify-center gap-2 rounded-[12px] px-4 py-2.5 text-[13px] font-medium transition-all duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50 ${
          plan.priceId
            ? "bg-brass text-[color:var(--primary-foreground)] hover:bg-[color:var(--brass-strong)] active:scale-[0.98]"
            : "border border-[var(--hairline)] text-muted-foreground"
        }`}
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {label}
      </button>
    </div>
  );
}
