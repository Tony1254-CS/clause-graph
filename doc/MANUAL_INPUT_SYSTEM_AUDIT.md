# ClauseGraph: Manual Input Capabilities & System-Wide Audit

> [!IMPORTANT]
> This document provides a comprehensive, production-grade audit answering the critical operational question: **"Can users manually provide input across every module of the system?"**
> Below is the complete audit of input capabilities across all platform modules, detailing what is 100% manually configurable, supported input types, and future enhancement paths.

---

## 1. Executive Summary

| Module / Platform Feature | Current Status | Manual Input Capabilities Supported |
| :--- | :--- | :--- |
| **1. Onboarding Wizard** | ✅ **100% Manual** | Organization name, incorporation country, public listing toggle, industry vertical, 5 operational data footprint toggles, and cloud provider selector. |
| **2. Compliance Scope Settings** | ✅ **100% Manual** | Modify any profile parameter, inspect live statutory recalculation, and persist directly to PostgreSQL. |
| **3. Contract Ingestion (`/contracts`)** | ✅ **100% Manual** | Upload any production contract PDF, input counterparty name, and assign contract dollar valuation ($). |
| **4. What-If & Blast Radius (`/simulate`)** | ✅ **100% Manual** | Type or paste any prospective statutory draft, circular, or legislative amendment into a free-form textarea to execute instant shock simulations. |
| **5. Review Queue (`/review-queue`)** | ✅ **100% Manual** | Approve clauses, reject false detections, edit/correct clause text inline, record internal audit notes, and assign colleagues for review. |
| **6. Action Plans (`/actions`)** | ✅ **100% Manual** | Generate structured remediation roadmaps and toggle tasks as completed via interactive checkboxes. |
| **7. Team Management (`/settings/team`)** | ✅ **100% Manual** | Invite colleagues via email input and manually assign organizational access roles (`Admin` vs. `Member`). |
| **8. Account Security (`/settings/account`)** | ✅ **100% Manual** | Update display name and enter new account passwords (securely hashed via Bcrypt with salt). |
| **9. Regulatory Feed (`/feed`)** | ⚡ **Semi-Automated** | Search, filter, and inspect full statutory texts. Direct custom regulation ingestion modal is optional. |
| **10. Supply Chain Graph** | ⚡ **Automatically Derived** | Topologies are programmatically derived from ingested contracts and cloud footprints. Manual supplier node creator is optional. |

---

## 2. Detailed Module Breakdown

### 1. Enterprise Onboarding & Workspace Initialization
* **Route**: `/dashboard` (Automated modal on cold-start workspaces)
* **Input Mechanisms**: Form text inputs, select dropdowns, switch toggles, multi-select cloud provider chips.
* **Capabilities**:
  - Input the verified legal entity name (e.g., enterprise clients across Fintech, Healthtech, Manufacturing, SaaS).
  - Select incorporation jurisdiction and market vertical.
  - Configure 5 distinct operational footprint switches to activate precise statutory scopes.
* **Operational Outcome**: Eliminates synthetic sample contracts; initializes a clean, customized enterprise workspace.

---

### 2. Compliance Scope Settings
* **Route**: `/settings/compliance-profile`
* **Input Mechanisms**: Real-time settings form with instant feedback.
* **Capabilities**:
  - Update organizational domicile, cloud providers, or data processing toggles at any stage in the company lifecycle.
  - Real-time recalculation of the **Active Legal Frameworks (Live Mapping)** panel on the right upon toggle change.
  - Clicking `Save Changes` commits updates atomically to PostgreSQL.

---

### 3. Contract Portfolio & PDF Ingestion
* **Route**: `/contracts`
* **Input Mechanisms**: Drag-and-drop file uploader, native file selector, text inputs, currency fields.
* **Capabilities**:
  - Upload authentic client agreements, vendor DPAs, MSAs, or SLAs in PDF format.
  - Manually input the counterparty name (`Counterparty Name`) and contract dollar value (`Contract Value $`).
  - The extraction pipeline parses clauses and automatically maps them to governing statutory articles.

---

### 4. What-If & Adversarial Simulation Engine
* **Route**: `/simulate`
* **Input Mechanisms**: Multi-line free-form textarea, tab selectors, scenario preset buttons.
* **Capabilities**:
  - Legal teams can **type or paste any proposed statutory draft, government circular, or hypothetical regulatory rule** directly into the interface.
  - The engine analyzes the portfolio against the input text, calculating the financial blast radius ($ exposure) and classifying affected clauses by risk severity (`HIGH`, `MEDIUM`, `LOW`).
  - Includes quick-load preset buttons for testing common international regulatory shocks.

---

### 5. Human-in-the-Loop Review Queue
* **Route**: `/review-queue`
* **Input Mechanisms**: Interactive review cards, inline text editors, form input fields, action buttons.
* **Capabilities**:
  - Counsel reviews every extracted operational clause with full human oversight.
  - **Approve**: Confirms the clause extraction and statutory linking as valid.
  - **Reject**: Dismisses incorrect or irrelevant detections.
  - **Correct / Edit**: Allows manual inline editing of extracted clause text and citations before final sign-off.
  - **Review Notes**: Add manual internal audit remarks and justification records.
  - **Assign Reviewer**: Allocate review tasks to specific team members.

---

### 6. Remediation Action Plans
* **Route**: `/actions`
* **Input Mechanisms**: Interactive action tracking cards and task completion checkboxes.
* **Capabilities**:
  - Synthesizes automated technical and legal remediation plans in response to statutory vulnerabilities.
  - Team members manually mark checklist items as "Completed" upon resolving contractual or infrastructure gaps.

---

### 7. Team Collaboration & Access Control
* **Route**: `/settings/team`
* **Input Mechanisms**: Email address input field and role selection dropdown.
* **Capabilities**:
  - Dispatch enterprise invitations by entering colleague email addresses.
  - Manually configure permission tiers (`Admin` vs. `Member`).
  - Remove departed team members from the organization workspace.

---

### 8. Account Security & Credentials
* **Route**: `/settings/account`
* **Input Mechanisms**: Profile display text field and secure password inputs.
* **Capabilities**:
  - Update user display name and profile identifiers.
  - Manually enter and confirm new account passwords (persisted with secure Bcrypt hashing).

---

## 3. Potential Future Enhancements

While all core operational workflows currently support direct manual inputs, two optional enhancements can be considered for future feature roadmaps:

1. **Custom Regulation Creator (`/feed`)**:
   - *Current State*: The platform indexes 10 major international and domestic frameworks alongside live Federal Register updates.
   - *Enhancement Path*: An optional `Add Custom Regulation` modal enabling legal teams to manually input proprietary industry standards, local municipal guidelines, or internal compliance covenants.

2. **Supply Chain Manual Node Builder (`/simulate?tab=supply-chain`)**:
   - *Current State*: Multi-tier supply chain dependency trees are programmatically derived from ingested contracts and cloud architecture profiles.
   - *Enhancement Path*: An optional `Add Supplier Node` form enabling counsel to manually inject uncontracted Tier-2 and Tier-3 vendors directly into the topology graph.
