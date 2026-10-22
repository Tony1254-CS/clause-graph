# ClauseGraph: Complete AI Features & Machine Learning Architecture

ClauseGraph is a hybrid **AI + Deterministic Legal Graph Engine**. Rather than relying on a generic conversational chatbot, ClauseGraph implements **8 specialized AI features** engineered specifically for legal technology, contract risk analysis, and regulatory compliance graph traversal.

---

## 1. Overview of AI Features

| # | AI Feature Name | Primary Model | Core Responsibility & Output |
| :-: | :--- | :--- | :--- |
| **1** | **Autonomous Contract Segmentation & Extraction** | `gpt-4o-mini` | Ingests raw contract PDFs, segments distinct operational clauses, and links them to governing statutory articles. |
| **2** | **Zero-Hallucination Quote & Citation Verifier** | Hybrid (NLP + Regex) | Enforces exact substring matching against source documents and verifies active vs. repealed statutory citations. |
| **3** | **Regulatory Blast Radius & Financial Impact Simulator** | `gpt-4o` | Evaluates new or proposed statutory drafts against contract portfolios to determine dollar exposure ($) and generate remedial amendments. |
| **4** | **Multi-Tier Supply Chain Cascade Traversal** | `gpt-4o` | Recursively traverses vendor graphs (Tier 1, 2, 3) to model 3-hop statutory shock propagation and calculate indirect financial exposure. |
| **5** | **Predictive Radar & Adversarial What-If Formulator** | `gpt-4o` | Analyzes historical amendment trajectories (tightening vs. loosening) to formulate prospective adversarial regulatory drafts. |
| **6** | **Automated Legal Remediation Action Planner** | `gpt-4o` | Synthesizes 3-part executable action plans: corporate policy drafts, contract amendment language, and P0/P1/P2 engineering checklists. |
| **7** | **Compliance-as-Code Synthesizer** | `gpt-4o` | Translates legal mandates into actionable cloud audit scripts (Python/boto3) and Infrastructure-as-Code (Terraform/YAML). |
| **8** | **Historical Enforcement Backtesting Engine** | `gpt-4o` | Stress-tests active contract portfolios against historical multimillion-dollar enforcement cases (e.g., Meta €1.2B fine, British Airways). |

---

## 2. Detailed Technical Breakdown of Each AI Feature

### 1. Autonomous Contract Segmentation & Regulatory Linking
- **Source Files**: `src/lib/upload.server.ts` & `src/lib/jobs.worker.ts`
- **Execution Mechanism**:
  - When an enterprise user uploads a contract (Customer MSA, Vendor DPA, SLA), raw text and layout vectors are extracted.
  - The AI model segments the unstructured document into 5 to 20 discrete operational clauses (Obligations, Definitions, Termination, Data Transfer, Liability, Incident Reporting).
  - Simultaneously, each clause is tagged and cross-linked to matching statutory authorities within the knowledge graph (e.g., `REG-GDPR-33`, `REG-BD-CSO-2025`, `REG-BB-DPS-2023`).

### 2. Zero-Hallucination Verbatim Verification Pipeline
- **Source Files**: `src/lib/citation-verifier.ts` & `src/lib/citation-extractor.ts`
- **Execution Mechanism**:
  - In legal and compliance domains, generative hallucination is strictly impermissible.
  - The verification engine extracts raw quotes produced by LLM pipelines and runs **Exact Substring Matching** against the immutable source document text. If even a single word is altered or hallucinated, the citation is flagged and corrected.
  - Extracted statutory citations (Section/Article numbers) are verified against the active official gazette corpus to determine whether the cited law is currently `In Force`, `Amended`, or `Repealed`.

### 3. Regulatory Blast Radius & Financial Exposure Simulator
- **Source Files**: `src/lib/simulate.functions.ts`
- **Execution Mechanism**:
  - When a government authority or regulatory agency proposes a new statutory requirement (e.g., "Data breach notification deadline shortened from 72 hours to 24 hours"), the user supplies or selects the draft rule.
  - The AI evaluates every clause in the organization's contract portfolio and determines:
    - Which contracts are directly in violation or non-compliant.
    - Risk severity score: `HIGH`, `MEDIUM`, or `LOW`.
    - Total aggregated portfolio dollar exposure (`$`).
    - `suggested_amendment`: A single, prescriptive remedial sentence ready to be executed as an addendum to eliminate the liability.

