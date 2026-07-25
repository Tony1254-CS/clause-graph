export type Severity = "low" | "medium" | "high";

export type ImpactEntry = {
  contract_id: string;
  severity: Severity;
  suggested_amendment: string;
};

export type SimulationResult = {
  impacts: ImpactEntry[];
  summary?: string;
  fallback?: boolean;
};

export type RunType = "reactive" | "forecast" | "what_if";

export type SimulateInput = {
  regulationText: string;
  runType?: RunType;
  regulationId?: string;
};
