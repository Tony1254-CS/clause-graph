// src/lib/impact/stale-citations.server.ts
// Stale-citation detector: identifies clauses referencing repealed/superseded legislation (Phase 3 T3.5)

import { query } from "../db.server";

export interface RepealChainNode {
  instrumentId: string;
  title: string;
  status: string;
  inForceFrom?: string | null;
  repealedOn?: string | null;
  officialUrl?: string | null;
}

export interface StaleCitationAlert {
  clauseId: string;
  contractId: string;
  contractName: string;
  contractValue: number;
  clauseText: string;
  matchedCitation: string;
  repealedInstrumentId: string;
  repealedInstrumentTitle: string;
  repealedOn: string;
  replacementInstrumentId: string;
  replacementInstrumentTitle: string;
  replacementStatus: string;
  officialUrl?: string;
  repealChain: RepealChainNode[];
  suggestedAction: string;
}

interface StalePattern {
  instrumentId: string;
  regex: RegExp;
  extractCitation: (text: string) => string;
}

const STALE_PATTERNS: StalePattern[] = [
  {
    instrumentId: "bd-digital-security-act-2018",
    regex:
      /(?:§\s*26\s+(?:of\s+the\s+)?Digital\s+Security\s+Act|Digital\s+Security\s+Act(?:,?\s*2018)?|Act\s+No\.\s*46\s+of\s+2018)/i,
    extractCitation: (text: string) => {
      const m = text.match(
        /(?:§\s*26\s+(?:of\s+the\s+)?Digital\s+Security\s+Act(?:\s*2018)?|Digital\s+Security\s+Act(?:\s*2018)?)/i,
      );
      return m ? m[0] : "Digital Security Act 2018";
    },
  },
  {
    instrumentId: "bd-cyber-security-act-2023",
    regex: /(?:Cyber\s+Security\s+Act(?:,?\s*2023)?|Act\s+No\.\s*40\s+of\s+2023|\bCSA\s*2023\b)/i,
    extractCitation: (text: string) => {
      const m = text.match(/Cyber\s+Security\s+Act(?:\s*2023)?/i);
      return m ? m[0] : "Cyber Security Act 2023";
    },
  },
];

/**
 * Scans tenant clauses for citations to repealed or superseded statutes.
 */
export async function detectStaleCitations(orgId: string): Promise<StaleCitationAlert[]> {
  // 1. Fetch repealed/superseded instruments with their replacement details
  const instruments = await query<{
    id: string;
    title: string;
    status: string;
    in_force_from: string | null;
    repealed_on: string | null;
    superseded_by: string | null;
    official_url: string | null;
  }>(
    `SELECT id, title, status, in_force_from, repealed_on, superseded_by, official_url
     FROM public.legal_instruments`,
  );

  const instrumentMap = new Map(instruments.map((i) => [i.id, i]));

  // Build full chain for an instrument
  function getChain(startId: string): RepealChainNode[] {
    const chain: RepealChainNode[] = [];
    let currId: string | null = startId;
    const visited = new Set<string>();

    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const inst = instrumentMap.get(currId);
      if (!inst) break;
      chain.push({
        instrumentId: inst.id,
        title: inst.title,
        status: inst.status,
        inForceFrom: inst.in_force_from,
        repealedOn: inst.repealed_on,
        officialUrl: inst.official_url,
      });
      currId = inst.superseded_by;
    }
    return chain;
  }

  // 2. Fetch tenant clauses
  const clauses = await query<{
    id: string;
    contract_id: string;
    contract_name: string;
    contract_value: string | number;
    text: string;
    linked_regs: string[];
  }>(
    `SELECT cl.id, cl.contract_id, cl.text, cl.linked_regs,
            c.name as contract_name, c.value as contract_value
     FROM public.clauses cl
     JOIN public.contracts c ON c.id = cl.contract_id
     WHERE c.org_id = $1 AND c.status = 'active'`,
    [orgId],
  );

  const alerts: StaleCitationAlert[] = [];

  for (const clause of clauses) {
    const val =
      typeof clause.contract_value === "string"
        ? parseFloat(clause.contract_value) || 0
        : clause.contract_value || 0;

    for (const pattern of STALE_PATTERNS) {
      const isLinked =
        clause.linked_regs.includes("REG-BD-DSA-2018") &&
        pattern.instrumentId === "bd-digital-security-act-2018";
      const matchesText = pattern.regex.test(clause.text);

      if (matchesText || isLinked) {
        const inst = instrumentMap.get(pattern.instrumentId);
        if (!inst || (inst.status !== "repealed" && inst.status !== "superseded")) {
          continue;
        }

        const chain = getChain(pattern.instrumentId);
        const latest = chain.length > 0 ? chain[chain.length - 1] : null;

        const matchedCitation = matchesText
          ? pattern.extractCitation(clause.text)
          : "Digital Security Act 2018 §26";

        alerts.push({
          clauseId: clause.id,
          contractId: clause.contract_id,
          contractName: clause.contract_name,
          contractValue: val,
          clauseText: clause.text,
          matchedCitation,
          repealedInstrumentId: inst.id,
          repealedInstrumentTitle: inst.title,
          repealedOn: inst.repealed_on || "2023-09-18",
          replacementInstrumentId: latest?.instrumentId || "bd-cyber-security-ordinance-2025",
          replacementInstrumentTitle:
            latest?.title || "Cyber Security Ordinance 2025 (Ordinance No. 25 of 2025)",
          replacementStatus: latest?.status || "in_force",
          officialUrl: latest?.officialUrl || undefined,
          repealChain: chain,
          suggestedAction: `Amend clause to replace citations of '${matchedCitation}' with prevailing obligations under the ${latest?.title || "Cyber Security Ordinance 2025"}.`,
        });
        break; // matched this clause
      }
    }
  }

  return alerts;
}
