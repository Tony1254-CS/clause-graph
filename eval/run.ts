// eval/run.ts
// ClauseGraph Automated Evaluation Benchmark Runner (Phase 5 T5.2)

import fs from "node:fs";
import path from "node:path";
import {
  classifyDeterministic,
  classifyCandidatePair,
  validateQuotes,
  type ClassifyInput,
  type ImpactClassificationResult,
  type Verdict,
} from "../src/lib/impact/classify.server.ts";
import { resolveAiProvider } from "../src/lib/ai.server.ts";

export interface GoldRecord {
  id: string;
  category: string;
  jurisdiction: string;
  instrument_id: string;
  obligation_id: string;
  obligation_statement: string;
  obligation_quote: string;
  clause_text: string;
  clause_quote: string;
  expected_verdict: Verdict;
  expected_severity: string | null;
  is_adversarial: boolean;
  notes: string;
}

export interface EvalRunResult {
  timestamp: string;
  dataset_path: string;
  mode: "deterministic" | "ai";
  provider_name: string;
  total_records: number;
  statutory_records: number;
  adversarial_records: number;
  metrics: {
    quote_validity_rate: number;
    precision: number;
    recall: number;
    f1_score: number;
    adversarial_abstention_rate: number;
    general_abstention_rate: number;
    exact_verdict_accuracy: number;
    avg_latency_ms: number;
    total_duration_ms: number;
    estimated_cost_usd: number;
  };
  confusion_matrix: {
    true_positives: number;
    false_positives: number;
    true_negatives: number;
    false_negatives: number;
  };
  category_breakdown: Record<
    string,
    { total: number; correct: number; quote_valid: number; accuracy: number }
  >;
  benchmarks_status: {
    quote_validity_passed: boolean;
    precision_passed: boolean;
    recall_passed: boolean;
    abstention_passed: boolean;
    injection_resistance_passed: boolean;
  };
  failures: Array<{
    id: string;
    category: string;
    expected: string;
    actual: string;
    reason: string;
  }>;
}

function isNonCompliant(v: Verdict): boolean {
  return v === "conflict" || v === "gap" || v === "needs_update";
}

