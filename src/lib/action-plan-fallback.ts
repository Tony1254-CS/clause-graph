import type { ActionPlan, ActionPlanInput, SourceCitation } from "./action-plan-types";

/**
 * Builds a deterministic action plan grounded directly in the user's actual impacted contracts,
 * avoiding hallucinated contracts or irrelevant canned Basel IV text.
 */
export function buildDeterministicActionPlan(input: ActionPlanInput): ActionPlan {
  const amendments = input.impacts.map((imp) => ({
    contract_id: imp.contract_id,
    contract_name: imp.contract_name || imp.contract_id,
    suggestion:
      imp.suggested_amendment ||
      "Amend clause to ensure full alignment with applicable statutory compliance safeguards.",
    rationale: `Remediates contractual compliance risk categorized as ${imp.severity || "medium"} severity.`,
    clause_quote: imp.clause_quote,
    rule_quote: imp.rule_quote,
    citation: imp.instrument_id,
  }));

  const sources: SourceCitation[] = input.sources || [];
  if (sources.length === 0) {
    const seen = new Set<string>();
    for (const imp of input.impacts) {
      if (imp.instrument_id && !seen.has(imp.instrument_id)) {
        seen.add(imp.instrument_id);
        sources.push({
          instrument_id: imp.instrument_id,
          title: imp.instrument_id,
          official_url: imp.official_url,
          quote: imp.rule_quote,
        });
      }
    }
  }

  return {
    fallback: true,
    policy_draft:
      "Effective immediately, the organisation shall update its internal compliance policies and standard operating procedures to reflect the revised regulatory standards. Compliance officers and legal counsel shall review and prioritize the contractual amendments outlined below, ensuring each agreement incorporates requisite statutory safeguards and liability limits before execution.",
    amendments:
      amendments.length > 0
        ? amendments
        : [
            {
              contract_id: "PORTFOLIO-GENERAL",
              contract_name: "General Governance Framework",
              suggestion:
                "Ensure standard contractual terms include dynamic compliance representations referencing prevailing regulatory standards.",
              rationale:
                "Establishes baseline legal defensibility across active commercial relationships.",
            },
          ],
    tech_fixes: [
      {
        priority: "P0",
        title: "Audit and update contractual register with verified compliance citations",
        detail:
          "Index all active agreements against the latest regulatory obligations and log required amendments in the compliance tracking queue.",
      },
      {
        priority: "P1",
        title: "Implement operational alerting for statutory breach and notification timelines",
        detail:
          "Configure automated alerts ensuring all security incidents and supervisory notifications meet strict statutory response windows.",
      },
      {
        priority: "P2",
        title: "Refresh model contract templates with current statutory terminology",
        detail:
          "Retire repealed statutory clauses and issue updated standard terms of service and vendor data protection addenda across internal business units.",
      },
    ],
    sources,
  };
}

export const fallbackActionPlan: ActionPlan = buildDeterministicActionPlan({
  regulationText: "",
  impacts: [],
});
