# ClauseGraph Enterprise Architecture & Technical Documentation

Welcome to the **ClauseGraph Engineering & Compliance Architecture Documentation**. This repository details the complete technical specifications, mathematical models, AI inference pipelines, and autonomous surveillance architectures powering the ClauseGraph platform as of October 2026.

---

## 🗺️ Master Architecture Topology

```
+----------------------------------------------------------------------------------------------------+
|                                    CLAUSEGRAPH PLATFORM TOPOLOGY                                    |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ STATUTORY GAZETTES & FEEDS ]                                                                   |
|   ├── Bangladesh BG Press / ICT Division (Cyber Security Act 2023)                                 |
|   ├── European Union EUR-Lex (DORA Art 30, GDPR, AI Act)                                           |
|   └── US Federal Register / SEC (FinCEN, FTC Safeguards)                                          |
|            │                                                                                       |
|            ▼ (Autonomous Polling / Webhook Telemetry)                                              |
|  +─────────────────────────────────────────────────────────────+                                   |
|  |     Autonomous Statutory Update & Decision Engine           |                                   |
|  |  • Section Diff Engine • Candidate Branching • Blast Radius |                                   |
|  +─────────────────────────────────────────────────────────────+                                   |
|            │                                                                                       |
|            ├───► [ Enterprise Alert & Notification Center ] (Bell, Webhooks, Slack, Toasts)        |
|            │                                                                                       |
|            ▼ (Citation Graph Linking)                                                              |
|  +─────────────────────────────────────────────────────────────+                                   |
|  |     Regulatory-Contract Knowledge Topology (PostgreSQL 16)   |                                   |
|  |  • 9 Pre-seeded Commercial Contracts ($66.97M Valuation)    |                                   |
|  |  • 10 Monitored Statutory Frameworks (BD, EU, US, SG, UK)   |                                   |
|  +─────────────────────────────────────────────────────────────+                                   |
|            │                                                                                       |
|            ├───► [ Inspect Lens (🎯) ] -> Click any UI element to lock grounding context           |
|            │                                                                                       |
|            ├───► [ Groq LPU Copilot ] (openai/gpt-oss-120b, <200ms latency, Deontic Chain-of-Thought)|
|            │                                                                                       |
|            └───► [ Zero-Cost Natural Voice Intelligence ]                                          |
|                   ├── 45s Morning Briefing Podcast (Audio Card)                                    |
|                   ├── Notification Voice Narration (Listen / Reading...)                           |
|                   ├── Voice Copilot Dictation (Speech-to-Text Mic)                                 |
|                   └── Holographic Obsidian Waveform Player (Live Dancing Equalizer)                |
+----------------------------------------------------------------------------------------------------+
```

---

## 📚 Documentation Index

Below is the complete catalog of architectural specifications available in this directory:

### 1. [Autonomous Statutory Update & Decision Engine](./AUTONOMOUS_STATUTORY_UPDATE_AND_DECISION_ENGINE.md)
- In-depth breakdown of how legislation (e.g., Bangladesh Cyber Security Act 2023 repealing Digital Security Act 2018) is automatically detected without manual human entry.
- Candidate branch creation (`candidate` vs `enacted`).
- Deterministic Blast Radius propagation calculating financial exposure across all active contracts.
- Automated Slack / Webhook alert dispatch.

### 2. [Natural Neural Voice System & Voice Copilot Architecture](./NATURAL_VOICE_SYSTEM_ARCHITECTURE.md)
- Zero-cost architecture leveraging browser-bundled Microsoft Online Natural Neural Voices (`Aria Natural`, `Guy Natural`, `Bangla Natural`).
- Audio chunking engine preventing browser speech synthesis buffer timeouts.
- Legal text pre-sanitizer (expanding acronyms like DORA, GDPR, DPA, and converting currency strings like `$450,000 USD` into natural human speech).
- Headless / CI/CD fallback pacing timer.

