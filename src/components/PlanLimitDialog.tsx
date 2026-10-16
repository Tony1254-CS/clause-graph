import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X, Check, ArrowUpRight } from "lucide-react";
import { PLANS, formatLimit, BILLING_ENABLED, type PlanId } from "@/lib/plans";
import { isPlanLimitError } from "@/lib/plans";

export type PlanLimitReason = "contracts" | "simulations" | "seats" | "generic";

const REASON_COPY: Record<PlanLimitReason, { title: string; body: string }> = {
  contracts: {
    title: "You've hit your contract limit",
    body: "Your current plan doesn't allow more contracts. Upgrade to keep uploading.",
  },
  simulations: {
    title: "You've used all your simulations this month",
    body: "Simulations reset on your next billing cycle. Upgrade for a higher monthly quota.",
  },
  seats: {
    title: "You've reached your seat limit",
    body: "Your current plan caps the number of teammates. Upgrade to invite more.",
  },
  generic: {
    title: "Plan limit reached",
    body: "This action requires a higher plan.",
  },
};

const EVENT = "clausegraph:plan-limit";

export function openPlanLimitDialog(reason: PlanLimitReason = "generic") {
  // Billing parked: no plan limits exist, so never nag anyone to upgrade.
  if (!BILLING_ENABLED) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { reason } }));
}

/** Convenience: pass a caught error; opens dialog only if it's a PLAN_LIMIT one. */
export function handlePlanLimitError(err: unknown, reason: PlanLimitReason = "generic"): boolean {
  if (isPlanLimitError(err)) {
    openPlanLimitDialog(reason);
    return true;
  }
  return false;
}

export function PlanLimitDialog() {
  const [reason, setReason] = useState<PlanLimitReason | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ reason: PlanLimitReason }>).detail;
      setReason(detail?.reason ?? "generic");
    };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!reason) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setReason(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reason]);

  if (!reason) return null;
  const copy = REASON_COPY[reason];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-ink-base/70 p-4 backdrop-blur-sm motion-safe:animate-in motion-safe:fade-in duration-200"
      onClick={() => setReason(null)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass-panel w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
              Upgrade
            </p>
            <h2 className="mt-2 font-display text-[28px] leading-tight text-foreground">
              {copy.title}
            </h2>
            <p className="mt-2 text-[13.5px] text-muted-foreground max-w-[62ch]">{copy.body}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setReason(null)}
            className="rounded-[8px] p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brass)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {(Object.keys(PLANS) as PlanId[]).map((id) => (
            <PlanMini key={id} planId={id} />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setReason(null)}
            className="rounded-[12px] border border-[var(--hairline)] px-4 py-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Not now
          </button>
          <Link
            to="/settings/billing"
            onClick={() => setReason(null)}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-5 py-2 text-[13px] font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 ease-out hover:-translate-y-px hover:bg-[var(--brass-strong)] active:scale-[0.98]"
          >
            View plans <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function PlanMini({ planId }: { planId: PlanId }) {
  const p = PLANS[planId];
  const featured = planId === "pro";
  return (
    <div
      className={`rounded-[16px] border p-4 flex flex-col gap-3 ${
        featured
          ? "border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-[color-mix(in_oklab,var(--brass)_6%,transparent)]"
          : "border-[var(--hairline)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-[18px] text-foreground">{p.name}</p>
        {featured && (
          <span className="rounded-full border border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--brass)]">
            Popular
          </span>
        )}
      </div>
      <div>
        <span className="font-display text-[28px] text-foreground">${p.priceUsd}</span>
        <span className="ml-1 font-mono text-[11px] text-muted-foreground">/ mo</span>
      </div>
      <ul className="flex flex-col gap-1.5 text-[12.5px] text-muted-foreground">
        <li className="flex items-start gap-1.5">
          <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--brass)]" strokeWidth={2.2} />
          {formatLimit(p.contracts)} contracts
        </li>
        <li className="flex items-start gap-1.5">
          <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--brass)]" strokeWidth={2.2} />
          {formatLimit(p.simulationsPerMonth)} simulations / mo
        </li>
        <li className="flex items-start gap-1.5">
          <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--brass)]" strokeWidth={2.2} />
          {formatLimit(p.seats)} seats
        </li>
      </ul>
    </div>
  );
}
