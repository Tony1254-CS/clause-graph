import { createFileRoute } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";

export const Route = createFileRoute("/simulate")({
  head: () => ({
    meta: [
      { title: "Simulate Impact — ClauseGraph" },
      {
        name: "description",
        content: "Simulate the downstream impact of pending regulations across the contract portfolio.",
      },
      { property: "og:title", content: "Simulate Impact — ClauseGraph" },
      {
        property: "og:description",
        content: "Simulate the downstream impact of pending regulations across the contract portfolio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SimulatePage,
});

function SimulatePage() {
  return (
    <AppShell>
      <div className="glass-panel max-w-md p-10 text-center">
        <div className="mx-auto h-12 w-12 rounded-full border border-[var(--hairline-strong)] grid place-items-center">
          <Zap className="h-5 w-5 text-brass" strokeWidth={1.6} />
        </div>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
          Phase 3
        </p>
        <h1 className="mt-2 font-display text-[26px] leading-[1.1] tracking-tight text-foreground">
          Impact simulation
        </h1>
        <p className="mt-3 text-[13.5px] leading-[1.6] text-muted-foreground">
          Select a pending regulation and watch the blast radius propagate through the citation
          graph — this is where the ontology turns kinetic.
        </p>
      </div>
    </AppShell>
  );
}
