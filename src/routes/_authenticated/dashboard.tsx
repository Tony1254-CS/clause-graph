import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/clausegraph/AppShell";
import { GraphMedallion } from "@/components/clausegraph/GraphMedallion";
import { contractsQuery, regulationsQuery } from "@/data/queries";
import { RouteError } from "@/components/clausegraph/RouteError";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ClauseGraph" },
      {
        name: "description",
        content:
          "Portfolio topology: contracts, regulations, and citation edges rendered as a static reference graph.",
      },
      { property: "og:title", content: "Dashboard — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Portfolio topology: contracts, regulations, and citation edges rendered as a static reference graph.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(contractsQuery);
    context.queryClient.ensureQueryData(regulationsQuery);
  },
  component: Dashboard,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Dashboard unavailable" error={error} reset={reset} />
  ),
});

function Dashboard() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: regulations } = useSuspenseQuery(regulationsQuery);

  return (
    <AppShell>
      <GraphMedallion contracts={contracts} regulations={regulations} />
    </AppShell>
  );
}
