import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/clausegraph/AppShell";
import { GraphMedallion } from "@/components/clausegraph/GraphMedallion";
import { contractsQuery, regulationsQuery } from "@/data/queries";
import { RouteError } from "@/components/clausegraph/RouteError";
import { StaleCitationWidget } from "@/components/clausegraph/stale/StaleCitationWidget";
import { fetchStaleFindings } from "@/lib/stale/fetch.functions";
import { runStaleScan } from "@/lib/stale/scan.functions";

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
  const queryClient = useQueryClient();

  const { data: staleData, isLoading: isStaleLoading } = useQuery({
    queryKey: ["stale-findings-stats"],
    queryFn: () => fetchStaleFindings({ data: {} }),
  });

  const handleRunScan = async () => {
    await runStaleScan({ data: { triggerSource: "manual" } });
    await queryClient.invalidateQueries({ queryKey: ["stale-findings-stats"] });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <GraphMedallion contracts={contracts} regulations={regulations} />
        <StaleCitationWidget
          stats={staleData?.stats ?? null}
          isLoading={isStaleLoading}
          onRunScan={handleRunScan}
        />
      </div>
    </AppShell>
  );
}