### 3. [Groq LPU Copilot & Multi-Modal Inspect Lens (🎯)](./GROQ_COPILOT_AND_INSPECT_LENS.md)
- Ultra-low latency Copilot powered by Groq LPUs (`openai/gpt-oss-120b` and `llama-3.1-8b-instant`).
- Multi-modal Inspect Lens: Click the target icon (`🎯`) to point at any contract card, metric, or topology node to lock Copilot reasoning directly onto that entity's metadata.
- Structured thought steps and deontic legal logic (SHALL, MUST, SHALL NOT).

### 4. [Enterprise Notification & Alert System](./ENTERPRISE_NOTIFICATION_AND_ALERT_SYSTEM.md)
- Unified TopBar Bell dropdown with live unread badge counters.
- Severity triage: Critical (Red), Regulatory (Amber), Pipeline (Emerald).
- External dispatch integration: Slack Incoming Webhook configuration modal.
- Global Toast Alert provider for real-time statutory amendment announcements.

### 5. [Enterprise Onboarding & Statutory Deduction Engine](./ENTERPRISE_ONBOARDING_AND_STATUTORY_ENGINE.md)
- 3-step compliance onboarding wizard tailoring legal ontology to organization profile.
- Automated deduction of applicable jurisdictions based on business operational triggers (e.g., EU data processing $\to$ GDPR & DORA; Bangladesh operations $\to$ Cyber Security Act 2023).

### 6. [AI Features & Core Architecture](./AI_FEATURES_AND_ARCHITECTURE.md)
- Overview of all AI features: contract clause extraction, predictive compliance simulation, backtesting historical amendments, and review queue automation.

### 7. [Manual Input System Audit](./MANUAL_INPUT_SYSTEM_AUDIT.md)
- Audit of contract upload workflows, manual overrides, metadata corrections, and human-in-the-loop audit logs.

### 8. [Enterprise Shock Simulator, Redline Diff & Compliance Dossier Engine](./ENTERPRISE_SHOCK_REDLINE_AND_DOSSIER.md)
- **Live Statutory Shock Simulator**: Interactive scenario injector (Bangladesh CSA 2023, EU DORA Art 30, US SEC 24h Directive) with instant audio alert and exposure recalculation.
- **Autonomous Redline Diff & Contract Addendum Generator**: Visual side-by-side strikethrough/emerald diff, formal contract addendum generation with SHA-256 integrity hash, and 1-click merge.
- **Board-Ready Executive Compliance Dossier**: Zero-leakage client-side cryptographic PDF audit report generation using `jspdf` and dark executive styling.
- **Alexa+ for Legal Voice Agent**: Hands-free voice commands ("pause", "resume", "faster", "shock", "redline", "dossier") and speed/persona switching.

### 9. [Master Chronological Feature Inventory & Session Changelog](./ALL_IMPLEMENTED_FEATURES_CHRONOLOGY.md)
- Complete chronological record of all 18+ features engineered across all 6 phases in this development window.
- Covers Onboarding, Statutory Deduction, Groq LPU Copilot, Multi-Modal Inspect Lens (🎯), Notification Bell Center, Slack Webhooks, Zero-Cost Natural Voice System, Shock Simulator, Redline Diff, Board Dossier PDF, and Multimedia Broadcast Video Production.

---

## 🚀 Local Runbook & Environment Setup

### Prerequisites
- Node.js / Bun runtime
- Local PostgreSQL 16 instance running on `localhost:5432`

### Environment Variables (`.env.local`)
```ini
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/clausegraph"
GROQ_API_KEY="gsk_..."
VITE_APP_URL="http://localhost:5173"
```

### Running the System
```bash
# 1. Start local PostgreSQL
& "C:\Users\sakib\AppData\Local\Programs\pgsql\bin\postgres.exe" -D "C:\Users\sakib\AppData\Local\Programs\pgsql\data"

# 2. Start Vite Dev Server
bun run dev # Or npx vite
```

### Production Build Verification
```bash
bun run build
```
Client and SSR bundles build cleanly with zero compilation errors.
