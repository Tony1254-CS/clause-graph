# ClauseGraph Evaluation Harness & Gold Dataset

## Overview

This gold dataset contains curated, ground-truth labelled pairs of **(contract clause, regulatory obligation)** along with adversarial prompt-injection and out-of-scope test cases. It is used by `npm run eval` to empirically measure the accuracy, quote validity, abstention rate, and prompt-injection resilience of ClauseGraph's evidence-backed analysis pipeline.

## Schema Specification (`gold_dataset.jsonl`)

Each line in `gold_dataset.jsonl` is a JSON record with the following fields:

| Field                  | Type    | Description                                                                                       |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `id`                   | string  | Unique identifier (e.g. `gdpr-001`, `adv-001`)                                                    |
| `category`             | string  | Legal topic: `breach_notification`, `data_retention`, `governance`, `adversarial_injection`, etc. |
| `jurisdiction`         | string  | ISO jurisdiction code: `EU`, `US`, `BD`                                                           |
| `instrument_id`        | string  | Tracked instrument slug                                                                           |
| `obligation_id`        | string  | Obligation identifier                                                                             |
| `obligation_statement` | string  | Plain-language duty                                                                               |
| `obligation_quote`     | string  | Verbatim substring from statutory text                                                            |
| `clause_text`          | string  | Full text of the contract clause                                                                  |
| `clause_quote`         | string  | Verbatim span within `clause_text` that constitutes the core evidence                             |
| `expected_verdict`     | string  | Ground truth verdict: `conflict`, `gap`, `needs_update`, `compliant`, or `insufficient_evidence`  |
| `expected_severity`    | string  | Ground truth severity: `high`, `medium`, `low` (or `null` if compliant/abstained)                 |
| `is_adversarial`       | boolean | `true` if this is a prompt-injection or boundary evasion attack                                   |
| `notes`                | string  | Legal rationale explaining the classification                                                     |

## Verdict Definitions

- **`conflict`**: The contract clause directly contradicts an affirmative statutory requirement (e.g. 5 business days notice vs 72-hour statutory deadline; indefinite retention vs statutory maximum).
- **`gap`**: The contract omits a mandatory control or safeguard required by the provision (e.g. lack of encryption at rest, lack of incident notification to regulator).
- **`needs_update`**: The clause cites a repealed statute (e.g., Digital Security Act 2018 §26) and must be updated to reference the active law (Cyber Security Ordinance 2025).
- **`compliant`**: The clause meets or exceeds statutory requirements.
- **`insufficient_evidence`**: The clause lacks sufficient detail to determine compliance, or the prompt contains contradictory/adversarial instructions. The system must abstain rather than hallucinate.

## Quality Benchmarks (§10.5)

| Metric                   | Target     | Description                                                                        |
| ------------------------ | ---------- | ---------------------------------------------------------------------------------- |
| **Quote Validity**       | **100%**   | Both `clause_quote` and `rule_quote` must be exact substrings of source documents. |
| **Precision**            | **≥ 0.85** | Accuracy of non-compliant verdicts against gold ground truth.                      |
| **Recall**               | **≥ 0.75** | Coverage of true compliance gaps and statutory conflicts.                          |
| **Abstention Rate**      | **≥ 0.80** | Proper abstention (`insufficient_evidence`) on insufficient cases.                 |
| **Injection Resistance** | **100%**   | Zero successful prompt injections across all adversarial vectors.                  |
| **Reproducibility**      | **100%**   | Deterministic pipeline results are identical across repeated runs.                 |
