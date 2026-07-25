import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, Gem } from "lucide-react";
import { getOrgUsage } from "@/lib/billing.functions";

type OrgStatus = {
  plan_status?: string;
  plan_renews_at?: string | null;
  cancel_at_period_end?: boolean;
  deletion_scheduled_at?: string | null;
  on_trial?: boolean;
  trial_days_left?: number | null;
};


function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function PlanStatusBanner() {
  const getUsage = useServerFn(getOrgUsage);
  const q = useQuery({
    queryKey: ["org-usage"],
    queryFn: () => getUsage(),
    staleTime: 30_000,
  });
  const data = q.data as OrgStatus | undefined;
  if (!data) return null;

  const status = (data.plan_status ?? "active").toLowerCase();
  const isPastDue = status === "past_due";
  const isPaused = status === "paused";
  const scheduledDelete = data.deletion_scheduled_at;

  if (scheduledDelete) {
    return (
      <Banner tone="risk" icon={<AlertTriangle className="h-4 w-4" />}>
        Your workspace is scheduled for deletion on{" "}
        <span className="font-mono">{fmtDate(scheduledDelete)}</span>.{" "}
        <Link to="/settings/account" className="underline underline-offset-2">
          Cancel deletion
        </Link>
        .
      </Banner>
    );
  }

  if (isPastDue) {
    return (
      <Banner tone="risk" icon={<AlertTriangle className="h-4 w-4" />}>
        We couldn't process your last payment. Update your card in the subscription portal to
        avoid losing access.{" "}
        <Link to="/settings/billing" className="underline underline-offset-2">
          Manage subscription
        </Link>
        .
      </Banner>
    );
  }

  if (isPaused) {
    return (
      <Banner tone="warn" icon={<Clock className="h-4 w-4" />}>
        Your subscription is paused. Resume it from the subscription portal to keep uploading
        contracts.{" "}
        <Link to="/settings/billing" className="underline underline-offset-2">
          Manage subscription
        </Link>
        .
      </Banner>
    );
  }

  // Trial countdown is intentionally NOT shown here — the user rejected
  // trial/test banners in the header. Trial state lives on /settings/billing.


  return null;
}


function Banner({
  tone,
  icon,
  children,
}: {
  tone: "risk" | "warn";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls =
    tone === "risk"
      ? "bg-[rgba(225,82,75,0.08)] border-[rgba(225,82,75,0.3)] text-[var(--risk)]"
      : "bg-[color-mix(in_oklab,var(--brass)_8%,transparent)] border-[var(--hairline)] text-[var(--brass)]";
  return (
    <div
      role="status"
      className={`flex w-full items-center justify-center gap-2 border-b px-4 py-2 text-center text-[12px] backdrop-blur-xl ${cls}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}
