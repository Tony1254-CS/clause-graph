import type { Contract } from "./types";

export const contracts: Contract[] = [
  {
    id: "CTR-001",
    name: "ISDA Master Agreement — Nomura FX Derivatives",
    counterparty: "Nomura Holdings Inc.",
    value: 425_000_000,
    clauses: [
      {
        id: "CL-001-1",
        text: "Each party represents that all information furnished in writing pursuant to this Agreement is, as of its date, true, accurate, and complete in every material respect.",
        linked_regs: ["REG-SEC-10B5"],
      },
      {
        id: "CL-001-2",
        text: "Counterparty shall report all swap transactions entered into hereunder to a registered swap data repository as soon as technologically practicable after execution.",
        linked_regs: ["REG-CFTC-P45"],
      },
      {
        id: "CL-001-3",
        text: "Both parties shall maintain records of all transactions, confirmations, and lifecycle events for a period of no less than six years from termination.",
        linked_regs: ["REG-FINRA-4511", "REG-CFTC-P45"],
      },
      {
        id: "CL-001-4",
        text: "Neither party shall engage in proprietary trading in reliance upon this Agreement in a manner prohibited by applicable banking-entity restrictions.",
        linked_regs: ["REG-DODD-VOLCKER"],
      },
    ],
  },
  {
    id: "CTR-002",
    name: "Prime Brokerage Agreement — Millennium",
    counterparty: "Millennium Management LLC",
    value: 850_000_000,
    clauses: [
      {
        id: "CL-002-1",
        text: "Broker shall have reasonable grounds to believe that any security sold short can be borrowed and delivered on settlement date.",
        linked_regs: ["REG-SEC-REGSHO"],
      },
      {
        id: "CL-002-2",
        text: "All sale orders transmitted to Broker shall be marked long, short, or short exempt in accordance with applicable rules.",
        linked_regs: ["REG-SEC-REGSHO"],
      },
      {
        id: "CL-002-3",
        text: "Broker shall preserve all confirmations, statements, and electronic communications in a non-rewriteable, non-erasable format.",
        linked_regs: ["REG-FINRA-4511"],
      },
      {
        id: "CL-002-4",
        text: "Client acknowledges receipt of Broker's Regulation Best Interest disclosure summarizing material facts about the relationship and any conflicts of interest.",
        linked_regs: ["REG-SEC-REGBI"],
      },
    ],
  },
  {
    id: "CTR-003",
    name: "Revolving Credit Facility — Meridian",
    counterparty: "JPMorgan Chase, N.A.",
    value: 300_000_000,
    clauses: [
      {
        id: "CL-003-1",
        text: "Borrower shall deliver quarterly financial statements certified by its principal executive and principal financial officers as fairly presenting in all material respects the financial condition of the Borrower.",
        linked_regs: ["REG-SOX-302"],
      },
      {
        id: "CL-003-2",
        text: "Lender shall maintain regulatory capital ratios consistent with applicable Basel III requirements, including a common equity Tier 1 ratio of no less than 4.5%.",
        linked_regs: ["REG-BASEL3-CAPITAL"],
      },
      {
        id: "CL-003-3",
        text: "Borrower shall promptly notify Lender of any material weakness in internal controls over financial reporting disclosed to its independent auditors.",
        linked_regs: ["REG-SOX-302"],
      },
    ],
  },
  {
    id: "CTR-004",
    name: "MSFTA — Agency MBS TBA",
    counterparty: "Wells Fargo Securities",
    value: 175_000_000,
    clauses: [
      {
        id: "CL-004-1",
        text: "Each party shall report the primary economic terms of each Transaction to a registered swap data repository within the time limits prescribed by applicable rules.",
        linked_regs: ["REG-CFTC-P45"],
      },
      {
        id: "CL-004-2",
        text: "The parties represent that all information provided regarding creditworthiness, position, and intended use is true, accurate, and complete in all material respects.",
        linked_regs: ["REG-SEC-10B5"],
      },
      {
        id: "CL-004-3",
        text: "Books and records evidencing each Transaction shall be retained for the periods required by applicable law and made available to regulators upon request.",
        linked_regs: ["REG-FINRA-4511"],
      },
    ],
  },
  {
    id: "CTR-005",
    name: "Global Custody Agreement — BNY",
    counterparty: "The Bank of New York Mellon",
    value: 120_000_000,
    clauses: [
      {
        id: "CL-005-1",
        text: "Custodian shall implement appropriate technical and organizational measures to protect personal data of underlying beneficial owners against unauthorized access or disclosure.",
        linked_regs: ["REG-GDPR-32"],
      },
      {
        id: "CL-005-2",
        text: "Custodian shall preserve books and records relating to safekept assets for no less than six years in the format prescribed by applicable rules.",
        linked_regs: ["REG-FINRA-4511"],
      },
      {
        id: "CL-005-3",
        text: "Custodian's system controls shall be evaluated no less than annually to test the effectiveness of security measures with respect to the confidentiality and integrity of client data.",
        linked_regs: ["REG-GDPR-32"],
      },
    ],
  },
  {
    id: "CTR-006",
    name: "Distribution Agreement — UCITS Fund",
    counterparty: "BNP Paribas Asset Management",
    value: 42_500_000,
    clauses: [
      {
        id: "CL-006-1",
        text: "Distributor shall provide investors with ex-ante information on all costs and charges associated with the investment service and financial instrument.",
        linked_regs: ["REG-EU-MIFID2-24"],
      },
      {
        id: "CL-006-2",
        text: "Distributor shall act honestly, fairly, and professionally in accordance with the best interests of clients when marketing units of the Fund.",
        linked_regs: ["REG-EU-MIFID2-24"],
      },
      {
        id: "CL-006-3",
        text: "The parties shall not pay or accept any fee or non-monetary benefit that would impair compliance with duties owed to clients, except as permitted by applicable law.",
        linked_regs: ["REG-EU-MIFID2-24"],
      },
    ],
  },
  {
    id: "CTR-007",
    name: "Subscription Agreement — Aurora Growth Fund II",
    counterparty: "Aurora Capital Partners LP",
    value: 25_000_000,
    clauses: [
      {
        id: "CL-007-1",
        text: "The General Partner represents that the Private Placement Memorandum contains no untrue statement of material fact and does not omit any material fact necessary to make the statements therein not misleading.",
        linked_regs: ["REG-SEC-10B5"],
      },
      {
        id: "CL-007-2",
        text: "The Fund shall not acquire or retain any ownership interest in a covered fund except as permitted by applicable banking-entity exemptions.",
        linked_regs: ["REG-DODD-VOLCKER"],
      },
      {
        id: "CL-007-3",
        text: "The General Partner shall disclose all material conflicts of interest to Limited Partners and adopt written policies reasonably designed to address them.",
        linked_regs: ["REG-SEC-REGBI"],
      },
    ],
  },
  {
    id: "CTR-008",
    name: "Securities Lending Agreement — State Street",
    counterparty: "State Street Bank and Trust",
    value: 90_000_000,
    clauses: [
      {
        id: "CL-008-1",
        text: "Lender agrees that Borrower shall have reasonable grounds to believe each borrowed security can be delivered on settlement date in accordance with applicable short-sale rules.",
        linked_regs: ["REG-SEC-REGSHO"],
      },
      {
        id: "CL-008-2",
        text: "Failures to deliver arising in connection with any loan hereunder shall be closed out within the settlement windows prescribed by applicable rules.",
        linked_regs: ["REG-SEC-REGSHO"],
      },
      {
        id: "CL-008-3",
        text: "The parties shall maintain complete records of each loan, including collateral and lifecycle events, for the periods required by applicable law.",
        linked_regs: ["REG-FINRA-4511"],
      },
    ],
  },
  {
    id: "CTR-009",
    name: "Cleared Swap Addendum — CME IRS",
    counterparty: "CME Clearing",
    value: 60_000_000,
    clauses: [
      {
        id: "CL-009-1",
        text: "Reporting Counterparty shall report each Cleared Swap and all lifecycle events to a registered swap data repository under a unique swap identifier and legal entity identifier.",
        linked_regs: ["REG-CFTC-P45"],
      },
      {
        id: "CL-009-2",
        text: "Reporting Counterparty shall provide daily mark-to-market valuation data for each open Cleared Swap through termination.",
        linked_regs: ["REG-CFTC-P45"],
      },
      {
        id: "CL-009-3",
        text: "All records related to Cleared Swaps shall be preserved in the format and for the periods required by applicable rules.",
        linked_regs: ["REG-FINRA-4511"],
      },
    ],
  },
  {
    id: "CTR-010",
    name: "Investment Advisory Agreement — Meridian Wealth",
    counterparty: "Meridian Wealth Advisors",
    value: 14_800_000,
    clauses: [
      {
        id: "CL-010-1",
        text: "Adviser shall act in the best interest of the Client when making any securities recommendation and shall not place its own interests ahead of the Client's.",
        linked_regs: ["REG-SEC-REGBI"],
      },
      {
        id: "CL-010-2",
        text: "Adviser shall disclose all material facts regarding the scope of the relationship, fees, and any material conflicts of interest at or before the time of recommendation.",
        linked_regs: ["REG-SEC-REGBI"],
      },
      {
        id: "CL-010-3",
        text: "Adviser shall preserve books and records evidencing recommendations and communications with clients for the periods required by applicable rules.",
        linked_regs: ["REG-FINRA-4511"],
      },
    ],
  },
  {
    id: "CTR-011",
    name: "Trade Confirmation Terms — Euronext Options",
    counterparty: "Optiver V.O.F.",
    value: 8_200_000,
    clauses: [
      {
        id: "CL-011-1",
        text: "The parties shall act honestly, fairly, and professionally in accordance with the best interests of their respective clients when transmitting orders subject to this confirmation.",
        linked_regs: ["REG-EU-MIFID2-24"],
      },
      {
        id: "CL-011-2",
        text: "Each party shall retain confirmations and related electronic communications in a non-rewriteable, non-erasable format for the periods required by applicable rules.",
        linked_regs: ["REG-FINRA-4511"],
      },
    ],
  },
  {
    id: "CTR-012",
    name: "Data Processing Addendum — Analytics Vendor",
    counterparty: "Clearwater Analytics",
    value: 3_400_000,
    clauses: [
      {
        id: "CL-012-1",
        text: "Processor shall implement pseudonymization and encryption of personal data where appropriate to the risk of the processing activities.",
        linked_regs: ["REG-GDPR-32"],
      },
      {
        id: "CL-012-2",
        text: "Processor shall ensure the ongoing confidentiality, integrity, availability, and resilience of systems used to process Controller's personal data.",
        linked_regs: ["REG-GDPR-32"],
      },
      {
        id: "CL-012-3",
        text: "Processor shall regularly test and evaluate the effectiveness of technical and organizational measures for the security of processing.",
        linked_regs: ["REG-GDPR-32"],
      },
    ],
  },
  {
    id: "CTR-013",
    name: "Underwriting Agreement — Series 2026-A Notes",
    counterparty: "Goldman Sachs & Co. LLC",
    value: 500_000_000,
    clauses: [
      {
        id: "CL-013-1",
        text: "The Company represents that the Registration Statement contains no untrue statement of material fact and does not omit any material fact required to be stated therein.",
        linked_regs: ["REG-SEC-10B5"],
      },
      {
        id: "CL-013-2",
        text: "Principal executive and financial officers of the Company shall deliver certifications as to the accuracy of periodic reports incorporated by reference into the Prospectus.",
        linked_regs: ["REG-SOX-302"],
      },
      {
        id: "CL-013-3",
        text: "The Underwriters shall provide retail customers with all disclosures required under applicable best-interest and suitability rules.",
        linked_regs: ["REG-SEC-REGBI"],
      },
    ],
  },
  {
    id: "CTR-014",
    name: "Committed Repo Facility — Barclays",
    counterparty: "Barclays Bank PLC",
    value: 220_000_000,
    clauses: [
      {
        id: "CL-014-1",
        text: "Buyer shall maintain regulatory capital consistent with Basel III requirements applicable to its jurisdiction throughout the term of this Facility.",
        linked_regs: ["REG-BASEL3-CAPITAL"],
      },
      {
        id: "CL-014-2",
        text: "Seller represents that all information furnished regarding the purchased securities and its financial condition is true, accurate, and complete in all material respects.",
        linked_regs: ["REG-SEC-10B5"],
      },
      {
        id: "CL-014-3",
        text: "The parties shall preserve records of each Transaction and lifecycle event for the periods required under applicable rules.",
        linked_regs: ["REG-FINRA-4511"],
      },
    ],
  },
  {
    id: "CTR-015",
    name: "Managed Account Agreement — Family Office",
    counterparty: "Halcyon Family Office LP",
    value: 2_100_000,
    clauses: [
      {
        id: "CL-015-1",
        text: "Manager shall act in the best interest of Client and shall not place its own interests ahead of Client's in connection with any recommendation or discretionary decision.",
        linked_regs: ["REG-SEC-REGBI"],
      },
      {
        id: "CL-015-2",
        text: "Manager shall implement appropriate technical and organizational safeguards for personal data of Client and its beneficial owners.",
        linked_regs: ["REG-GDPR-32"],
      },
      {
        id: "CL-015-3",
        text: "Manager shall preserve communications and account records for no less than six years, the first two in an accessible location.",
        linked_regs: ["REG-FINRA-4511"],
      },
    ],
  },
];
