export type TechPriority = "P0" | "P1" | "P2";

export type Amendment = {
  contract_id: string;
  contract_name: string;
  suggestion: string;
  rationale: string;
};

export type TechFix = {
  priority: TechPriority;
  title: string;
  detail: string;
};

export type ActionPlan = {
  policy_draft: string;
  amendments: Amendment[];
  tech_fixes: TechFix[];
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
  }[];
};
