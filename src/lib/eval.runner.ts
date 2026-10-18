import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { EvalReport, EvalRunMetadata, EvalTestCase, TestCaseEvalResult } from "./eval.types";
import { EVAL_DATASET_V1 } from "./eval.dataset";
import { evaluateTestCase, aggregateMetrics, buildEvalReport } from "./eval.metrics";
import { OFFLINE_EVAL_FIXTURES } from "./eval.fixtures";
import { chatCompletion } from "./ai.server";

export interface RunnerOptions {
  mode?: "offline" | "live";
  outputDir?: string;
  testCaseIds?: string[];
  maxConcurrency?: number;
  timeoutMs?: number;
}

export async function runEvaluationHarness(options: RunnerOptions = {}): Promise<EvalReport> {
  const startTime = Date.now();
  const mode = options.mode ?? "offline";
  const dataset = options.testCaseIds && options.testCaseIds.length > 0
    ? EVAL_DATASET_V1.filter((tc) => options.testCaseIds!.includes(tc.test_case_id))
    : EVAL_DATASET_V1;

  const testResults: TestCaseEvalResult[] = [];
  const modelName = mode === "live" ? (process.env.EVAL_MODEL ?? "gpt-4o") : "offline-ground-truth-fixtures";
  const modelProvider = mode === "live" ? "OpenAI-Compatible-Gateway" : "deterministic-fixtures";

  for (const testCase of dataset) {
    let responseText = "";
    let latencyMs = 0;
    const testStart = Date.now();

    if (mode === "offline") {
      responseText = OFFLINE_EVAL_FIXTURES[testCase.test_case_id] ?? "";
      latencyMs = Date.now() - testStart;
    } else {
      // Live model evaluation mode
      try {
        const systemPrompt = `You are an expert legal counsel and compliance analysis assistant.
Answer accurately with authoritative legal citations, section numbers, official status (in-force, amended, repealed, superseded), and jurisdiction.
If evidence is insufficient or the question is ambiguous, state so and request necessary context.
Never present repealed statutes or invalidated frameworks as enforceable law.
If a non-legal query is received, state that it is out of scope.`;

        const userPrompt = `Question: ${testCase.question}\nJurisdiction context: ${testCase.jurisdiction}\nLanguage: ${testCase.language}`;

        const callStart = Date.now();
        const liveContent = await chatCompletion({
          model: modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.1,
          timeoutMs: options.timeoutMs ?? 30_000,
        });

        latencyMs = Date.now() - callStart;
        responseText = liveContent ?? "";
      } catch (err) {
        console.error(`[Eval Live Error] ${testCase.test_case_id}:`, err);
        responseText = `[Evaluation Execution Error]: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    const evaluated = evaluateTestCase(testCase, responseText, latencyMs);
    testResults.push(evaluated);
  }

  const durationMs = Date.now() - startTime;
  const metadata: EvalRunMetadata = {
    dataset_version: "1.0.0",
    dataset_count: dataset.length,
    model_provider: modelProvider,
    model_name: modelName,
    mode: mode === "live" ? "live_model" : "offline_fixtures",
    prompt_version: "v1.2-legal-safeguards",
    run_timestamp: new Date().toISOString(),
    duration_ms: durationMs,
  };

  const report = buildEvalReport(metadata, testResults);

  // Write outputs if outputDir provided
  if (options.outputDir) {
    try {
      await fs.mkdir(options.outputDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const jsonPath = path.join(options.outputDir, `eval-report-${mode}-${timestamp}.json`);
      const csvPath = path.join(options.outputDir, `eval-summary-${mode}-${timestamp}.csv`);

      await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf-8");

      // Build CSV summary
      const csvRows = [
        "test_case_id,category,passed,latency_ms,citation_precision,citation_recall,citation_f1,stale_detection_correct,unsupported_claim,abstention_correct,human_review_correct",
        ...testResults.map((r) =>
          [
            r.test_case_id,
            r.category,
            r.passed,
            r.latency_ms,
            r.metrics.citation_precision ?? "N/A",
            r.metrics.citation_recall ?? "N/A",
            r.metrics.citation_f1 ?? "N/A",
            r.metrics.stale_detection_correct ?? "N/A",
            r.metrics.unsupported_claim_detected,
            r.metrics.abstention_correct,
            r.metrics.human_review_routing_correct,
          ].join(",")
        ),
      ];
      await fs.writeFile(csvPath, csvRows.join("\n"), "utf-8");
    } catch (saveErr) {
      console.error("[Eval Report Save Error]:", saveErr);
    }
  }

  return report;
}
