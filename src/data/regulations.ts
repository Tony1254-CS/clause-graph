import type { Regulation } from "./types";

export const regulations: Regulation[] = [
  {
    id: "REG-SEC-10B5",
    jurisdiction: "SEC",
    title: "Rule 10b-5 — Anti-Fraud in Securities",
    summary:
      "Prohibits any act, practice, or course of business which operates as fraud or deceit in connection with the purchase or sale of any security. The foundational anti-fraud provision under the Exchange Act.",
    obligations: [
      { id: "OB-1", text: "No untrue statements of material fact in offering or trading documents." },
      { id: "OB-2", text: "No omission of material facts necessary to make statements not misleading." },
      { id: "OB-3", text: "Duty to disclose applies when a party trades on material nonpublic information." },
    ],
  },
  {
    id: "REG-SEC-REGBI",
    jurisdiction: "SEC",
    title: "Regulation Best Interest",
    summary:
      "Requires broker-dealers to act in the best interest of retail customers when recommending securities transactions or investment strategies, without placing their own interests ahead of the customer's.",
    obligations: [
      { id: "OB-1", text: "Disclose all material facts about the recommendation and the relationship." },
      { id: "OB-2", text: "Exercise reasonable diligence, care, and skill on any recommendation." },
      { id: "OB-3", text: "Identify and eliminate or disclose material conflicts of interest." },
      { id: "OB-4", text: "Maintain written policies reasonably designed to achieve compliance." },
    ],
  },
  {
    id: "REG-DODD-VOLCKER",
    jurisdiction: "Federal Reserve",
    title: "Dodd-Frank §619 — Volcker Rule",
    summary:
      "Restricts banking entities from engaging in proprietary trading and from owning or sponsoring hedge funds and private equity funds, subject to permitted-activity exemptions.",
    obligations: [
      { id: "OB-1", text: "No proprietary trading in financial instruments as principal for short-term resale." },
      { id: "OB-2", text: "No acquisition or retention of ownership in a covered fund." },
      { id: "OB-3", text: "Establish a compliance program commensurate with trading activity size." },
    ],
  },
  {
    id: "REG-SEC-REGSHO",
    jurisdiction: "SEC",
    title: "Regulation SHO — Short Sales",
    summary:
      "Governs short selling of equity securities, including locate and close-out requirements for brokers and dealers to reduce failures to deliver.",
    obligations: [
      { id: "OB-1", text: "Reasonable grounds to believe security can be borrowed before short sale executes." },
      { id: "OB-2", text: "Close out failures to deliver within prescribed settlement windows." },
      { id: "OB-3", text: "Mark all sale orders as long, short, or short exempt." },
    ],
  },
  {
    id: "REG-SOX-302",
    jurisdiction: "SEC",
    title: "Sarbanes-Oxley §302 — Officer Certifications",
    summary:
      "Requires principal executive and financial officers to personally certify the accuracy of periodic reports and the effectiveness of internal controls over financial reporting.",
    obligations: [
      { id: "OB-1", text: "Certify that report does not contain material misstatements or omissions." },
      { id: "OB-2", text: "Certify design and evaluation of disclosure controls and procedures." },
      { id: "OB-3", text: "Disclose all significant deficiencies and material weaknesses to auditors." },
    ],
  },
  {
    id: "REG-EU-MIFID2-24",
    jurisdiction: "EU-ESMA",
    title: "MiFID II Article 24 — Conduct of Business",
    summary:
      "Sets general principles for investment firms to act honestly, fairly, and professionally in the best interests of clients, including inducement and cost-transparency rules.",
    obligations: [
      { id: "OB-1", text: "Act honestly, fairly, and in the best interests of clients." },
      { id: "OB-2", text: "Provide appropriate information about costs and charges on an ex-ante basis." },
      { id: "OB-3", text: "Not accept fees or inducements that impair duties to clients, subject to exceptions." },
    ],
  },
  {
    id: "REG-BASEL3-CAPITAL",
    jurisdiction: "OCC",
    title: "Basel III — Capital Adequacy",
    summary:
      "International capital framework requiring banks to hold minimum common equity Tier 1, Tier 1, and total capital ratios against risk-weighted assets, plus a leverage ratio backstop.",
    obligations: [
      { id: "OB-1", text: "Maintain CET1 ratio of at least 4.5% of risk-weighted assets." },
      { id: "OB-2", text: "Maintain total capital ratio of at least 8% plus applicable buffers." },
      { id: "OB-3", text: "Report leverage ratio and liquidity coverage ratio to supervisors." },
    ],
  },
  {
    id: "REG-CFTC-P45",
    jurisdiction: "CFTC",
    title: "CFTC Part 45 — Swap Data Reporting",
    summary:
      "Requires reporting counterparties and swap execution facilities to report swap transaction and continuation data to a registered swap data repository.",
    obligations: [
      { id: "OB-1", text: "Report primary economic terms as soon as technologically practicable after execution." },
      { id: "OB-2", text: "Provide unique swap identifier and legal entity identifier on every report." },
      { id: "OB-3", text: "Report lifecycle events and valuation data through termination of the swap." },
    ],
  },
  {
    id: "REG-FINRA-4511",
    jurisdiction: "FINRA",
    title: "FINRA Rule 4511 — Books and Records",
    summary:
      "Requires member firms to preserve books and records in the format and for the time periods specified by SEA Rules 17a-3 and 17a-4, including electronic communications.",
    obligations: [
      { id: "OB-1", text: "Preserve required records for a minimum of six years, first two in an accessible place." },
      { id: "OB-2", text: "Store electronic records in non-rewriteable, non-erasable format." },
      { id: "OB-3", text: "Maintain audit system providing accountability for original and duplicate records." },
    ],
  },
  {
    id: "REG-GDPR-32",
    jurisdiction: "EU-ESMA",
    title: "GDPR Article 32 — Security of Processing",
    summary:
      "Requires controllers and processors of personal data to implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk.",
    obligations: [
      { id: "OB-1", text: "Pseudonymize and encrypt personal data where appropriate to the risk." },
      { id: "OB-2", text: "Ensure ongoing confidentiality, integrity, availability, and resilience of systems." },
      { id: "OB-3", text: "Regularly test and evaluate the effectiveness of security measures." },
    ],
  },
];
