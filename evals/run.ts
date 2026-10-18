// ============================================================================
// Evaluation Harness CLI Entry Point: evals/run.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.1, §4.5, §17-§20)
// ============================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { evalConfig } from "./config";
import { defaultThresholds } from "./thresholds";
import { SimulationRunner, type EvalCase, type SimulationResult } from "./runners/run-simulations";
import { scoreRouting, type RoutingCase } from "./scorers/routing";
import { writeJsonReport, type ReportJsonData } from "./reporters/json";
import { writeMarkdownReport } from "./reporters/markdown";
import { writeHtmlReport } from "./reporters/html";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: "replay" as "replay" | "live",
    subset: "all" as "quick" | "all",
    record: false,
    updateBaseline: false,
    outDir: path.resolve(__dirname, "results"),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--mode" && args[i + 1]) {
      options.mode = args[++i] as "replay" | "live";
    } else if (arg === "--subset" && args[i + 1]) {
      options.subset = args[++i] as "quick" | "all";
    } else if (arg === "--record") {
      options.record = true;
    } else if (arg === "--update-baseline") {
      options.updateBaseline = true;
    } else if (arg === "--out-dir" && args[i + 1]) {
      options.outDir = path.resolve(args[++i]);
    }
  }

  return options;
}

function getGitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev-local";
  }
}

