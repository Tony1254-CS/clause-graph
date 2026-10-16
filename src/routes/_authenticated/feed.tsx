import { Suspense } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/clausegraph/AppShell";
import { JurisdictionChip } from "@/components/clausegraph/JurisdictionChip";
import {
  FederalRegisterFeed,
  FederalRegisterFeedSkeleton,
} from "@/components/clausegraph/FederalRegisterFeed";
import { federalRegisterQuery, regulationsQuery } from "@/data/queries";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Regulatory Feed — ClauseGraph" },
      {
        name: "description",
        content:
          "Curated ClauseGraph regulatory ontology alongside live filings from the U.S. Federal Register.",
      },
      { property: "og:title", content: "Regulatory Feed — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Curated ClauseGraph regulatory ontology alongside live filings from the U.S. Federal Register.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(regulationsQuery);
    context.queryClient.prefetchQuery(federalRegisterQuery);
  },
  component: FeedPage,
  errorComponent: FeedError,
});

function FeedPage() {
  const { data: regs } = useSuspenseQuery(regulationsQuery);

  return (
    <AppShell>
      <div className="w-full max-w-[1000px]">
        <header className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
            Regulatory intake
          </p>
          <h1 className="mt-2 font-display text-[38px] leading-[1.05] tracking-tight text-foreground">
            Feed
          </h1>
          <p className="mt-3 text-[13.5px] text-muted-foreground max-w-[60ch]">
            Two streams: our curated obligation ontology (indexed against the portfolio) and a live
            window into the U.S. Federal Register's newest rulemaking activity.
          </p>
        </header>

        <section className="mb-10">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-brass" />
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
                CURATED · ClauseGraph ontology
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {regs.length} entries
            </span>
          </div>

          {regs.length === 0 ? (
            <div className="glass-panel p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                No ontology entries
              </p>
              <p className="mt-2 font-display text-[19px] leading-[1.2] text-foreground">
                The curated regulatory ontology is empty.
              </p>
              <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
                Add entries to <span className="font-mono text-brass">src/data/regulations.ts</span>{" "}
                to populate this stream. The live Federal Register feed below is still available.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {regs.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/regulations/$regId"
                    params={{ regId: r.id }}
                    className="glass-panel group grid grid-cols-1 md:grid-cols-[130px_1fr_auto] items-start gap-3 md:gap-6 p-5 duration-150 ease-out transition-all hover:border-[var(--hairline-strong)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <JurisdictionChip jurisdiction={r.jurisdiction} />
                      <span className="font-mono text-[10px] text-muted-foreground">{r.id}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-[17px] leading-[1.25] tracking-tight text-foreground group-hover:text-brass duration-150 ease-out transition-colors">
                        {r.title}
                      </h3>
                      <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground line-clamp-2 max-w-[60ch]">
                        {r.summary}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:pt-1">
                      {r.obligations.length} ob.
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Suspense fallback={<FederalRegisterFeedSkeleton />}>
          <FederalRegisterFeed />
        </Suspense>
      </div>
    </AppShell>
  );
}

function FeedError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <AppShell>
      <div className="glass-panel p-8 max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Couldn't load the feed
        </p>
        <p className="mt-2 font-display text-[20px] leading-[1.2] text-foreground">
          The regulatory intake stream isn't responding.
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
    </AppShell>
  );
}
