export type TechPriority = "P0" | "P1" | "P2";

export type Amendment = {
  contract_id: string;
  contract_name: string;
  suggestion: string;
  rationale: string;
  review_status?: "pending_review" | "approved" | "rejected" | "not_required";
  review_id?: string;
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
  review_status?: "pending_review" | "approved" | "not_required";
  review_id?: string;
  plan_id?: string;
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