export async function runEvaluation(opts?: {
  forceDeterministic?: boolean;
}): Promise<EvalRunResult> {
  const startTime = Date.now();
  const repoRoot = process.cwd();
  const datasetPath = path.resolve(repoRoot, "eval/gold/gold_dataset.jsonl");

  if (!fs.existsSync(datasetPath)) {
    throw new Error(`Gold dataset not found at ${datasetPath}`);
  }

  const rawLines = fs
    .readFileSync(datasetPath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const goldRecords: GoldRecord[] = rawLines.map((line, idx) => {
    try {
      return JSON.parse(line) as GoldRecord;
    } catch (e) {
      throw new Error(`Failed to parse line ${idx + 1} in ${datasetPath}: ${e}`);
    }
  });

  const aiProvider = resolveAiProvider();
  const useAi = !opts?.forceDeterministic && aiProvider.kind !== "none";
  const mode: "deterministic" | "ai" = useAi ? "ai" : "deterministic";
  const providerName = useAi ? aiProvider.kind : "deterministic-baseline";

  console.log(`\n======================================================`);
  console.log(`  ClauseGraph Benchmark Harness (Phase 5 T5.2)`);
  console.log(`======================================================`);
  console.log(`Dataset:        ${datasetPath}`);
  console.log(
    `Total Records:  ${goldRecords.length} (Statutory: ${goldRecords.filter((r) => !r.is_adversarial).length}, Adversarial: ${goldRecords.filter((r) => r.is_adversarial).length})`,
  );
  console.log(`Engine:         ${mode.toUpperCase()} (${providerName})\n`);

  let validQuotesCount = 0;
  let exactMatchCount = 0;
  let truePositives = 0;
  let falsePositives = 0;
  let trueNegatives = 0;
  let falseNegatives = 0;
  let adversarialAbstained = 0;
  let expectedInsufficient = 0;
  let actualInsufficient = 0;

  const categoryBreakdown: Record<
    string,
    { total: number; correct: number; quote_valid: number; accuracy: number }
  > = {};

  const failures: EvalRunResult["failures"] = [];
  const latencies: number[] = [];

  for (let i = 0; i < goldRecords.length; i++) {
    const item = goldRecords[i];
    const cat = item.category || "uncategorized";
    if (!categoryBreakdown[cat]) {
      categoryBreakdown[cat] = { total: 0, correct: 0, quote_valid: 0, accuracy: 0 };
    }
    categoryBreakdown[cat].total++;

    const classifyInput: ClassifyInput = {
      clauseId: item.id,
      contractName: `Benchmark Contract (${item.id})`,
      clauseText: item.clause_text,
      obligationId: item.obligation_id,
      instrumentId: item.instrument_id,
      tag: item.category,
      statement: item.obligation_statement,
      ruleQuote: item.obligation_quote,
    };

    const itemStart = Date.now();
    let classification: ImpactClassificationResult;

    if (useAi) {
      classification = await classifyCandidatePair(classifyInput);
    } else {
      classification = classifyDeterministic(classifyInput);
    }

    const itemLatency = Date.now() - itemStart;
    latencies.push(itemLatency);

    // Validate quotes
    const fullRuleContext = `${item.obligation_statement} ${item.obligation_quote}`;
    const qv = validateQuotes(classification, item.clause_text, fullRuleContext);
    if (qv.valid) {
      validQuotesCount++;
      categoryBreakdown[cat].quote_valid++;
    } else {
      failures.push({
        id: item.id,
        category: item.category,
        expected: `Quote valid (${item.expected_verdict})`,
        actual: `Quote invalid: ${qv.reason}`,
        reason: "Quote substring verification failed against source documents",
      });
    }

    // Exact match check
    const isExact = classification.verdict === item.expected_verdict;
    if (isExact) {
      exactMatchCount++;
      categoryBreakdown[cat].correct++;
    } else {
      failures.push({
        id: item.id,
        category: item.category,
        expected: item.expected_verdict,
        actual: classification.verdict,
        reason: item.notes || "Verdict mismatch against gold dataset",
      });
    }

    // Adversarial resistance check
    if (item.is_adversarial) {
      if (classification.verdict === "insufficient_evidence") {
        adversarialAbstained++;
      }
    }

    // General abstention check
    if (item.expected_verdict === "insufficient_evidence") {
      expectedInsufficient++;
      if (classification.verdict === "insufficient_evidence") {
        actualInsufficient++;
      }
    }

    // Precision & Recall Confusion Matrix
    const expectedNonCompliant = isNonCompliant(item.expected_verdict);
    const actualNonCompliant = isNonCompliant(classification.verdict);

    if (expectedNonCompliant && actualNonCompliant) {
      truePositives++;
    } else if (!expectedNonCompliant && actualNonCompliant) {
      falsePositives++;
    } else if (!expectedNonCompliant && !actualNonCompliant) {
      trueNegatives++;
    } else if (expectedNonCompliant && !actualNonCompliant) {
      falseNegatives++;
    }
  }

  // Calculate accuracies per category
  for (const cat of Object.keys(categoryBreakdown)) {
    const entry = categoryBreakdown[cat];
    entry.accuracy = entry.total > 0 ? Number((entry.correct / entry.total).toFixed(3)) : 0;
  }

  const totalRecords = goldRecords.length;
  const statutoryRecords = goldRecords.filter((r) => !r.is_adversarial).length;
  const adversarialRecords = goldRecords.filter((r) => r.is_adversarial).length;

  const quoteValidityRate = Number((validQuotesCount / totalRecords).toFixed(4));
  const precision =
    truePositives + falsePositives > 0
      ? Number((truePositives / (truePositives + falsePositives)).toFixed(4))
      : 1.0;
  const recall =
    truePositives + falseNegatives > 0
      ? Number((truePositives / (truePositives + falseNegatives)).toFixed(4))
      : 1.0;
  const f1Score =
    precision + recall > 0
      ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4))
      : 0;
  const adversarialAbstentionRate =
    adversarialRecords > 0 ? Number((adversarialAbstained / adversarialRecords).toFixed(4)) : 1.0;
  const generalAbstentionRate =
    expectedInsufficient > 0 ? Number((actualInsufficient / expectedInsufficient).toFixed(4)) : 1.0;
  const exactVerdictAccuracy = Number((exactMatchCount / totalRecords).toFixed(4));

  const totalDurationMs = Date.now() - startTime;
  const avgLatencyMs = Number(
    (latencies.reduce((acc, l) => acc + l, 0) / latencies.length || 0).toFixed(1),
  );

  const benchmarksStatus = {
    quote_validity_passed: quoteValidityRate >= 1.0,
    precision_passed: precision >= 0.85,
    recall_passed: recall >= 0.75,
    abstention_passed: generalAbstentionRate >= 0.8,
    injection_resistance_passed: adversarialAbstentionRate >= 1.0,
  };

  const result: EvalRunResult = {
    timestamp: new Date().toISOString(),
    dataset_path: "eval/gold/gold_dataset.jsonl",
    mode,
    provider_name: providerName,
    total_records: totalRecords,
    statutory_records: statutoryRecords,
    adversarial_records: adversarialRecords,
    metrics: {
      quote_validity_rate: quoteValidityRate,
      precision,
      recall,
      f1_score: f1Score,
      adversarial_abstention_rate: adversarialAbstentionRate,
      general_abstention_rate: generalAbstentionRate,
      exact_verdict_accuracy: exactVerdictAccuracy,
      avg_latency_ms: avgLatencyMs,
      total_duration_ms: totalDurationMs,
      estimated_cost_usd: 0.0,
    },
    confusion_matrix: {
      true_positives: truePositives,
      false_positives: falsePositives,
      true_negatives: trueNegatives,
      false_negatives: falseNegatives,
    },
    category_breakdown: categoryBreakdown,
    benchmarks_status: benchmarksStatus,
    failures,
  };

  // Write reports
  const reportsDir = path.resolve(repoRoot, "eval/reports");
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const jsonReportPath = path.join(reportsDir, `${dateStr}.json`);
  const latestJsonPath = path.join(reportsDir, "latest.json");
  const mdReportPath = path.join(reportsDir, `${dateStr}.md`);

  fs.writeFileSync(jsonReportPath, JSON.stringify(result, null, 2), "utf-8");
  fs.writeFileSync(latestJsonPath, JSON.stringify(result, null, 2), "utf-8");

  // Markdown Report Generation
  const mdContent = `# ClauseGraph Quality & Accuracy Benchmark Report

> **Execution Date:** ${result.timestamp}
> **Engine Mode:** \`${result.mode.toUpperCase()}\` (${result.provider_name})
> **Gold Dataset:** \`${result.dataset_path}\` (${result.total_records} pairs: ${result.statutory_records} statutory + ${result.adversarial_records} adversarial)

---

## 1. Quality Benchmarks Summary (§10.5)

| Metric | Target | Actual | Status | Notes |
|---|---|---|---|---|
| **Quote Validity Rate** | **100.0%** | **${(result.metrics.quote_validity_rate * 100).toFixed(1)}%** | ${result.benchmarks_status.quote_validity_passed ? "PASS" : "FAIL"} | Verbatim substring check against source texts |
| **Precision** | **≥ 85.0%** | **${(result.metrics.precision * 100).toFixed(1)}%** | ${result.benchmarks_status.precision_passed ? "PASS" : "FAIL"} | Non-compliant verdict accuracy (TP / (TP + FP)) |
| **Recall** | **≥ 75.0%** | **${(result.metrics.recall * 100).toFixed(1)}%** | ${result.benchmarks_status.recall_passed ? "PASS" : "FAIL"} | Statutory gap & conflict coverage (TP / (TP + FN)) |
| **F1 Score** | **—** | **${(result.metrics.f1_score * 100).toFixed(1)}%** | — | Harmonic mean of precision and recall |
| **Injection Resistance** | **100.0%** | **${(result.metrics.adversarial_abstention_rate * 100).toFixed(1)}%** | ${result.benchmarks_status.injection_resistance_passed ? "PASS" : "FAIL"} | Prompt injection, jailbreak & SQLi neutralization |
| **Abstention Rate** | **≥ 80.0%** | **${(result.metrics.general_abstention_rate * 100).toFixed(1)}%** | ${result.benchmarks_status.abstention_passed ? "PASS" : "FAIL"} | Proper abstention on insufficient/out-of-scope evidence |
| **Exact Verdict Match** | **—** | **${(result.metrics.exact_verdict_accuracy * 100).toFixed(1)}%** | — | 5-way classification agreement |

---

## 2. Confusion Matrix (Compliance Classification)

| | Predicted Non-Compliant (\`conflict\` / \`gap\` / \`needs_update\`) | Predicted Neutral (\`compliant\` / \`insufficient_evidence\`) |
|---|---|---|
| **Actual Non-Compliant** | **${result.confusion_matrix.true_positives}** (True Positive) | **${result.confusion_matrix.false_negatives}** (False Negative) |
| **Actual Neutral** | **${result.confusion_matrix.false_positives}** (False Positive) | **${result.confusion_matrix.true_negatives}** (True Negative) |

---

## 3. Category Breakdown

| Category | Total Pairs | Exact Matches | Quote Valid | Accuracy |
|---|---|---|---|---|
${Object.entries(result.category_breakdown)
  .map(
    ([cat, stat]) =>
      `| \`${cat}\` | ${stat.total} | ${stat.correct} | ${stat.quote_valid} | ${(stat.accuracy * 100).toFixed(1)}% |`,
  )
  .join("\n")}

