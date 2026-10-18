# ClauseGraph — 3-Minute Demonstration Walkthrough Script
## Feature 16: Stale-Citation Detector & Temporal Legal Graph

**Presenter Target Duration:** 3 minutes (180 seconds)  
**Environment:** ClauseGraph Local or Staging Environment (`http://localhost:3000`)  
**Audience:** Chief Legal Officers, General Counsel, Head of Compliance, Enterprise Architects  

---

### Step 1: Portfolio Dashboard & Executive Situational Awareness (0:00 – 0:30)

1. **Navigate to:** `http://localhost:3000/dashboard`
2. **Point to:** The **Stale Citations Widget** located directly beneath the central Graph Medallion.
3. **Narration:**
   > *"Welcome to ClauseGraph. On our main executive dashboard, right beneath the portfolio Graph Medallion, you'll notice our new Stale Citations Detection Widget. In real-time, the engine audits every active contract across the enterprise against our temporal legal ontology. We can immediately see 4 Critical findings, 1 High finding, and an aggregate financial exposure proxy of $1.75M stemming from outdated legal covenants."*
4. **Action:** Click the button **"Review All Citations →"** on the widget.

---

### Step 2: Findings Page & Severity Filtering (0:30 – 1:00)

1. **URL:** `/stale-citations`
2. **Narration:**
   > *"This takes us to the dedicated Stale Citations console. Here, every detected citation is cataloged with its contract source, counterparty, extraction confidence, and staleness classification. We can toggle between All, Critical, High, Medium, and Low severity filters."*
3. **Action:** Click on the **"Critical (4)"** filter tab. Point to the top card:
   - **Original Citation:** `Section 57 of the Digital Security Act 2018`
   - **Contract:** `FinTech Payment Gateway Master Services Agreement`
   - **Classification:** `Repealed Regulation` (Crimson `#E15248` badge)
4. **Narration:**
   > *"Notice this critical finding: Section 57 of the Digital Security Act 2018. This statute was repealed by the Bangladesh Parliament in October 2023. Yet this agreement is still conditioning cyber security obligations on a repealed criminal enactment."*

---

### Step 3: Deep Evidence Dossier & Primary Legal Provenance (1:00 – 1:45)

1. **Action:** Click on the finding card to slide open the **EvidenceDrawer**.
2. **Point to sections in order:**
   - **Flagged Citation & Clause Context:** Shows exact contract clause text.
   - **Legal Staleness Determination:** Detailed statutory reasoning.
   - **Official Statutory Provenance:** Official gazette date (`8 October 2018`), repeal date (`1 October 2023`), and live link to Bangladesh Ministry of Law portal (`bdlaws.minlaw.gov.bd`).
   - **Version Lineage & Caution on Provision Equivalence:** Highlights that while common commentary maps Section 57 to CSA Section 28, the statutory offenses and procedural rights differ.
   - **Remediation Proposal:** Suggested replacement citation and redline clause language.
3. **Narration:**
   > *"Inside the Evidence Dossier, ClauseGraph never asks legal counsel to take AI output on faith. We ground every finding in verifiable primary law: the official Gazette reference, statutory effective windows, and primary government portal links. The drawer even provides an explicit legal caution highlighting that the Section 57-to-Section 28 mapping is not legally equivalent, preventing inadvertent liability."*
4. **Action:** Click **"Acknowledge"** or **"Mark Remediated"** to demonstrate state change.

---

### Step 4: Reproducible Ground-Truth Backtest (1:45 – 2:15)

1. **Action:** Scroll to the top right of the findings page and click **"Run Backtest (DSA 2018)"** or run `runDsaBacktest()`.
2. **Display Result Modal / Metrics:**
   - Total Clauses: `6`
   - Passed: `6` (100%)
   - True Positives: `4`
   - True Negatives: `2` (including historical contract evaluated as of May 2020)
   - Precision: `1.0000` (100%)
   - Recall: `1.0000` (100%)
   - F1 Score: `1.0000` (100%)
3. **Narration:**
   > *"To prove scientific rigor, we run our ground-truth validation suite against 6 real-world commercial contracts. The engine correctly flags modern citations to repealed sections, correctly handles Bengali language text (ডিজিটাল নিরাপত্তা আইন ২০১৮), and crucially: when evaluating a contract historically as of May 2020, it recognizes the law was active at the time of execution and avoids a false positive. We achieve 100% precision and 100% recall."*

---

### Step 5: Blast Radius & Remediation Downstream Workflow (2:15 – 3:00)

1. **Navigate to:** `/simulate`
2. **Action:** Enter a regulatory scenario or trigger an impact simulation.
3. **Point to:** The simulation engine integrating the open stale citation findings into the contract risk calculation.
4. **Navigate to:** `/actions`
5. **Action:** Show the Action Plan where critical stale findings have been automatically ingested as **P0 remediation items** with reviewable clause amendment drafts.
6. **Closing Statement:**
   > *"Finally, ClauseGraph closes the loop. These findings don't sit in a silo. They feed directly into our Blast Radius simulation and populate prioritized P0 remediation tasks in the Compliance Action Plan. With ClauseGraph, enterprise legal teams transform dormant regulatory risk into verifiable, executable compliance."*
