export type TechPriority = "P0" | "P1" | "P2";

export type Amendment = {
  contract_id: string;
  contract_name: string;
  suggestion: string;
  rationale: string;
  clause_quote?: string;
  rule_quote?: string;
  citation?: string;
};

export type TechFix = {
  priority: TechPriority;
  title: string;
  detail: string;
};

export type SourceCitation = {
  instrument_id: string;
  title: string;
  official_url?: string;
  quote?: string;
};

export type ActionPlan = {
  policy_draft: string;
  amendments: Amendment[];
  tech_fixes: TechFix[];
  sources?: SourceCitation[];
  fallback?: boolean;
};

export type ActionPlanInput = {
  regulationText: string;
  summary?: string;
  impacts: {
    contract_id: string;
    contract_name: string;
    severity: "low" | "medium" | "high";
    suggested_amendment: string;
    assessment_id?: string;
    clause_quote?: string;
    rule_quote?: string;
    instrument_id?: string;
    official_url?: string;
  }[];
  sources?: SourceCitation[];
};
