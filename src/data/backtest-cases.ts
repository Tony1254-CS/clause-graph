import type { SimulationResult } from "@/lib/simulate-types";

export type ReconstructedClause = {
  id: string;
  text: string;
};

export type BacktestCase = {
  id: string;
  company: string;
  fine_usd: number;
  date: string; // ISO
  regulation: string;
  summary: string;
  source: string;
  reconstructed_prompt: string;
  reconstructed_clauses: ReconstructedClause[];
  fallback: SimulationResult;
};

export const backtestCases: BacktestCase[] = [
  {
    id: "BT-WF-2020",
    company: "Wells Fargo & Co.",
    fine_usd: 3_000_000_000,
    date: "2020-02-21",
    regulation: "FTC Act §5 · Dodd-Frank UDAAP · SEC Exchange Act",
    summary:
      "Settled DOJ and SEC actions over widespread unauthorized customer accounts and unlawful sales incentives that operated for more than a decade.",
    source: "DOJ press release, 2020-02-21",
    reconstructed_prompt:
      "New rule requires every retail-banking sales incentive program to be independently audited quarterly, and prohibits opening any deposit or credit product without a contemporaneous written customer consent record retained for seven years.",
    reconstructed_clauses: [
      {
        id: "RC-1",
        text: "Retail bankers shall earn variable compensation based on the number of deposit, credit-card, and line-of-credit products opened per quarter, with tiered accelerators above quota.",
      },
      {
        id: "RC-2",
        text: "Product enrollment may be initiated upon a customer's verbal indication of interest, with written confirmation provided in the subsequent monthly statement.",
      },
      {
        id: "RC-3",
        text: "Branch managers shall not disclose individual banker performance data to external auditors absent written approval from the Regional Sales Executive.",
      },
    ],
    fallback: {
      fallback: true,
      summary:
        "Reconstructed sales-incentive and enrollment clauses conflict with the proposed audit-and-consent regime; all three require material redraft.",
      impacts: [
        {
          contract_id: "RC-1",
          severity: "high",
          suggested_amendment:
            "Cap variable compensation at a fixed percentage tied to customer-retention outcomes rather than product-count quotas, and subject the plan to quarterly independent audit.",
        },
        {
          contract_id: "RC-2",
          severity: "high",
          suggested_amendment:
            "Require signed written consent captured contemporaneously with enrollment and retained for seven years before any product is opened.",
        },
        {
          contract_id: "RC-3",
          severity: "medium",
          suggested_amendment:
            "Grant external auditors unconditional access to individual banker performance data on request, overriding internal approval gates.",
        },
      ],
    },
  },
  {
    id: "BT-GS-2020",
    company: "Goldman Sachs Group, Inc.",
    fine_usd: 2_900_000_000,
    date: "2020-10-22",
    regulation: "Foreign Corrupt Practices Act (FCPA)",
    summary:
      "Global resolution over the 1MDB scheme in which more than $1.6B in bribes were paid to foreign officials in Malaysia and Abu Dhabi to secure bond underwriting mandates.",
    source: "DOJ / SEC / FRB coordinated resolution, 2020-10-22",
    reconstructed_prompt:
      "New rule requires enhanced due diligence on all sovereign and quasi-sovereign underwriting mandates, mandatory intermediary registration, and personal certification by the deal captain that no payments were made to secure the mandate.",
    reconstructed_clauses: [
      {
        id: "RC-1",
        text: "The Advisor may engage local consultants to facilitate introductions to sovereign counterparties, with fees payable through a designated intermediary account.",
      },
      {
        id: "RC-2",
        text: "Underwriting fees on this mandate shall be set at market rates, subject to negotiation with the Issuer's designated representative.",
      },
      {
        id: "RC-3",
        text: "The Bank represents that internal compliance review has been completed in accordance with its standard onboarding procedures.",
      },
    ],
    fallback: {
      fallback: true,
      summary:
        "Intermediary-payment and self-certified compliance language is squarely incompatible with the proposed FCPA due-diligence and captain-certification regime.",
      impacts: [
        {
          contract_id: "RC-1",
          severity: "high",
          suggested_amendment:
            "Prohibit payments to any intermediary that is not registered under the new rule and require identification of ultimate beneficial owners before any fee is disbursed.",
        },
        {
          contract_id: "RC-2",
          severity: "medium",
          suggested_amendment:
            "Add a benchmarking clause requiring fees to be justified against public comparable transactions and disclosed to the Issuer's board.",
        },
        {
          contract_id: "RC-3",
          severity: "high",
          suggested_amendment:
            "Replace the general compliance representation with a personal certification by the named deal captain that no payments were made to secure the mandate.",
        },
      ],
    },
  },
  {
    id: "BT-CS-2022",
    company: "Credit Suisse Group AG",
    fine_usd: 475_000_000,
    date: "2022-10-19",
    regulation: "FCPA · UK Bribery Act · Market Abuse Regulation",
    summary:
      "Coordinated US/UK settlement over the Mozambique 'tuna bond' loans, in which bankers took kickbacks and material information was concealed from investors.",
    source: "DOJ / SEC / FCA coordinated resolution, 2018-10-19 (final terms 2022)",
    reconstructed_prompt:
      "New rule requires disclosure to investors of all fees paid to counterparty officials or their affiliates, mandatory use-of-proceeds monitoring, and a prohibition on any banker receiving compensation contingent on deal closing when the borrower is a sovereign entity.",
    reconstructed_clauses: [
      {
        id: "RC-1",
        text: "Success fees payable to the arranging bank team shall be contingent on the closing of the transaction and calculated as a percentage of gross proceeds.",
      },
      {
        id: "RC-2",
        text: "The Borrower shall apply the proceeds toward maritime infrastructure and general working capital, without further itemization to lenders.",
      },
      {
        id: "RC-3",
        text: "Bond marketing materials shall be prepared based on information provided by the Borrower, and the Arranger disclaims responsibility for its accuracy.",
      },
    ],
    fallback: {
      fallback: true,
      summary:
        "Contingent success fees and thin use-of-proceeds disclosure are directly targeted by the proposed rule; the marketing-materials disclaimer no longer discharges the arranger.",
      impacts: [
        {
          contract_id: "RC-1",
          severity: "high",
          suggested_amendment:
            "Remove closing-contingent compensation for sovereign transactions and replace with a fixed advisory retainer disclosed to investors in offering materials.",
        },
        {
          contract_id: "RC-2",
          severity: "high",
          suggested_amendment:
            "Require line-item use-of-proceeds reporting to a named monitoring agent, with lender step-in rights on material deviation.",
        },
        {
          contract_id: "RC-3",
          severity: "medium",
          suggested_amendment:
            "Impose an independent verification obligation on the Arranger for all material representations in bond marketing materials, with liability for omissions.",
        },
      ],
    },
  },
];

export function formatFine(usd: number): string {
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(0)}M`;
  return `$${usd.toLocaleString()}`;
}
