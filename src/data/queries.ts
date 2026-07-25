import { queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type {
  Contract,
  Regulation,
  FederalRegisterDoc,
  Clause,
  Obligation,
  ExtractionStatus,
} from "./types";

type ClauseRow = {
  id: string;
  text: string;
  linked_regs: string[] | null;
  position: number | null;
};

type ContractRow = {
  id: string;
  name: string;
  counterparty: string;
  value: number | string;
  clauses: ClauseRow[] | null;
  extraction_status: string | null;
  extraction_error: string | null;
  is_sample: boolean | null;
  source_file_url: string | null;
};

type RegulationRow = {
  id: string;
  jurisdiction: string;
  title: string;
  summary: string;
  obligations: unknown;
};

function mapContract(row: ContractRow): Contract {
  const clauses: Clause[] = (row.clauses ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((cl) => ({
      id: cl.id,
      text: cl.text,
      linked_regs: cl.linked_regs ?? [],
    }));
  const status = (row.extraction_status ?? "complete") as ExtractionStatus;
  return {
    id: row.id,
    name: row.name,
    counterparty: row.counterparty,
    value: typeof row.value === "string" ? Number(row.value) : row.value,
    clauses,
    extraction_status: status,
    extraction_error: row.extraction_error,
    is_sample: row.is_sample ?? false,
    source_file_url: row.source_file_url,
  };
}


function humanizeSlug(slug: string): string {
  const s = slug.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Tolerant mapper: obligations may be stored either as objects
// ({ id, text }) or as legacy slug strings. Never render blank rows.
function mapObligations(raw: unknown): Obligation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, i): Obligation | null => {
      if (typeof entry === "string") {
        return { id: entry || `ob-${i}`, text: humanizeSlug(entry) };
      }
      if (entry && typeof entry === "object") {
        const o = entry as { id?: unknown; text?: unknown; title?: unknown };
        const text =
          (typeof o.text === "string" && o.text.trim()) ||
          (typeof o.title === "string" && o.title.trim()) ||
          (typeof o.id === "string" && humanizeSlug(o.id)) ||
          "";
        if (!text) return null;
        return { id: typeof o.id === "string" && o.id ? o.id : `ob-${i}`, text };
      }
      return null;
    })
    .filter((o): o is Obligation => o !== null);
}

function mapRegulation(row: RegulationRow): Regulation {
  return {
    id: row.id,
    jurisdiction: row.jurisdiction,
    title: row.title,
    summary: row.summary,
    obligations: mapObligations(row.obligations),
  };
}

export const contractsQuery = queryOptions({
  queryKey: ["contracts"],
  queryFn: async (): Promise<Contract[]> => {
    const { data, error } = await supabase
      .from("contracts")
      .select(
        "id, name, counterparty, value, extraction_status, extraction_error, is_sample, source_file_url, clauses(id, text, linked_regs, position)",
      )
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => mapContract(r as ContractRow));
  },
  staleTime: 30_000,
  refetchInterval: (query) => {
    const rows = query.state.data as Contract[] | undefined;
    return rows?.some((c) => c.extraction_status === "processing") ? 3000 : false;
  },
});


export const regulationsQuery = queryOptions({
  queryKey: ["regulations"],
  queryFn: async (): Promise<Regulation[]> => {
    const { data, error } = await supabase
      .from("regulations")
      .select("id, jurisdiction, title, summary, obligations")
      .order("id", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => mapRegulation(r as RegulationRow));
  },
  staleTime: 60_000,
});

export const contractQuery = (id: string) =>
  queryOptions({
    queryKey: ["contracts", id],
    queryFn: async (): Promise<Contract> => {
      const { data, error } = await supabase
        .from("contracts")
        .select(
          "id, name, counterparty, value, extraction_status, extraction_error, is_sample, source_file_url, clauses(id, text, linked_regs, position)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return mapContract(data as ContractRow);
    },
    staleTime: 30_000,
    refetchInterval: (query) => {
      const row = query.state.data as Contract | undefined;
      return row?.extraction_status === "processing" ? 3000 : false;
    },
  });


export const regulationQuery = (id: string) =>
  queryOptions({
    queryKey: ["regulations", id],
    queryFn: async (): Promise<Regulation> => {
      const { data, error } = await supabase
        .from("regulations")
        .select("id, jurisdiction, title, summary, obligations")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return mapRegulation(data as RegulationRow);
    },
    staleTime: 60_000,
  });

export type ProfileWithOrg = {
  id: string;
  email: string | null;
  full_name: string | null;
  org: { id: string; name: string; plan: string } | null;
};

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async (): Promise<ProfileWithOrg | null> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, organizations:org_id(id, name, plan)")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const orgs = (data as { organizations: unknown }).organizations;
    const org = Array.isArray(orgs) ? (orgs[0] ?? null) : (orgs ?? null);
    return {
      id: (data as { id: string }).id,
      email: (data as { email: string | null }).email,
      full_name: (data as { full_name: string | null }).full_name,
      org: org as ProfileWithOrg["org"],
    };
  },
  staleTime: 60_000,
});

export type BacktestCaseRow = {
  id: string;
  company: string;
  fine_usd: number;
  case_date: string;
  regulation: string;
  summary: string;
  source: string;
  reconstructed_prompt: string;
  reconstructed_clauses: { id: string; text: string }[];
  fallback: import("@/lib/simulate-types").SimulationResult;
};

export const backtestCasesQuery = queryOptions({
  queryKey: ["backtest-cases"],
  queryFn: async (): Promise<BacktestCaseRow[]> => {
    const { data, error } = await supabase
      .from("backtest_cases")
      .select(
        "id, company, fine_usd, case_date, regulation, summary, source, reconstructed_prompt, reconstructed_clauses, fallback, position",
      )
      .order("position", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      company: r.company,
      fine_usd: Number(r.fine_usd),
      case_date: r.case_date,
      regulation: r.regulation,
      summary: r.summary,
      source: r.source,
      reconstructed_prompt: r.reconstructed_prompt,
      reconstructed_clauses: r.reconstructed_clauses as unknown as { id: string; text: string }[],
      fallback: r.fallback as unknown as import("@/lib/simulate-types").SimulationResult,
    }));

  },
  staleTime: 5 * 60_000,
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

// --- Team members & role -----------------------------------------------

export type TeamMember = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "member" | null;
  is_self: boolean;
};

export const teamMembersQuery = queryOptions({
  queryKey: ["team-members"],
  queryFn: async (): Promise<TeamMember[]> => {
    const { data: userData } = await supabase.auth.getUser();
    const selfId = userData.user?.id ?? null;

    const { data: profiles, error: pErr } = await supabase
      .from("profiles")
      .select("id, email, full_name");
    if (pErr) throw pErr;

    const { data: roles, error: rErr } = await supabase
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw rErr;

    const roleByUser = new Map<string, "admin" | "member">();
    (roles ?? []).forEach((r) => {
      roleByUser.set(r.user_id, r.role as "admin" | "member");
    });

    return (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: roleByUser.get(p.id) ?? null,
      is_self: p.id === selfId,
    }));
  },
  staleTime: 30_000,
});

export const myRoleQuery = queryOptions({
  queryKey: ["my-role"],
  queryFn: async (): Promise<"admin" | "member" | null> => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (error) throw error;
    return (data?.role as "admin" | "member" | undefined) ?? null;
  },
  staleTime: 60_000,
});

