export type Severity = "low" | "medium" | "high";

export type ImpactEntry = {
  contract_id: string;
  severity: Severity;
  suggested_amendment: string;
};

export type Verdict = "conflict" | "gap" | "needs_update" | "compliant" | "insufficient_evidence";

export type ReviewStatus = "pending_review" | "approved" | "rejected" | "edited";

export interface EvidenceCard {
  id: string;
  contract_id: string;
  contract_name: string;
  contract_value: number;
  clause_id: string;
  clause_text: string;
  clause_quote: string;
  obligation_id: string;
  instrument_id: string;
  instrument_title?: string;
  official_url?: string;
  rule_quote: string;
  verdict: Verdict;
  severity: Severity | null;
  rationale: string;
  suggested_amendment: string | null;
  confidence: number;
  origin: "ai" | "deterministic";
  review_status: ReviewStatus;
}

export interface ExposureBreakdown {
  totalExposure: number;
  approvedExposure: number;
  pendingExposure: number;
  impactedContractsCount: number;
  contractsTotalCount: number;
  bySeverity: {
    high: number;
    medium: number;
    low: number;
  };
  byVerdict: {
    conflict: number;
    gap: number;
    needs_update: number;
    insufficient_evidence: number;
    compliant: number;
  };
  formula: string;
}

export type SimulationResult = {
  impacts: ImpactEntry[];
  summary?: string;
  fallback?: boolean;
  mode?: "ai" | "deterministic";
  runId?: string;
  cards?: EvidenceCard[];
  insufficientEvidence?: EvidenceCard[];
  exposure?: ExposureBreakdown;
};

export type RunType = "reactive" | "forecast" | "what_if";

export type SimulateInput = {
  regulationText: string;
  runType?: RunType;
  regulationId?: string;
  eventId?: string;
  instrumentId?: string;
};

export interface RepealChainNode {
  instrumentId: string;
  title: string;
  status: string;
  inForceFrom?: string | null;
  repealedOn?: string | null;
  officialUrl?: string | null;
}

export interface StaleCitationAlert {
  clauseId: string;
  contractId: string;
  contractName: string;
  contractValue: number;
  clauseText: string;
  matchedCitation: string;
  repealedInstrumentId: string;
  repealedInstrumentTitle: string;
  repealedOn: string;
  replacementInstrumentId: string;
  replacementInstrumentTitle: string;
  replacementStatus: string;
  officialUrl?: string;
  repealChain: RepealChainNode[];
  suggestedAction: string;
}
