#!/usr/bin/env node
/**
 * CLI Entrypoint for ClauseGraph AI Evaluation Harness
 *
 * Usage:
 *   node --env-file=.env --import tsx src/scripts/run-eval.ts [--mode=offline|live] [--output=reports/eval]
 */

import { runEvaluationHarness } from "../lib/eval.runner.js";

async function main() {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith("--mode="));
  const outputArg = args.find((a) => a.startsWith("--output="));

  const mode = modeArg ? (modeArg.split("=")[1] as "offline" | "live") : "offline";
  const outputDir = outputArg ? outputArg.split("=")[1] : "reports/eval";

  console.log("===============================================================");
  console.log("     ClauseGraph Legal AI Evaluation & Benchmark Harness      ");
  console.log("===============================================================");
  console.log(`Execution Mode : ${mode.toUpperCase()}`);
  console.log(`Report Output  : ${outputDir}`);
  console.log("---------------------------------------------------------------");

  if (mode === "live") {
    const hasKey = Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.LOVABLE_API_KEY);
    if (!hasKey) {
      console.error("ERROR: Live evaluation mode requires OPENAI_API_KEY, GEMINI_API_KEY, or LOVABLE_API_KEY in environment.");
      process.exit(1);
    }
  }

  const report = await runEvaluationHarness({
    mode,
    outputDir,
  });

  console.log("\n--- EVALUATION SUMMARY ---");
  console.log(`Dataset Version            : ${report.metadata.dataset_version} (${report.metadata.dataset_count} test cases)`);
  console.log(`Model Evaluated            : ${report.metadata.model_name}`);
  console.log(`Pass Rate                  : ${(report.summary.pass_rate * 100).toFixed(1)}% (${report.summary.passed_test_cases}/${report.summary.total_test_cases})`);
  console.log(`Citation Precision (Avg)   : ${(report.summary.citation_precision_avg * 100).toFixed(1)}%`);
  console.log(`Citation Recall (Avg)      : ${(report.summary.citation_recall_avg * 100).toFixed(1)}%`);
  console.log(`Citation F1 Score (Avg)    : ${(report.summary.citation_f1_avg * 100).toFixed(1)}%`);
  console.log(`Stale Detection Accuracy   : ${(report.summary.stale_detection_f1 * 100).toFixed(1)}%`);
  console.log(`Unsupported Claim Rate     : ${(report.summary.unsupported_claim_rate * 100).toFixed(1)}% (Lower is better)`);
  console.log(`Abstention Quality Acc.    : ${(report.summary.abstention_quality_accuracy * 100).toFixed(1)}%`);
  console.log(`Human Review Routing Acc.  : ${(report.summary.human_review_routing_accuracy * 100).toFixed(1)}%`);
  console.log(`Risk Classification Acc.   : ${(report.summary.risk_level_classification_accuracy * 100).toFixed(1)}%`);
  console.log(`Average Latency            : ${report.summary.avg_latency_ms} ms`);
  console.log("---------------------------------------------------------------");

  if (report.failures.length > 0) {
    console.log(`\nFAILURES (${report.failures.length} cases):`);
    for (const f of report.failures) {
      console.log(`❌ [${f.test_case_id}] [${f.category}]`);
      for (const r of f.reasons) {
        console.log(`   - ${r}`);
      }
    }
    process.exit(1);
  } else {
    console.log("\n✅ ALL EVALUATION TEST CASES PASSED BENCHMARK THRESHOLDS!");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Evaluation Harness Fatal Exception:", err);
  process.exit(1);
});
