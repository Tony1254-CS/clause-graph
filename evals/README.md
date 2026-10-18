# ClauseGraph AI Evaluation Harness

**Specification:** `ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md` (Version 2.0)  
**Location:** `evals/`  
**Purpose:** Measure, govern, and block regressions in ClauseGraph's AI simulation pipeline (`simulateImpact`) across 6 versioned dataset classes.

---

## 1. Quick Start Commands

```bash
# Run fast deterministic replay on pull requests (9 golden cases)
npm run eval:quick

# Run full evaluation suite across all datasets (13+ cases)
npm run eval

# Run live against the configured AI gateway (with cost ceiling and rate limit retries)
npm run eval:live

# Record / refresh deterministic cassettes from a live model run
npm run eval:record

# Update baseline metrics upon authorized review & sign-off
npm run eval:update-baseline
```

---

## 2. Dataset Architecture

All evaluation cases are stored in `evals/datasets/` under distinct classes with explicit purpose:

| Dataset | Path | Description |
|---|---|---|
| **Landmark** | `evals/datasets/simulation/landmark.v1.json` | High-profile statutory enforcement cases (Meta €1.2B GDPR Art 46, Equifax $700M FTC Safeguards, Grameenphone ৳35M BTRC QoS). |
| **Synthetic** | `evals/datasets/simulation/synthetic.v1.json` | Edge case coverage (missing SCCs, 72h vs 4h reporting delay, Bangladesh CII data localization, synthetic AI agent disclosures). |
| **Negative Controls** | `evals/datasets/simulation/negative.v1.json` | Clean commercial contracts with zero regulatory nexus. **High-severity flags must strictly be 0**. |
| **Adversarial** | `evals/datasets/simulation/adversarial.v1.json` | Prompt injection attacks, mutual legal assistance (MLAT) vs CLOUD Act jurisdictional conflicts. |
| **Hold-Out** | `evals/datasets/simulation/holdout.v1.json` | Pinned test set never shown to prompts or candidate models. **Promoting candidates directly into hold-out is cryptographically forbidden**. |
| **Candidates** | `evals/datasets/candidates/candidates.json` | Staging queue for rejected or edited outputs from the Human Review Queue awaiting admin promotion. |

---

## 3. Quality Gate Thresholds & Regression Blocker

The CLI enforces the following quality gates (`evals/thresholds.ts`):

| Metric | Warn | Fail | Notes |
|---|---:|---:|---|
| **High-Severity Breach Recall** | 0.95 | 0.90 | **Headline Metric**: Reported separately; low sample size flagged when $n < 20$. |
| **Breach Detection Precision** | 0.80 | 0.70 | False positive control. |
| **Severity Agreement (Exact)** | 0.85 | 0.75 | 3x3 matrix agreement; within-1 level agreement also measured. |
| **Exposure Median Error** | 0.30 | 0.50 | Lower is better. |
| **Evidence Validity** | 0.98 | 0.95 | Verbatim clause text quote presence and ontology ID verification. |
| **Review Queue Routing Recall** | 0.95 | 0.90 | Verifies high-risk cases route to the Human Review Queue. |
| **Negative Control High-Severity** | — | **0** | Strict 0 ceiling. |
| **Max Regression vs Baseline** | — | **0.03** | Any regression $> 3\%$ against `evals/baselines/baseline.json` fails the run. |

---

## 4. Generated Artifacts

Every run generates three reports in `evals/results/`:
- `report.json`: Machine-readable JSON with full attribution (`git_sha`, `model_versions`, `prompt_versions`, `dataset_versions`), confidence intervals, confusion matrix, and case-by-case scores.
- `report.md`: Engineering and domain-expert markdown summary table.
- `report.html`: Standalone interactive report styled for General Counsel and compliance officers.

---

## 5. Human Review Queue Integration (§21)

1. When a reviewer in the Human Review Queue rejects or edits an AI finding, `decideReview()` automatically stages the item into `evals/datasets/candidates/candidates.json`.
2. Customer PII, secrets, emails, and identifiers are sanitized via `redactAuditPayload()`.
3. An admin can review and promote candidate fixtures using `promoteReviewCandidate()` to `landmark`, `synthetic`, `negative`, or `adversarial`.
4. Promotion to `holdout` is blocked by server validation to prevent benchmark contamination.
