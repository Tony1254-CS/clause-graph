import type { ActionPlan } from "./action-plan-types";

export const fallbackActionPlan: ActionPlan = {
  fallback: true,
  policy_draft:
    "Effective immediately, the firm shall update its counterparty risk framework to incorporate the revised regulatory thresholds. All new and materially amended agreements must include change-in-law and capital-ratio trigger provisions; Legal and Risk shall jointly review any exception. Existing agreements identified as materially impacted shall be prioritized for amendment within the next two renewal cycles, and the Chief Compliance Officer shall report quarterly to the Risk Committee on remediation progress.",
  amendments: [
    {
      contract_id: "CTR-003",
      contract_name: "Revolving Credit Facility",
      suggestion:
        "Insert a capital-ratio trigger permitting unilateral renegotiation of pricing if counterparty CET1 falls below the new regulatory floor.",
      rationale:
        "Aligns pricing with the revised risk-weight schedule and preserves margin under stressed conditions.",
    },
    {
      contract_id: "CTR-007",
      contract_name: "ISDA Master — Interest Rate Swaps",
      suggestion:
        "Introduce a mandatory collateral top-up clause tied to the updated risk-weight schedules.",
      rationale:
        "Reduces uncollateralized exposure once the new weights take effect and prevents look-through breaches.",
    },
    {
      contract_id: "CTR-001",
      contract_name: "Prime Brokerage Agreement",
      suggestion:
        "Amend ongoing compliance representations to reference the revised capital adequacy framework.",
      rationale:
        "Closes a representation gap that could otherwise be argued as scoped to the prior rule set.",
    },
  ],
  tech_fixes: [
    {
      priority: "P0",
      title: "Extend counterparty risk model to ingest new CET1 thresholds",
      detail:
        "Update the nightly risk batch to pull the revised thresholds and recompute exposure bands; add alerting when a counterparty crosses a band.",
    },
    {
      priority: "P1",
      title: "Add change-in-law flag to contract metadata schema",
      detail:
        "Introduce a boolean field and effective-date column so downstream systems can filter agreements requiring re-papering.",
    },
    {
      priority: "P2",
      title: "Backfill regulation citations in the clause library",
      detail:
        "Reindex clauses citing the prior framework and surface a review queue in the paralegal workflow tool.",
    },
  ],
};