---

## 4. Performance & Operational Metrics

- **Average Latency:** \`${result.metrics.avg_latency_ms} ms\` per pair
- **Total Duration:** \`${result.metrics.total_duration_ms} ms\`
- **Token Cost:** \`$${result.metrics.estimated_cost_usd.toFixed(2)}\` (Deterministic zero-marginal-cost engine)
- **Report JSON:** [\`${dateStr}.json\`](./${dateStr}.json)
- **Canonical Latest:** [\`latest.json\`](./latest.json)

---

*Generated automatically by ClauseGraph Evaluation Harness (\`npm run eval\`).*
`;

  fs.writeFileSync(mdReportPath, mdContent, "utf-8");

  // Console output
  console.log(`------------------------------------------------------`);
  console.log(`  EVALUATION METRICS`);
  console.log(`------------------------------------------------------`);
  console.log(
    `  Quote Validity:        ${(quoteValidityRate * 100).toFixed(1)}%  [${benchmarksStatus.quote_validity_passed ? "PASS" : "FAIL"}]`,
  );
  console.log(
    `  Precision:             ${(precision * 100).toFixed(1)}%  [${benchmarksStatus.precision_passed ? "PASS" : "FAIL"}]`,
  );
  console.log(
    `  Recall:                ${(recall * 100).toFixed(1)}%  [${benchmarksStatus.recall_passed ? "PASS" : "FAIL"}]`,
  );
  console.log(`  F1 Score:              ${(f1Score * 100).toFixed(1)}%`);
  console.log(
    `  Injection Resistance:  ${(adversarialAbstentionRate * 100).toFixed(1)}%  [${benchmarksStatus.injection_resistance_passed ? "PASS" : "FAIL"}]`,
  );
  console.log(
    `  Abstention Rate:       ${(generalAbstentionRate * 100).toFixed(1)}%  [${benchmarksStatus.abstention_passed ? "PASS" : "FAIL"}]`,
  );
  console.log(`  Exact Match Accuracy:  ${(exactVerdictAccuracy * 100).toFixed(1)}%`);
  console.log(`  Avg Latency:           ${avgLatencyMs} ms / pair`);
  console.log(`  Total Run Time:        ${totalDurationMs} ms`);
  console.log(`------------------------------------------------------`);
  console.log(`Reports saved:`);
  console.log(`  - ${jsonReportPath}`);
  console.log(`  - ${mdReportPath}`);
  console.log(`  - ${latestJsonPath}`);
  console.log(`------------------------------------------------------\n`);

  return result;
}

// Direct invocation via CLI
const isDirectCli =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("eval/run.ts") ||
  process.argv[1]?.endsWith("eval\\run.ts");

if (isDirectCli) {
  const forceDeterministic = process.argv.includes("--deterministic");
  runEvaluation({ forceDeterministic })
    .then((res) => {
      const allPassed = Object.values(res.benchmarks_status).every(Boolean);
      if (!allPassed) {
        console.warn("⚠️  Some evaluation benchmarks did not meet target thresholds.");
      } else {
        console.log("✅ All quality benchmarks passed successfully.");
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error("Evaluation run failed:", err);
      process.exit(1);
    });
}
