import type { SimulationResult } from "./simulate-types";

// Pre-saved demo response used when the live model call fails or times out.
// Modeled on a hypothetical "Basel IV capital adequacy tightening" regulation
// impacting credit facilities and derivatives contracts in the seeded corpus.
export const fallbackSimulation: SimulationResult = {
  fallback: true,
  summary:
    "Fallback demo: heightened capital adequacy thresholds increase counterparty risk-weighting on unsecured credit facilities and long-dated derivatives.",
  impacts: [
    {
      contract_id: "CTR-003",
      severity: "high",
      suggested_amendment:
        "Add a capital-ratio trigger permitting unilateral renegotiation of pricing if counterparty CET1 falls below the new regulatory floor.",
    },
    {
      contract_id: "CTR-007",
      severity: "high",
      suggested_amendment:
        "Introduce a mandatory collateral top-up clause tied to updated risk-weight schedules under the new rule.",
    },
    {
      contract_id: "CTR-001",
      severity: "medium",
      suggested_amendment:
        "Amend representations to include ongoing compliance with the revised capital adequacy framework.",
    },
    {
      contract_id: "CTR-011",
      severity: "medium",
      suggested_amendment:
        "Insert a change-in-law provision allowing pass-through of incremental capital costs to the counterparty.",
    },
    {
      contract_id: "CTR-005",
      severity: "low",
      suggested_amendment:
        "Update regulatory citation schedule to reference the new capital adequacy standard.",
    },
  ],
};
