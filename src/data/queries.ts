import { queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { contracts } from "./contracts";
import { regulations } from "./regulations";
import type { FederalRegisterDoc } from "./types";

export const contractsQuery = queryOptions({
  queryKey: ["contracts"],
  queryFn: async () => contracts,
  staleTime: Infinity,
});

export const regulationsQuery = queryOptions({
  queryKey: ["regulations"],
  queryFn: async () => regulations,
  staleTime: Infinity,
});

export const contractQuery = (id: string) =>
  queryOptions({
    queryKey: ["contracts", id],
    queryFn: async () => {
      const c = contracts.find((x) => x.id === id);
      if (!c) throw notFound();
      return c;
    },
    staleTime: Infinity,
  });

export const regulationQuery = (id: string) =>
  queryOptions({
    queryKey: ["regulations", id],
    queryFn: async () => {
      const r = regulations.find((x) => x.id === id);
      if (!r) throw notFound();
      return r;
    },
    staleTime: Infinity,
  });

export type FederalRegisterResult = {
  results: FederalRegisterDoc[];
  error?: string;
};

export const federalRegisterQuery = queryOptions({
  queryKey: ["federal-register", "newest", 5],
  queryFn: async (): Promise<FederalRegisterResult> => {
    try {
      const res = await fetch(
        "https://www.federalregister.gov/api/v1/documents?per_page=5&order=newest&fields[]=document_number&fields[]=title&fields[]=publication_date&fields[]=agencies&fields[]=html_url&fields[]=type",
      );
      if (!res.ok) return { results: [], error: `HTTP ${res.status}` };
      const json = (await res.json()) as { results?: FederalRegisterDoc[] };
      return { results: json.results ?? [] };
    } catch (e) {
      return { results: [], error: e instanceof Error ? e.message : "network error" };
    }
  },
  staleTime: 5 * 60_000,
});

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
