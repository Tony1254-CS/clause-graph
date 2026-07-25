import { createFileRoute } from "@tanstack/react-router";
import { ListChecks } from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";

export const Route = createFileRoute("/actions")({
  head: () => ({
    meta: [
      { title: "Action Plans — ClauseGraph" },
      {
        name: "description",
        content: "Remediation action plans generated from simulated regulatory impact.",
      },
      { property: "og:title", content: "Action Plans — ClauseGraph" },
      {
        property: "og:description",
        content: "Remediation action plans generated from simulated regulatory impact.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ActionsPage,
});

function ActionsPage() {
  return (
    <AppShell>
      <div className="glass-panel max-w-md p-10 text-center">
        <div className="mx-auto h-12 w-12 rounded-full border border-[var(--hairline-strong)] grid place-items-center">
          <ListChecks className="h-5 w-5 text-brass" strokeWidth={1.6} />
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
          Phase 3
        </p>
        <h1 className="mt-2 font-display text-[26px] leading-[1.1] tracking-tight text-foreground">
          Action plans
        </h1>
        <p className="mt-3 text-[13.5px] leading-[1.6] text-muted-foreground">
          After a simulation lands, ClauseGraph proposes remediation steps per affected clause —
          renegotiate, amend, or escalate — with owners and deadlines.
        </p>
      </div>
    </AppShell>
  );
}