export async function runEvalSuite(cliOptions?: ReturnType<typeof parseArgs>) {
  const options = cliOptions || parseArgs();
  const runId = `eval-${Date.now()}`;
  const gitSha = getGitSha();

  console.log(`\n================================================================`);
  console.log(`   ClauseGraph AI Evaluation Harness (${options.mode.toUpperCase()} MODE)`);
  console.log(`================================================================`);
  console.log(`Run ID:   ${runId}`);
  console.log(`Git SHA:  ${gitSha}`);
  console.log(`Subset:   ${options.subset}`);
  console.log(`Out Dir:  ${options.outDir}`);
  console.log(`----------------------------------------------------------------\n`);

  const runner = new SimulationRunner();
  const cases = runner.loadDatasets(options.subset);

  if (cases.length === 0) {
    console.error(`❌ No evaluation cases found for subset: ${options.subset}`);
    process.exit(1);
  }

  console.log(`Loaded ${cases.length} evaluation cases. Running evaluation...\n`);

  const results: SimulationResult[] = [];
  const routingCases: RoutingCase[] = [];

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    process.stdout.write(`[${i + 1}/${cases.length}] Evaluating "${c.id}" (${c.class})... `);
    try {
      const res = await runner.runCase(c, {
        mode: options.mode,
        subset: options.subset,
        record: options.record,
      });

      results.push(res);
      routingCases.push({
        id: c.id,
        isTrulyBreachedOrWrong: c.expected.requires_human_review === true,
        wasRoutedToReviewQueue: res.requiresHumanReview,
      });

      console.log(res.pass ? `✅ PASS (${res.latencyMs}ms)` : `❌ FAIL (${res.latencyMs}ms)`);
    } catch (err: any) {
      console.log(`💥 ERROR`);
      console.error(`\nFatal error on case "${c.id}": ${err.message}`);
      throw err;
    }
  }

  // Aggregate Metrics
  let totalHighSevExpected = 0;
  let totalHighSevRecalled = 0;
  let totalEvaluatedContracts = 0;
  let sumPrecision = 0;
  let sumRecall = 0;
  let sumSevExact = 0;
  let sumSevWithinOne = 0;
  const exposureErrors: number[] = [];
  let sumEvidenceVal = 0;
  let fallbackCount = 0;
  let negativeHighSevBreaches = 0;

  for (const r of results) {
    if (r.isFallback) fallbackCount++;

    // High severity recall
    const cExpected = cases.find((c) => c.id === r.caseId);
    if (cExpected) {
      const expectedHighSevIds = Object.entries(cExpected.expected.severity)
        .filter(([_, s]) => s.toLowerCase() === "high" || s.toLowerCase() === "critical")
        .map(([id]) => id);

      totalHighSevExpected += expectedHighSevIds.length;
      for (const id of expectedHighSevIds) {
        if (r.impactedContracts.includes(id)) {
          totalHighSevRecalled++;
        }
      }

      // Negative control test (§19): High-severity flags in negative controls must be 0
      if (cExpected.class === "negative") {
        const foundHigh = Object.values(r.severity).some(
          (s) => s.toLowerCase() === "high" || s.toLowerCase() === "critical"
        );
        if (foundHigh) negativeHighSevBreaches++;
      }
    }

    sumPrecision += r.scores.detection.precision;
    sumRecall += r.scores.detection.recall;
    sumSevExact += r.scores.severity.exactAgreement;
    sumSevWithinOne += r.scores.severity.withinOneLevelAgreement;
    exposureErrors.push(r.scores.exposure.percentageError);
    sumEvidenceVal += r.scores.evidence.validityRate;
    totalEvaluatedContracts += r.scores.severity.totalEvaluated;
  }

  const n = results.length;
  const highSevRecallMean = totalHighSevExpected > 0 ? totalHighSevRecalled / totalHighSevExpected : 1.0;
  const isLowSample = totalHighSevExpected < 20;

  const precisionMean = n > 0 ? sumPrecision / n : 1.0;
  const recallMean = n > 0 ? sumRecall / n : 1.0;
  const sevExactMean = n > 0 ? sumSevExact / n : 1.0;
  const sevWithinOneMean = n > 0 ? sumSevWithinOne / n : 1.0;

  // Median exposure error
  exposureErrors.sort((a, b) => a - b);
  const mid = Math.floor(exposureErrors.length / 2);
  const medianExposureError =
    exposureErrors.length === 0
      ? 0
      : exposureErrors.length % 2 !== 0
      ? exposureErrors[mid]
      : (exposureErrors[mid - 1] + exposureErrors[mid]) / 2;

  const evidenceValidityMean = n > 0 ? sumEvidenceVal / n : 1.0;

  // Routing scores
  const routingScores = scoreRouting(routingCases);

  // Load Baseline for Comparison (§19)
  const baselinePath = path.resolve(__dirname, "baselines/baseline.json");
  let baselineMetrics: Record<string, number> = {};
  if (fs.existsSync(baselinePath)) {
    try {
      const bContent = fs.readFileSync(baselinePath, "utf-8");
      const bParsed = JSON.parse(bContent);
      baselineMetrics = bParsed.metrics || {};
    } catch (err) {
      console.warn("Could not read baseline:", err);
    }
  }

  // Calculate Diff vs Baseline
  const vsBaseline: Record<string, number> = {
    high_severity_recall: highSevRecallMean - (baselineMetrics["high_severity_recall"] ?? highSevRecallMean),
    precision: precisionMean - (baselineMetrics["precision"] ?? precisionMean),
    recall: recallMean - (baselineMetrics["recall"] ?? recallMean),
    severity_accuracy: sevExactMean - (baselineMetrics["severity_accuracy"] ?? sevExactMean),
    exposure_median_error: medianExposureError - (baselineMetrics["exposure_median_error"] ?? medianExposureError),
    evidence_validity: evidenceValidityMean - (baselineMetrics["evidence_validity"] ?? evidenceValidityMean),
    routing_recall: routingScores.routingRecall - (baselineMetrics["routing_recall"] ?? routingScores.routingRecall),
  };

  // Evaluate Thresholds (§19)
  const failedThresholds: string[] = [];
  const warnedThresholds: string[] = [];

  // High severity recall
  if (highSevRecallMean < (defaultThresholds.highSeverityRecall.fail ?? 0.90)) {
    failedThresholds.push("highSeverityRecall");
  } else if (highSevRecallMean < (defaultThresholds.highSeverityRecall.warn ?? 0.95)) {
    warnedThresholds.push("highSeverityRecall");
  }

  // Precision
  if (precisionMean < (defaultThresholds.precision.fail ?? 0.70)) {
    failedThresholds.push("precision");
  } else if (precisionMean < (defaultThresholds.precision.warn ?? 0.80)) {
    warnedThresholds.push("precision");
  }

  // Severity accuracy
  if (sevExactMean < (defaultThresholds.severityAccuracy.fail ?? 0.75)) {
    failedThresholds.push("severityAccuracy");
  } else if (sevExactMean < (defaultThresholds.severityAccuracy.warn ?? 0.85)) {
    warnedThresholds.push("severityAccuracy");
  }

  // Exposure median error (lower is better)
  if (medianExposureError > (defaultThresholds.exposureMedianError.fail ?? 0.50)) {
    failedThresholds.push("exposureMedianError");
  } else if (medianExposureError > (defaultThresholds.exposureMedianError.warn ?? 0.30)) {
    warnedThresholds.push("exposureMedianError");
  }

  // Evidence validity
  if (evidenceValidityMean < (defaultThresholds.evidenceValidity.fail ?? 0.95)) {
    failedThresholds.push("evidenceValidity");
  } else if (evidenceValidityMean < (defaultThresholds.evidenceValidity.warn ?? 0.98)) {
    warnedThresholds.push("evidenceValidity");
  }

  // Routing recall
  if (routingScores.routingRecall < (defaultThresholds.routingRecall.fail ?? 0.90)) {
    failedThresholds.push("routingRecall");
  } else if (routingScores.routingRecall < (defaultThresholds.routingRecall.warn ?? 0.95)) {
    warnedThresholds.push("routingRecall");
  }

  // Negative control high severity flags
  if (negativeHighSevBreaches > (defaultThresholds.negativeControlHighSevFlags.max ?? 0)) {
    failedThresholds.push("negativeControlHighSevFlags");
  }

  // Check maxRegressionVsBaseline = 0.03 (§19)
  const maxReg = defaultThresholds.maxRegressionVsBaseline;
  if (vsBaseline["high_severity_recall"] < -maxReg) failedThresholds.push("regression:high_severity_recall");
  if (vsBaseline["precision"] < -maxReg) failedThresholds.push("regression:precision");
  if (vsBaseline["severity_accuracy"] < -maxReg) failedThresholds.push("regression:severity_accuracy");
  if (vsBaseline["evidence_validity"] < -maxReg) failedThresholds.push("regression:evidence_validity");
  if (vsBaseline["routing_recall"] < -maxReg) failedThresholds.push("regression:routing_recall");
  if (vsBaseline["exposure_median_error"] > maxReg) failedThresholds.push("regression:exposure_median_error");

  // Construct Report Data
  const reportData: ReportJsonData = {
    run_id: runId,
    attribution: {
      git_sha: gitSha,
      mode: options.mode,
      model_versions: evalConfig.models,
      prompt_versions: evalConfig.promptVersions,
      dataset_versions: evalConfig.datasetVersions,
    },
    summary: {
      high_severity_recall: {
        mean: highSevRecallMean,
        n_positives: totalHighSevExpected,
        low_sample: isLowSample,
      },
      precision: {
        mean: precisionMean,
        n,
      },
      recall: {
        mean: recallMean,
      },
      severity_accuracy: {
        exact_mean: sevExactMean,
        within_one_mean: sevWithinOneMean,
      },
      exposure_median_error: medianExposureError,
      evidence_validity_mean: evidenceValidityMean,
      routing_recall: routingScores.routingRecall,
      routing_precision: routingScores.routingPrecision,
    },
    vs_baseline: vsBaseline,
    failed_thresholds: failedThresholds,
    warned_thresholds: warnedThresholds,
    fallback: {
      cases: fallbackCount,
      rate: n > 0 ? fallbackCount / n : 0,
    },
    cases: results.map((r) => ({
      id: r.caseId,
      class: r.datasetClass,
      pass: r.pass,
      scores: r.scores,
      latency_ms: r.latencyMs,
    })),
  };

  // Write reports
  const jsonPath = writeJsonReport(options.outDir, reportData);
  const mdPath = writeMarkdownReport(options.outDir, reportData);
  const htmlPath = writeHtmlReport(options.outDir, reportData);

  console.log(`\nGenerated Reports:`);
  console.log(`• JSON:     ${jsonPath}`);
  console.log(`• Markdown: ${mdPath}`);
  console.log(`• HTML:     ${htmlPath}\n`);

  // Update Baseline if requested
  if (options.updateBaseline) {
    const newBaseline = {
      version: "1.0.0",
      git_sha: gitSha,
      timestamp: new Date().toISOString(),
      metrics: {
        high_severity_recall: highSevRecallMean,
        precision: precisionMean,
        recall: recallMean,
        severity_accuracy: sevExactMean,
        exposure_median_error: medianExposureError,
        evidence_validity: evidenceValidityMean,
        routing_recall: routingScores.routingRecall,
        routing_precision: routingScores.routingPrecision,
      },
    };
    fs.writeFileSync(baselinePath, JSON.stringify(newBaseline, null, 2), "utf-8");
    console.log(`✅ Baseline successfully updated in ${baselinePath}\n`);
  }

  // Print Summary Table
  console.log(`----------------------------------------------------------------`);
  console.log(`   EVALUATION SUMMARY SCOREBOARD`);
  console.log(`----------------------------------------------------------------`);
  console.log(`High-Severity Recall:      ${(highSevRecallMean * 100).toFixed(1)}% ${isLowSample ? "(⚠️ Low sample)" : ""}`);
  console.log(`Breach Precision:          ${(precisionMean * 100).toFixed(1)}%`);
  console.log(`Severity Exact Agreement:  ${(sevExactMean * 100).toFixed(1)}%`);
  console.log(`Exposure Median Error:     ${(medianExposureError * 100).toFixed(1)}%`);
  console.log(`Evidence Validity:         ${(evidenceValidityMean * 100).toFixed(1)}%`);
  console.log(`Review Routing Recall:     ${(routingScores.routingRecall * 100).toFixed(1)}%`);
  console.log(`Fallback Activation Rate:  ${((fallbackCount / n) * 100).toFixed(1)}%`);
  console.log(`----------------------------------------------------------------`);

  if (failedThresholds.length > 0) {
    console.error(`\n❌ QUALITY GATES FAILED (${failedThresholds.length} thresholds breached):`);
    for (const f of failedThresholds) {
      console.error(`   - ${f}`);
    }
    return { success: false, reportData };
  }

  if (warnedThresholds.length > 0) {
    console.warn(`\n⚠️ QUALITY WARNINGS (${warnedThresholds.length} warnings):`);
    for (const w of warnedThresholds) {
      console.warn(`   - ${w}`);
    }
  }

  console.log(`\n✅ ALL QUALITY GATES PASSED!`);
  return { success: true, reportData };
}

// If invoked directly from CLI
const isDirectCli = typeof process !== "undefined" && process.argv[1]?.replace(/\\/g, "/").endsWith("evals/run.ts");
if (isDirectCli) {
  runEvalSuite()
    .then(({ success }) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error("Evaluation run crashed:", err);
      process.exit(1);
    });
}

