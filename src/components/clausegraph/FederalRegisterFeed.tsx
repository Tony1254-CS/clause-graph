import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { federalRegisterQuery } from "@/data/queries";

export function FederalRegisterFeed() {
  const { data } = useSuspenseQuery(federalRegisterQuery);
  const hasError = Boolean(data.error);
  const isEmpty = !hasError && data.results.length === 0;

  return (
    <section
      className="rounded-[20px] border border-dashed border-[var(--hairline)] p-6"
      style={{ backgroundColor: "var(--surface-raised)" }}
    >
      <header className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brass opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brass" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
            LIVE · Federal Register
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          federalregister.gov/api/v1
        </span>
      </header>

      {hasError && (
        <div className="rounded-[12px] border border-[var(--hairline)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Live feed unavailable
          </p>
          <p className="mt-2 font-display text-[17px] leading-[1.3] text-foreground">
            The Federal Register API didn't respond.
          </p>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground">
            Curated ontology above is unaffected — try again in a moment.
          </p>
        </div>
      )}

      {isEmpty && (
        <div className="rounded-[12px] border border-[var(--hairline)] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            No filings today
          </p>
          <p className="mt-2 font-display text-[17px] leading-[1.3] text-foreground">
            The Federal Register returned no recent filings.
          </p>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground">
            The curated ontology above is still available.
          </p>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-dashed divide-[var(--hairline)]">
        {data.results.map((doc) => (
          <li key={doc.document_number} className="py-4">
            <a
              href={doc.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group grid grid-cols-1 md:grid-cols-[110px_1fr_auto] items-start gap-2 md:gap-4"
            >
              <span className="font-mono text-[11px] text-muted-foreground pt-0.5">
                {doc.publication_date}
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] leading-[1.5] text-foreground group-hover:text-brass duration-150 ease-out transition-colors">
                  {doc.title}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {doc.agencies?.map((a) => a.name).join(" · ") || "—"}
                  {doc.type ? ` · ${doc.type}` : ""}
                </p>
              </div>
              <ExternalLink
                className="hidden md:block h-3.5 w-3.5 text-muted-foreground group-hover:text-brass duration-150 ease-out transition-colors mt-1"
                strokeWidth={1.6}
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FederalRegisterFeedSkeleton() {
  return (
    <section
      className="rounded-[20px] border border-dashed border-[var(--hairline)] p-6"
      style={{ backgroundColor: "var(--surface-raised)" }}
    >
      <header className="flex items-center gap-2.5 mb-5">
        <span className="h-2 w-2 rounded-full bg-brass/40" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          LIVE · Federal Register · reading
        </span>
      </header>
      <div className="rounded-[12px] border border-[var(--hairline)] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Fetching latest filings
        </p>
        <p className="mt-2 font-display text-[17px] leading-[1.3] text-foreground">
          Pulling the newest rulemaking activity from the Federal Register.
        </p>
        <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground">
          Five most recent documents will appear here as soon as the API responds.
        </p>
      </div>
    </section>
  );
}

