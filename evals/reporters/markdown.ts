// ============================================================================
// Reporter: Markdown Report: evals/reporters/markdown.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.8, §20)
// ============================================================================

import fs from "fs";
import path from "path";
import { type ReportJsonData } from "./json";

export function generateMarkdownReport(data: ReportJsonData): string {
  const isPass = data.failed_thresholds.length === 0;
  const statusBadge = isPass
    ? data.warned_thresholds.length === 0
      ? "✅ **PASS** (All quality gates passed)"
      : "⚠️ **WARN** (Gates passed with quality warnings)"
    : "❌ **FAIL** (Quality regression / threshold breached)";

  const dateStr = new Date().toISOString();

  let md = `# ClauseGraph AI Evaluation Report — Run ${data.run_id}\n\n`;
  md += `**Evaluation Status:** ${statusBadge}  \n`;
  md += `**Date/Time:** \`${dateStr}\`  \n`;
  md += `**Mode:** \`${data.attribution.mode}\` | **Git SHA:** \`${data.attribution.git_sha}\`  \n\n`;

  md += `### 1. Attribution & Model Configuration\n\n`;
  md += `| Component | Identifier / Version |\n`;
  md += `|---|---|\n`;
  for (const [k, v] of Object.entries(data.attribution.model_versions || {})) {
    md += `| Model (${k}) | \`${v}\` |\n`;
  }
  for (const [k, v] of Object.entries(data.attribution.prompt_versions || {})) {
    md += `| Prompt (${k}) | \`${v}\` |\n`;
  }
  for (const [k, v] of Object.entries(data.attribution.dataset_versions || {})) {
    md += `| Dataset (${k}) | \`${v}\` |\n`;
  }

  md += `\n---\n\n`;

  md += `### 2. Headline Metrics & Quality Gates\n\n`;
  md += `| Metric | Observed Value | Baseline Diff | Status | Sample Count / Confidence |\n`;
  md += `|---|---:|---:|:---:|---|\n`;

  // High severity recall
  const hsr = data.summary.high_severity_recall;
  const hsrDiff = data.vs_baseline["high_severity_recall"] ?? 0;
  const hsrStatus = data.failed_thresholds.includes("highSeverityRecall")
    ? "❌ FAIL"
    : data.warned_thresholds.includes("highSeverityRecall")
    ? "⚠️ WARN"
    : "✅ PASS";
  const hsrNote = hsr.low_sample
    ? `⚠️ Low sample (n=${hsr.n_positives} < 20)`
    : `n=${hsr.n_positives} positives`;
  md += `| **High-Severity Breach Recall** | **${(hsr.mean * 100).toFixed(1)}%** | ${formatDiff(hsrDiff)} | ${hsrStatus} | ${hsrNote} |\n`;

  // Precision
  const prec = data.summary.precision;
  const precDiff = data.vs_baseline["precision"] ?? 0;
  const precStatus = data.failed_thresholds.includes("precision")
    ? "❌ FAIL"
    : data.warned_thresholds.includes("precision")
    ? "⚠️ WARN"
    : "✅ PASS";
  md += `| Precision (Breach Detection) | ${(prec.mean * 100).toFixed(1)}% | ${formatDiff(precDiff)} | ${precStatus} | n=${prec.n} evaluations |\n`;

  // Recall
  const rec = data.summary.recall;
  const recDiff = data.vs_baseline["recall"] ?? 0;
  md += `| Overall Recall | ${(rec.mean * 100).toFixed(1)}% | ${formatDiff(recDiff)} | — | Detection rate |\n`;

  // Severity exact
  const sevExact = data.summary.severity_accuracy.exact_mean;
  const sevDiff = data.vs_baseline["severity_accuracy"] ?? 0;
  const sevStatus = data.failed_thresholds.includes("severityAccuracy")
    ? "❌ FAIL"
    : data.warned_thresholds.includes("severityAccuracy")
    ? "⚠️ WARN"
    : "✅ PASS";
  md += `| Severity Agreement (Exact) | ${(sevExact * 100).toFixed(1)}% | ${formatDiff(sevDiff)} | ${sevStatus} | Within 1 level: ${(data.summary.severity_accuracy.within_one_mean * 100).toFixed(1)}% |\n`;

  // Median exposure error
  const expErr = data.summary.exposure_median_error;
  const expDiff = data.vs_baseline["exposure_median_error"] ?? 0;
  const expStatus = data.failed_thresholds.includes("exposureMedianError")
    ? "❌ FAIL"
    : data.warned_thresholds.includes("exposureMedianError")
    ? "⚠️ WARN"
    : "✅ PASS";
  md += `| Exposure Median Error (Lower=Better) | ${(expErr * 100).toFixed(1)}% | ${formatDiff(expDiff, true)} | ${expStatus} | Dollar quantification |\n`;

  // Evidence validity
  const evVal = data.summary.evidence_validity_mean;
  const evDiff = data.vs_baseline["evidence_validity"] ?? 0;
  const evStatus = data.failed_thresholds.includes("evidenceValidity")
    ? "❌ FAIL"
    : data.warned_thresholds.includes("evidenceValidity")
    ? "⚠️ WARN"
    : "✅ PASS";
  md += `| Evidence Validity (Quotes & Ontology) | ${(evVal * 100).toFixed(1)}% | ${formatDiff(evDiff)} | ${evStatus} | Real contract verbatim quotes |\n`;

  // Review Queue Routing
  const rRecall = data.summary.routing_recall;
  const rPrec = data.summary.routing_precision;
  const rStatus = data.failed_thresholds.includes("routingRecall") ? "❌ FAIL" : "✅ PASS";
  md += `| Review Queue Routing Recall | ${(rRecall * 100).toFixed(1)}% | ${formatDiff(data.vs_baseline["routing_recall"] ?? 0)} | ${rStatus} | Precision: ${(rPrec * 100).toFixed(1)}% |\n`;

  md += `\n---\n\n`;

  // Fallback and operational metrics
  md += `### 3. Operational Performance & Fallback Separation\n\n`;
  md += `- **Fallback Activation Rate:** ${(data.fallback.rate * 100).toFixed(1)}% (${data.fallback.cases} cases triggered deterministic fallback)\n`;
  md += `- **Evaluated Cases Count:** ${data.cases.length}\n`;
  if (data.failed_thresholds.length > 0) {
    md += `\n> [!CAUTION]\n> **Failed Thresholds:** ${data.failed_thresholds.join(", ")}\n`;
  }
  if (data.warned_thresholds.length > 0) {
    md += `\n> [!WARNING]\n> **Warned Thresholds:** ${data.warned_thresholds.join(", ")}\n`;
  }

  md += `\n---\n\n`;

  // Case-by-case breakdown table
  md += `### 4. Case-by-Case Breakdown\n\n`;
  md += `| Case ID | Dataset Class | Status | Detection F1 | Severity Agr. | Exposure Error | Evidence Valid | Latency |\n`;
  md += `|---|---|:---:|---:|---:|---:|---:|---:|\n`;

  for (const c of data.cases) {
    const dF1 = c.scores?.detection?.f1 != null ? `${(c.scores.detection.f1 * 100).toFixed(0)}%` : "N/A";
    const sAgr = c.scores?.severity?.exactAgreement != null ? `${(c.scores.severity.exactAgreement * 100).toFixed(0)}%` : "N/A";
    const expErrVal = c.scores?.exposure?.percentageError != null ? `${(c.scores.exposure.percentageError * 100).toFixed(1)}%` : "0.0%";
    const evValRate = c.scores?.evidence?.validityRate != null ? `${(c.scores.evidence.validityRate * 100).toFixed(0)}%` : "100%";
    const passIcon = c.pass ? "✅ PASS" : "❌ FAIL";

    md += `| \`${c.id}\` | ${c.class} | ${passIcon} | ${dF1} | ${sAgr} | ${expErrVal} | ${evValRate} | ${c.latency_ms}ms |\n`;
  }

  md += `\n---\n*Report generated deterministically by ClauseGraph Evaluation Harness.*  \n`;

  return md;
}

function formatDiff(val: number, lowerIsBetter: boolean = false): string {
  if (Math.abs(val) < 0.001) return `0.0%`;
  const pct = (val * 100).toFixed(1);
  if (val > 0) {
    return lowerIsBetter ? `+${pct}% 🔻` : `+${pct}% 🔺`;
  }
  return lowerIsBetter ? `${pct}% 🔺` : `${pct}% 🔻`;
}

export function writeMarkdownReport(outDir: string, data: ReportJsonData): string {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const content = generateMarkdownReport(data);
  const outPath = path.join(outDir, "report.md");
  fs.writeFileSync(outPath, content, "utf-8");
  return outPath;
}
