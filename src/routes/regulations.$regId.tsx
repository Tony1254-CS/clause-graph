import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { JurisdictionChip } from "@/components/clausegraph/JurisdictionChip";
import { contractsQuery, regulationQuery } from "@/data/queries";

export const Route = createFileRoute("/regulations/$regId")({
  head: ({ loaderData }) => {
    const title = loaderData?.title ?? "Regulation";
    return {
      meta: [
        { title: `${title} — ClauseGraph` },
        {
          name: "description",
          content: loaderData?.summary ?? "Regulation detail",
        },
        { property: "og:title", content: `${title} — ClauseGraph` },
        { property: "og:description", content: loaderData?.summary ?? "Regulation detail" },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  loader: async ({ context, params }) => {
    context.queryClient.ensureQueryData(contractsQuery);
    return context.queryClient.ensureQueryData(regulationQuery(params.regId));
  },
  component: RegulationDetail,
  errorComponent: DetailError,
  notFoundComponent: () => {
    const { regId } = Route.useParams();
    return (
      <AppShell>
        <div className="glass-panel p-8 text-center max-w-md">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Not found
          </p>
          <p className="mt-2 text-foreground">No regulation with ID {regId}.</p>
          <Link
            to="/feed"
            className="mt-4 inline-block rounded-[12px] border border-[var(--hairline-strong)] px-4 py-2 text-sm"
          >
            Back to feed
          </Link>
        </div>
      </AppShell>
    );
  },
});

function RegulationDetail() {
  const { regId } = Route.useParams();
  const { data: reg } = useSuspenseQuery(regulationQuery(regId));
  const { data: contracts } = useSuspenseQuery(contractsQuery);

  const citingContracts = contracts.filter((c) =>
    c.clauses.some((cl) => cl.linked_regs.includes(regId)),
  );
  const citingClauses = contracts.reduce(
    (acc, c) => acc + c.clauses.filter((cl) => cl.linked_regs.includes(regId)).length,
    0,
  );

  return (
    <AppShell>
      <div className="w-full max-w-[900px]">
        <Link
          to="/feed"
          className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-brass transition-colors mb-8"
        >
          <ArrowLeft className="h-3 w-3" />
          Regulatory feed
        </Link>

        <header className="glass-panel p-8 mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <JurisdictionChip jurisdiction={reg.jurisdiction} />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {reg.id}
            </span>
          </div>
          <h1 className="font-display text-[30px] leading-[1.1] tracking-tight text-foreground">
            {reg.title}
          </h1>
          <p className="mt-4 text-[15px] leading-[1.65] text-muted-foreground max-w-[68ch]">
            {reg.summary}
          </p>
        </header>

        <section className="mb-6">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass mb-4">
            Obligations · {reg.obligations.length}
          </h2>
          <ol className="flex flex-col gap-2">
            {reg.obligations.map((ob, i) => (
              <li
                key={ob.id}
                className="glass-panel-sm grid grid-cols-[40px_1fr] gap-4 p-4"
              >
                <span className="font-mono text-[13px] text-brass pt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[14.5px] leading-[1.6] text-foreground/90">{ob.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="glass-panel p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
              Cited by
            </h2>
            <span className="font-mono text-[11px] text-muted-foreground">
              {citingClauses} clause{citingClauses === 1 ? "" : "s"} · {citingContracts.length}{" "}
              contract{citingContracts.length === 1 ? "" : "s"}
            </span>
          </div>
          {citingContracts.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">Not currently cited in the portfolio.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--hairline)]">
              {citingContracts.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/contracts/$contractId"
                    params={{ contractId: c.id }}
                    className="grid grid-cols-[90px_1fr_auto] items-center gap-4 py-3 hover:text-brass transition-colors"
                  >
                    <span className="font-mono text-[11px] text-muted-foreground">{c.id}</span>
                    <span className="text-[14px] text-foreground">{c.name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {c.counterparty}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function DetailError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <AppShell>
      <div className="glass-panel p-8 text-center max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-destructive">Error</p>
        <p className="mt-2 text-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-4 rounded-[12px] bg-brass px-4 py-2 text-sm text-[color:var(--primary-foreground)]"
        >
          Retry
        </button>
      </div>
    </AppShell>
  );
}
