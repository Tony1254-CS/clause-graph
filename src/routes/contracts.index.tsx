import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ContractCard } from "@/components/clausegraph/ContractCard";
import { contractsQuery, formatUSD } from "@/data/queries";

export const Route = createFileRoute("/contracts/")({
  head: () => ({
    meta: [
      { title: "Contracts — ClauseGraph" },
      {
        name: "description",
        content:
          "Active contract portfolio: ISDA masters, prime brokerage, credit facilities, and custody agreements with notional exposure and clause counts.",
      },
      { property: "og:title", content: "Contracts — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Active contract portfolio: ISDA masters, prime brokerage, credit facilities, and custody agreements with notional exposure and clause counts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(contractsQuery),
  component: ContractsIndex,
  errorComponent: ContractsError,
});

function ContractsIndex() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);

  if (contracts.length === 0) {
    return (
      <div className="w-full max-w-[720px]">
        <div className="glass-panel p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Empty portfolio
          </p>
          <h1 className="mt-3 font-display text-[26px] leading-[1.15] tracking-tight text-foreground">
            No contracts have been indexed yet.
          </h1>
          <p className="mt-3 text-[13.5px] leading-[1.6] text-muted-foreground max-w-[56ch]">
            ClauseGraph loads its corpus from{" "}
            <span className="font-mono text-brass">src/data/contracts.ts</span>. Add agreements
            there — each with a name, counterparty, notional value, and clauses citing regulations
            — and they'll appear here.
          </p>
        </div>
      </div>
    );
  }

  const totalNotional = contracts.reduce((s, c) => s + c.value, 0);
  const totalClauses = contracts.reduce((s, c) => s + c.clauses.length, 0);

  return (
    <div className="w-full max-w-[1200px]">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
            Portfolio · {contracts.length} instruments
          </p>
          <h1 className="mt-2 font-display text-[38px] leading-[1.05] tracking-tight text-foreground">
            Contracts
          </h1>
        </div>
        <div className="flex flex-wrap gap-8">
          <Stat label="Aggregate notional" value={formatUSD(totalNotional)} />
          <Stat label="Clauses indexed" value={String(totalClauses)} />
        </div>
      </header>

      <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {contracts.map((c) => (
          <ContractCard key={c.id} contract={c} />
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 font-mono text-[15px] text-brass">{value}</span>
    </div>
  );
}

function ContractsError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="glass-panel p-8 max-w-md">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Couldn't load contracts
      </p>
      <p className="mt-2 font-display text-[20px] leading-[1.2] text-foreground">
        Something got in the way of reading the corpus.
      </p>
      <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk)] mr-2 align-middle" />
        {error.message}
      </p>
      <button
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className="mt-4 rounded-[12px] bg-brass px-4 py-2 text-sm text-[color:var(--primary-foreground)] duration-150 ease-out transition-all hover:bg-[color:var(--brass-strong)]"
      >
        Retry
      </button>
    </div>
  );
}
