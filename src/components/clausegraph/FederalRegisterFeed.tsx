import { useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { federalRegisterQuery } from "@/data/queries";

export function FederalRegisterFeed() {
  const { data } = useSuspenseQuery(federalRegisterQuery);

  return (
    <section
      className="rounded-[16px] border border-dashed border-[var(--hairline)] p-6"
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

      {data.error && (
        <p className="font-mono text-[11px] text-muted-foreground py-4 text-center">
          Live feed temporarily unavailable · {data.error}
        </p>
      )}

      {!data.error && data.results.length === 0 && (
        <p className="font-mono text-[11px] text-muted-foreground py-4 text-center">
          No recent filings.
        </p>
      )}

      <ul className="flex flex-col divide-y divide-dashed divide-[var(--hairline)]">
        {data.results.map((doc) => (
          <li key={doc.document_number} className="py-4">
            <a
              href={doc.html_url}
              target="_blank"
              rel="noopener noreferrer"
              className="group grid grid-cols-[110px_1fr_auto] items-start gap-4"
            >
              <span className="font-mono text-[11px] text-muted-foreground pt-0.5">
                {doc.publication_date}
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] leading-[1.5] text-foreground group-hover:text-brass transition-colors">
                  {doc.title}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {doc.agencies?.map((a) => a.name).join(" · ") || "—"}
                  {doc.type ? ` · ${doc.type}` : ""}
                </p>
              </div>
              <ExternalLink
                className="h-3.5 w-3.5 text-muted-foreground group-hover:text-brass transition-colors mt-1"
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
      className="rounded-[16px] border border-dashed border-[var(--hairline)] p-6"
      style={{ backgroundColor: "var(--surface-raised)" }}
    >
      <div className="flex items-center gap-2.5 mb-5">
        <span className="h-2 w-2 rounded-full bg-brass/40" />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          LIVE · Federal Register · loading
        </span>
      </div>
      <ul className="flex flex-col divide-y divide-dashed divide-[var(--hairline)]">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="py-4 grid grid-cols-[110px_1fr] gap-4">
            <div className="h-3 w-20 bg-[var(--hairline)] rounded animate-pulse" />
            <div className="space-y-2">
              <div className="h-3 w-3/4 bg-[var(--hairline)] rounded animate-pulse" />
              <div className="h-2 w-1/3 bg-[var(--hairline)] rounded animate-pulse" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
