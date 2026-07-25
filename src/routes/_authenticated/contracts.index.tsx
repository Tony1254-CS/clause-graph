import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { ContractCard } from "@/components/clausegraph/ContractCard";
import { UploadContract } from "@/components/clausegraph/UploadContract";
import { contractsQuery, formatUSD } from "@/data/queries";

export const Route = createFileRoute("/_authenticated/contracts/")({
  head: () => ({
    meta: [
      { title: "Contracts — ClauseGraph" },
      {
        name: "description",
        content:
          "Active contract portfolio with AI-extracted clauses and regulatory links.",
      },
      { property: "og:title", content: "Contracts — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Active contract portfolio with AI-extracted clauses and regulatory links.",
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
  const [uploadOpen, setUploadOpen] = useState(false);

  const totalNotional = contracts.reduce((s, c) => s + c.value, 0);
  const totalClauses = contracts.reduce((s, c) => s + c.clauses.length, 0);

  return (
    <div className="w-full max-w-[1200px]">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
            Portfolio · {contracts.length} instrument{contracts.length === 1 ? "" : "s"}
          </p>
          <h1 className="mt-2 font-display text-[38px] leading-[1.05] tracking-tight text-foreground">
            Contracts
          </h1>
        </div>
        <div className="flex flex-wrap items-end gap-8">
          <Stat label="Aggregate notional" value={formatUSD(totalNotional)} />
          <Stat label="Clauses indexed" value={String(totalClauses)} />
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 ease-out hover:-translate-y-px hover:bg-[var(--brass-strong)]"
          >
            <Upload className="h-4 w-4" strokeWidth={1.8} />
            Upload
          </button>
        </div>
      </header>

      {contracts.length === 0 ? (
        <div className="glass-panel p-8 max-w-[720px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Empty portfolio
          </p>
          <h2 className="mt-3 font-display text-[26px] leading-[1.15] tracking-tight text-foreground">
            No contracts yet.
          </h2>
          <p className="mt-3 text-[13.5px] leading-[1.6] text-muted-foreground max-w-[56ch]">
            Upload a contract to have ClauseGraph segment its clauses and link them to your
            regulatory ontology.
          </p>
          <button
            onClick={() => setUploadOpen(true)}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 ease-out hover:-translate-y-px hover:bg-[var(--brass-strong)]"
          >
            <Upload className="h-4 w-4" strokeWidth={1.8} />
            Upload your first contract
          </button>
        </div>
      ) : (
        <div className="grid gap-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {contracts.map((c, i) => (
            <div key={c.id} className="stagger-item" style={{ ["--i" as string]: i }}>
              <ContractCard contract={c} />
            </div>
          ))}
        </div>
      )}

      {uploadOpen ? <UploadContract onClose={() => setUploadOpen(false)} /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 font-mono text-[15px] text-[var(--brass)]">{value}</span>
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
        className="mt-4 rounded-full bg-[var(--brass)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] transition-all duration-200 ease-out hover:bg-[var(--brass-strong)]"
      >
        Retry
      </button>
    </div>
  );
}
