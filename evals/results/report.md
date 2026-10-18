# ClauseGraph AI Evaluation Report — Run eval-1792313496320

**Evaluation Status:** ✅ **PASS** (All quality gates passed)  
**Date/Time:** `2026-10-18T08:51:36.531Z`  
**Mode:** `replay` | **Git SHA:** `f70348d`  

### 1. Attribution & Model Configuration

| Component | Identifier / Version |
|---|---|
| Model (simulation) | `gpt-4o-2024-08-06` |
| Model (extraction) | `gemini-2.5-flash` |
| Model (judge) | `gemini-2.5-flash` |
| Prompt (simulation) | `v7` |
| Prompt (extraction) | `v3` |
| Prompt (judge) | `v1` |
| Dataset (landmark) | `v1.0.0` |
| Dataset (synthetic) | `v1.0.0` |
| Dataset (negative) | `v1.0.0` |
| Dataset (adversarial) | `v1.0.0` |
| Dataset (holdout) | `v1.0.0` |

---

### 2. Headline Metrics & Quality Gates

| Metric | Observed Value | Baseline Diff | Status | Sample Count / Confidence |
|---|---:|---:|:---:|---|
| **High-Severity Breach Recall** | **100.0%** | 0.0% | ✅ PASS | ⚠️ Low sample (n=9 < 20) |
| Precision (Breach Detection) | 100.0% | +5.0% 🔺 | ✅ PASS | n=13 evaluations |
| Overall Recall | 100.0% | +5.0% 🔺 | — | Detection rate |
| Severity Agreement (Exact) | 100.0% | +5.0% 🔺 | ✅ PASS | Within 1 level: 100.0% |
| Exposure Median Error (Lower=Better) | 0.0% | 0.0% | ✅ PASS | Dollar quantification |
| Evidence Validity (Quotes & Ontology) | 100.0% | 0.0% | ✅ PASS | Real contract verbatim quotes |
| Review Queue Routing Recall | 100.0% | 0.0% | ✅ PASS | Precision: 100.0% |

---

### 3. Operational Performance & Fallback Separation

- **Fallback Activation Rate:** 0.0% (0 cases triggered deterministic fallback)
- **Evaluated Cases Count:** 13

---

### 4. Case-by-Case Breakdown

| Case ID | Dataset Class | Status | Detection F1 | Severity Agr. | Exposure Error | Evidence Valid | Latency |
|---|---|:---:|---:|---:|---:|---:|---:|
| `landmark-meta-gdpr-2023` | landmark | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |
| `landmark-equifax-ftc-2019` | landmark | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |
| `landmark-grameenphone-btrc-2022` | landmark | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |
| `synthetic-dpa-missing-scc` | synthetic | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |
| `synthetic-breach-notice-delay` | synthetic | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |
| `synthetic-ai-act-transparency` | synthetic | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |
| `synthetic-bd-data-localization` | synthetic | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |
| `cand-dpa-ambiguity` | synthetic | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |
| `negative-clean-office-lease` | negative | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |
| `negative-fully-compliant-dpa` | negative | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |
| `adversarial-prompt-injection-clause` | adversarial | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |
| `adversarial-conflicting-jurisdiction` | adversarial | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |
| `holdout-eu-fintech-ai-sla` | holdout | ✅ PASS | 100% | 100% | 0.0% | 100% | 0ms |

---
*Report generated deterministically by ClauseGraph Evaluation Harness.*  
