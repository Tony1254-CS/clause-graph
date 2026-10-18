export type Severity = "low" | "medium" | "high";

export type ImpactEntry = {
  contract_id: string;
  severity: Severity;
  suggested_amendment: string;
  review_status?: "pending_review" | "approved" | "rejected" | "not_required";
  review_id?: string;
  flag_reasons?: string[];
};

export type SimulationResult = {
  impacts: ImpactEntry[];
  summary?: string;
  fallback?: boolean;
  engine?: "llm" | "deterministic_fallback";
  reviewStatus?: "pending_review" | "approved" | "not_required";
  reviewId?: string;
  correlationId?: string;
  simulationRunId?: string;
};

export type RunType = "reactive" | "forecast" | "what_if";

export type SimulateInput = {
  regulationText: string;
  runType?: RunType;
  regulationId?: string;
};
