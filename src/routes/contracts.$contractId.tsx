import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { ClauseRow } from "@/components/clausegraph/ClauseRow";
import { contractQuery, formatUSD } from "@/data/queries";

export const Route = createFileRoute("/contracts/$contractId")({
  head: ({ loaderData }) => {
    const name = loaderData?.name ?? "Contract";
    return {
      meta: [
        { title: `${name} — ClauseGraph` },
        {
          name: "description",
          content: loaderData
            ? `${name} with ${loaderData.counterparty}. ${loaderData.clauses.length} clauses mapped to regulatory obligations.`
            : "Contract detail",
        },
        { property: "og:title", content: `${name} — ClauseGraph` },
        {
          property: "og:description",
          content: loaderData
            ? `${name} with ${loaderData.counterparty}. ${loaderData.clauses.length} clauses mapped to regulatory obligations.`
            : "Contract detail",
        },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(contractQuery(params.contractId)),
  component: ContractDetail,
  errorComponent: DetailError,
  notFoundComponent: () => {
    const { contractId } = Route.useParams();
    return (
      <div className="glass-panel p-8 text-center max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Not found
        </p>
        <p className="mt-2 text-foreground">No contract with ID {contractId}.</p>
        <Link
          to="/contracts"
          className="mt-4 inline-block rounded-[12px] border border-[var(--hairline-strong)] px-4 py-2 text-sm"
        >
          Back to contracts
        </Link>
      </div>
    );
  },
});

function ContractDetail() {
  const { contractId } = Route.useParams();
  const { data: contract } = useSuspenseQuery(contractQuery(contractId));

  return (
    <div className="w-full max-w-[900px]">
      <Link
        to="/contracts"
        className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-brass transition-colors mb-8"
      >
        <ArrowLeft className="h-3 w-3" />
        All contracts
      </Link>

      <header className="glass-panel p-8 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass">
            {contract.id}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {contract.clauses.length} clauses
          </span>
        </div>
        <h1 className="font-display text-[32px] leading-[1.1] tracking-tight text-foreground">
          {contract.name}
        </h1>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6 pt-6 border-t border-[var(--hairline)]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Counterparty
            </p>
            <p className="mt-1 text-[15px] text-foreground">{contract.counterparty}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Notional
            </p>
            <p className="mt-1 font-mono text-[22px] text-brass">{formatUSD(contract.value)}</p>
          </div>
        </div>
      </header>

      <section>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass mb-4">
          Clauses
        </h2>
        <div className="flex flex-col gap-3">
          {contract.clauses.map((cl) => (
            <ClauseRow key={cl.id} clause={cl} />
          ))}
        </div>
      </section>
    </div>
  );
}

function DetailError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
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
  );
}
