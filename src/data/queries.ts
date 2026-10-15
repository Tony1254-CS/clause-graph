import { queryOptions } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import type {
  Contract,
  Regulation,
  FederalRegisterDoc,
  Clause,
  Obligation,
  ExtractionStatus,
} from "./types";
import {
  getContractsFn,
  getContractByIdFn,
  getRegulationsFn,
  getRegulationByIdFn,
  getProfileFn,
  getBacktestCasesFn,
  getSimulationRunsFn,
  getComplianceArtifactsFn,
  getTeamMembersFn,
  getMyRoleFn,
} from "@/lib/data.functions";

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
    const data = await getContractsFn();
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
    const data = await getRegulationsFn();
    return (data ?? []).map((r) => mapRegulation(r as RegulationRow));
  },
  staleTime: 60_000,
});

export const contractQuery = (id: string) =>
  queryOptions({
    queryKey: ["contracts", id],
    queryFn: async (): Promise<Contract> => {
      const data = await getContractByIdFn({ data: { id } });
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
      const data = await getRegulationByIdFn({ data: { id } });
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
    try {
      const data = await getProfileFn();
      if (!data) return null;
      return {
        id: data.id,
        email: data.email,
        full_name: data.full_name,
        org: data.org,
      };
    } catch {
      return null;
    }
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
    const data = await getBacktestCasesFn();
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

// --- Simulation history & compliance artifacts -------------------------

export type SimulationRunRow = {
  id: string;
  created_at: string;
  run_type: "reactive" | "forecast" | "what_if" | "supply_chain" | string;
  input_regulation_text: string;
  result: import("@/lib/simulate-types").SimulationResult & {
    hits?: Array<{ node_id: string; severity: string; hop: number }>;
    total_indirect_exposure?: number;
    remediation?: string[];
  };
};

export const simulationRunsQuery = queryOptions({
  queryKey: ["simulation-runs"],
  queryFn: async (): Promise<SimulationRunRow[]> => {
    const data = await getSimulationRunsFn();
    return (data ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      run_type: (r.run_type ?? "reactive") as SimulationRunRow["run_type"],
      input_regulation_text: r.input_regulation_text ?? "",
      result: (r.result_json ?? {}) as SimulationRunRow["result"],
    }));
  },
  staleTime: 15_000,
});

export type ComplianceArtifactRow = {
  id: string;
  created_at: string;
  regulation_id: string | null;
  gap: string | null;
  stack: string | null;
  runbook: string | null;
  audit_script: { language?: string; filename?: string; code?: string } | null;
  remediation: { language?: string; filename?: string; code?: string } | null;
  test_cases: string[] | null;
};

export const complianceArtifactsQuery = queryOptions({
  queryKey: ["compliance-artifacts"],
  queryFn: async (): Promise<ComplianceArtifactRow[]> => {
    const data = await getComplianceArtifactsFn();
    return (data ?? []).map((r) => ({
      id: r.id,
      created_at: r.created_at,
      regulation_id: r.regulation_id ?? null,
      gap: r.gap ?? null,
      stack: r.stack ?? null,
      runbook: r.runbook ?? null,
      audit_script: (r.audit_script ?? null) as ComplianceArtifactRow["audit_script"],
      remediation: (r.remediation ?? null) as ComplianceArtifactRow["remediation"],
      test_cases: (r.test_cases ?? null) as string[] | null,
    }));
  },
  staleTime: 15_000,
});

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
    const data = await getTeamMembersFn();
    return (data ?? []).map((p) => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      role: p.role,
      is_self: p.is_self,
    }));
  },
  staleTime: 30_000,
});

export const myRoleQuery = queryOptions({
  queryKey: ["my-role"],
  queryFn: async (): Promise<"admin" | "member" | null> => {
    const data = await getMyRoleFn();
    return data ?? null;
  },
  staleTime: 60_000,
});
