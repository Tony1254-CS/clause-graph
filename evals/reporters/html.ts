// ============================================================================
// Reporter: HTML Report: evals/reporters/html.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.8, §20)
// ============================================================================

import fs from "fs";
import path from "path";
import { type ReportJsonData } from "./json";

export function generateHtmlReport(data: ReportJsonData): string {
  const isPass = data.failed_thresholds.length === 0;
  const isWarn = data.warned_thresholds.length > 0;
  const statusColor = isPass ? (isWarn ? "#f59e0b" : "#10b981") : "#ef4444";
  const statusText = isPass ? (isWarn ? "PASSED WITH WARNINGS" : "PASSED") : "FAILED GATES";

  const hsr = data.summary.high_severity_recall;
  const prec = data.summary.precision;
  const sevExact = data.summary.severity_accuracy.exact_mean;
  const expErr = data.summary.exposure_median_error;
  const evVal = data.summary.evidence_validity_mean;
  const rRecall = data.summary.routing_recall;

  const casesRows = data.cases
    .map((c) => {
      const passBadge = c.pass
        ? `<span class="badge badge-pass">PASS</span>`
        : `<span class="badge badge-fail">FAIL</span>`;
      const f1 = c.scores?.detection?.f1 != null ? `${(c.scores.detection.f1 * 100).toFixed(0)}%` : "N/A";
      const sev = c.scores?.severity?.exactAgreement != null ? `${(c.scores.severity.exactAgreement * 100).toFixed(0)}%` : "N/A";
      const exp = c.scores?.exposure?.percentageError != null ? `${(c.scores.exposure.percentageError * 100).toFixed(1)}%` : "0.0%";
      const ev = c.scores?.evidence?.validityRate != null ? `${(c.scores.evidence.validityRate * 100).toFixed(0)}%` : "100%";

      return `
        <tr>
          <td><code>${escapeHtml(c.id)}</code></td>
          <td><span class="class-pill class-${c.class}">${c.class}</span></td>
          <td>${passBadge}</td>
          <td>${f1}</td>
          <td>${sev}</td>
          <td>${exp}</td>
          <td>${ev}</td>
          <td>${c.latency_ms} ms</td>
        </tr>
      `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClauseGraph AI Evaluation Report — Run ${escapeHtml(data.run_id)}</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #111827;
      --border: #1f2937;
      --text: #f9fafb;
      --text-muted: #9ca3af;
      --pass: #10b981;
      --warn: #f59e0b;
      --fail: #ef4444;
      --accent: #3b82f6;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 32px 24px;
      line-height: 1.5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 24px;
      letter-spacing: -0.02em;
    }
    .meta-text {
      color: var(--text-muted);
      font-size: 13px;
    }
    .status-badge {
      font-size: 14px;
      font-weight: 700;
      padding: 8px 16px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 1px solid ${statusColor};
      color: ${statusColor};
      background: ${statusColor}15;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
    }
    .kpi-title {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .kpi-value {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .kpi-sub {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 6px;
    }
    .section {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #93c5fd;
      background: #1e293b;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-pass { background: rgba(16, 185, 129, 0.2); color: var(--pass); }
    .badge-fail { background: rgba(239, 68, 68, 0.2); color: var(--fail); }
    .class-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 11px;
      background: #374151;
      color: #e5e7eb;
      text-transform: capitalize;
    }
    .class-landmark { background: #4338ca; color: #e0e7ff; }
    .class-synthetic { background: #065f46; color: #d1fae5; }
    .class-negative { background: #374151; color: #9ca3af; }
    .class-adversarial { background: #991b1b; color: #fee2e2; }
    .class-holdout { background: #7c2d12; color: #ffedd5; }
    .attribution-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      font-size: 13px;
    }
    .attribution-item {
      padding: 12px;
      background: #1e293b50;
      border-radius: 6px;
      border: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>ClauseGraph AI Evaluation Report</h1>
        <div class="meta-text">Run ID: <code>${escapeHtml(data.run_id)}</code> &bull; Mode: <code>${escapeHtml(data.attribution.mode)}</code> &bull; Git SHA: <code>${escapeHtml(data.attribution.git_sha)}</code></div>
      </div>
      <div>
        <span class="status-badge">${statusText}</span>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">High-Severity Recall</div>
        <div class="kpi-value" style="color: var(--pass);">${(hsr.mean * 100).toFixed(1)}%</div>
        <div class="kpi-sub">${hsr.low_sample ? "⚠️ Low sample (<20)" : `n=${hsr.n_positives} positives`}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Breach Precision</div>
        <div class="kpi-value">${(prec.mean * 100).toFixed(1)}%</div>
        <div class="kpi-sub">n=${prec.n} evaluations</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Severity Agreement</div>
        <div class="kpi-value">${(sevExact * 100).toFixed(1)}%</div>
        <div class="kpi-sub">Within 1: ${(data.summary.severity_accuracy.within_one_mean * 100).toFixed(1)}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Exposure Median Err</div>
        <div class="kpi-value">${(expErr * 100).toFixed(1)}%</div>
        <div class="kpi-sub">Dollar quantification</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Evidence Validity</div>
        <div class="kpi-value">${(evVal * 100).toFixed(1)}%</div>
        <div class="kpi-sub">Verbatim clause quotes</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Routing Recall</div>
        <div class="kpi-value">${(rRecall * 100).toFixed(1)}%</div>
        <div class="kpi-sub">Precision: ${(data.summary.routing_precision * 100).toFixed(1)}%</div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Attribution & Configuration</h2>
      <div class="attribution-grid">
        <div class="attribution-item">
          <strong>Models:</strong><br>
          ${Object.entries(data.attribution.model_versions || {}).map(([k, v]) => `• ${escapeHtml(k)}: <code>${escapeHtml(v)}</code><br>`).join("")}
        </div>
        <div class="attribution-item">
          <strong>Prompts:</strong><br>
          ${Object.entries(data.attribution.prompt_versions || {}).map(([k, v]) => `• ${escapeHtml(k)}: <code>${escapeHtml(v)}</code><br>`).join("")}
        </div>
        <div class="attribution-item">
          <strong>Datasets:</strong><br>
          ${Object.entries(data.attribution.dataset_versions || {}).map(([k, v]) => `• ${escapeHtml(k)}: <code>${escapeHtml(v)}</code><br>`).join("")}
        </div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">Case-by-Case Evaluation Matrix</h2>
      <table>
        <thead>
          <tr>
            <th>Case ID</th>
            <th>Class</th>
            <th>Status</th>
            <th>Detection F1</th>
            <th>Severity Agr.</th>
            <th>Exposure Err</th>
            <th>Evidence Valid</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          ${casesRows}
        </tbody>
      </table>
    </div>

    <div class="meta-text" style="text-align: center; margin-top: 32px;">
      Generated by ClauseGraph Evaluation Harness &bull; Tamper-Evident Governance Layer
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function writeHtmlReport(outDir: string, data: ReportJsonData): string {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const content = generateHtmlReport(data);
  const outPath = path.join(outDir, "report.html");
  fs.writeFileSync(outPath, content, "utf-8");
  return outPath;
}
