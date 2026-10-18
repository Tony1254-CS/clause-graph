// ============================================================================
// Reporter: JSON Report: evals/reporters/json.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.8)
// ============================================================================

import fs from "fs";
import path from "path";

export interface ReportJsonData {
  run_id: string;
  attribution: {
    git_sha: string;
    mode: string;
    model_versions: Record<string, string>;
    prompt_versions: Record<string, string>;
    dataset_versions: Record<string, string>;
  };
  summary: {
    high_severity_recall: {
      mean: number;
      n_positives: number;
      low_sample: boolean;
    };
    precision: {
      mean: number;
      n: number;
    };
    recall: {
      mean: number;
    };
    severity_accuracy: {
      exact_mean: number;
      within_one_mean: number;
    };
    exposure_median_error: number;
    evidence_validity_mean: number;
    routing_recall: number;
    routing_precision: number;
  };
  vs_baseline: Record<string, number>;
  failed_thresholds: string[];
  warned_thresholds: string[];
  fallback: {
    cases: number;
    rate: number;
  };
  cases: Array<{
    id: string;
    class: string;
    pass: boolean;
    scores: any;
    latency_ms: number;
  }>;
}

export function writeJsonReport(outDir: string, data: ReportJsonData): string {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const filePath = path.join(outDir, "report.json");
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  return filePath;
}