### 4. Recursive Upstream Supply Chain Cascade Engine
- **Source Files**: `src/lib/supply-chain.functions.ts`
- **Execution Mechanism**:
  - Enterprises rely not only on direct suppliers (Tier 1), but also on their suppliers' cloud hosting providers (Tier 2) and subprocessors or data centers (Tier 3).
  - When a statutory shock occurs, the engine traverses the supply chain topology graph recursively across up to 3 hops.
  - It identifies which downstream dependencies will breach statutory obligations and computes the cumulative indirect financial exposure (`indirect_exposure_usd`) borne by the primary enterprise.

### 5. Predictive Regulatory Radar & Adversarial What-If Formulator
- **Source Files**: `src/lib/predict.functions.ts`
- **Execution Mechanism**:
  - Ingests the historical amendment timeline of a specific regulatory framework to compute regulatory momentum (tightening vs. loosening vector).
  - Synthesizes prospective adversarial drafts reflecting plausible upcoming legislative revisions (including specific quantitative thresholds, shortened notification windows, and statutory penalties).
  - Allows compliance leadership to run proactive "What-If" stress tests months before prospective legislation is enacted into law.

### 6. Automated Legal Remediation Action Plan Generator
- **Source Files**: `src/lib/action-plan.functions.ts`
- **Execution Mechanism**:
  - Leverages the output of blast radius simulations to produce a structured, 3-tier remediation action plan:
    1. **Internal Policy Draft**: Ready-to-publish enterprise corporate policy clauses addressing the new statutory requirement.
    2. **Contract Amendments**: Contract-specific legal addendum language and rationale for counterparty negotiation.
    3. **Prioritized Technical Checklists**: Engineering and DevOps backlog tasks partitioned by urgency (`P0` Immediate, `P1` High, `P2` Routine).

### 7. Compliance-as-Code Synthesizer (Bridging Law to Cloud Infrastructure)
- **Source Files**: `src/lib/compliance-code.functions.ts`
- **Execution Mechanism**:
  - Bridges the communication and implementation gap between General Counsel and Cloud Engineering.
  - Based on the enterprise's deployed cloud architecture (AWS, Azure, GCP, Kubernetes), the AI synthesizes:
    - **Cloud Audit Scripts**: Python (`boto3`) or Bash automation scripts that programmatically scan cloud infrastructure for statutory gaps (e.g., verifying KMS encryption, IAM MFA enforcement, log retention windows).
    - **Infrastructure-as-Code (Terraform / YAML)**: Automated remediation templates that configure infrastructure to satisfy the legal mandate.

### 8. Historical Enforcement Backtesting Engine
- **Source Files**: `src/lib/backtest.functions.ts`
- **Execution Mechanism**:
  - Maintains an indexed repository of landmark historical regulatory enforcement actions and penalty decisions (e.g., Meta €1.2B GDPR cross-border transfer penalty, British Airways breach fine, Amazon GDPR fine).
  - The backtesting engine tests the organization's existing contracts against these precedent enforcement actions to evaluate whether current contractual safeguards would withstand similar regulatory scrutiny.

---

## 3. AI Gateway & Resilient Fallback Architecture (`src/lib/ai.server.ts`)

- **Primary Inference Providers**: OpenAI (`gpt-4o` & `gpt-4o-mini`) and Google Gemini API.
- **Ultra-Fast Edge Copilot**: Groq LPU inference engine powering the interactive Copilot and Inspect Lens with sub-200ms Time-To-First-Token (TTFT).
- **Graceful Deterministic Fallback**: In production environments where API keys are unavailable, network connectivity is disrupted, or quota limits are exceeded, ClauseGraph does not fail. The gateway seamlessly falls back to pre-computed semantic knowledge graph traversals and deterministic rule-based algorithms to guarantee uninterrupted enterprise uptime.
