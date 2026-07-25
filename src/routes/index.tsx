import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/clausegraph/AppShell";
import { BlastRadiusSeal } from "@/components/clausegraph/BlastRadiusSeal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClauseGraph — Regulatory Impact Simulation" },
      {
        name: "description",
        content:
          "Trace the downstream impact of pending regulations across contract portfolios. Quantify exposure before it lands.",
      },
      { property: "og:title", content: "ClauseGraph — Regulatory Impact Simulation" },
      {
        property: "og:description",
        content:
          "Trace the downstream impact of pending regulations across contract portfolios. Quantify exposure before it lands.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AppShell>
      <BlastRadiusSeal />
    </AppShell>
  );
}
