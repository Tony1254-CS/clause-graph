// ============================================================================
// Evaluation Harness Config: evals/config.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.3, §4.5)
// ============================================================================

export interface EvalConfig {
  models: {
    simulation: string;
    extraction: string;
    judge: string;
  };
  promptVersions: {
    simulation: string;
    extraction: string;
    judge: string;
  };
  datasetVersions: {
    landmark: string;
    synthetic: string;
    negative: string;
    adversarial: string;
    holdout: string;
  };
  temperature: number;
  runsPerCase: {
    live: number;
    replay: number;
  };
  costCeilingUsd: number;
  timeoutMs: number;
  evalOrgId: string;
  concurrency: number;
}

export const evalConfig: EvalConfig = {
  models: {
    simulation: "gpt-4o-2024-08-06",
    extraction: "gemini-2.5-flash",
    judge: "gemini-2.5-flash",
  },
  promptVersions: {
    simulation: "v7",
    extraction: "v3",
    judge: "v1",
  },
  datasetVersions: {
    landmark: "v1.0.0",
    synthetic: "v1.0.0",
    negative: "v1.0.0",
    adversarial: "v1.0.0",
    holdout: "v1.0.0",
  },
  temperature: 0,
  runsPerCase: {
    live: 3,
    replay: 1,
  },
  costCeilingUsd: 15.0,
  timeoutMs: 30000,
  evalOrgId: "e0000000-0000-0000-0000-000000000001",
  concurrency: 4,
};
