# Enterprise Shock Simulator, Redline Diff & Compliance Dossier Engine

**Author**: ClauseGraph Core Architecture Group  
**Status**: Production Ready (October 2026)  
**Modules**:  
- `src/components/clausegraph/LiveShockSimulatorModal.tsx`
- `src/components/clausegraph/RedlineDiffModal.tsx`
- `src/lib/pdf-dossier.ts`
- `src/lib/voice.context.tsx`

---

## 1. ⚡ Live Statutory Shock Simulator (Interactive Scenario Injector)

### Purpose
Allows executives and compliance directors to simulate real-time overnight legislative disruptions and witness instant automated remediation cascades without modifying live production databases.

### Preset Scenarios
1. **Bangladesh Cyber Security Act 2023 — Section 8 Cloud Sovereignty Order**
   - **Statutory Instrument**: B.G. Press S.R.O. No. 248-Law/2023 (Act No. 38 of 2023)
   - **Exposure Delta**: `+$450,000 USD` (3 vendor contracts violated due to citing repealed DSA 2018 or lacking mirrored data residency)
   - **Voice Narration**: Spoken alert via Microsoft Aria Neural with natural phonetics
2. **European Union DORA Article 30 — ICT Subcontracting Restrictions (Candidate)**
   - **Statutory Instrument**: EUR-Lex COM(2022) 540 final (Regulation (EU) 2022/2554)
   - **Exposure Delta**: `+$180,000 USD` (2 subcontracting agreements missing supervisory audit exit clauses)
3. **United States SEC 24-Hour Material Incident Disclosure Directive**
   - **Statutory Instrument**: SEC Release Nos. 33-11216; 34-97989 (17 CFR Part 229)
   - **Exposure Delta**: `+$320,000 USD` (4 master vendor agreements specifying 72-hour notification windows)

### Real-Time Event Cascade
```
User clicks "Execute Live Shock"
  │
  ├──► Dispatches window CustomEvent("clausegraph:regulatory_shock", { detail: scenario })
  ├──► Triggers high-impact Sonner Toast alert with exposure delta badge
  └──► Activates Natural Voice Narration through useVoice() context
```

---

## 2. 📝 Autonomous Redline Diff & Contract Addendum Generator

### Purpose
When a regulatory gazette repeals or updates a legal statute, affected contracts must be amended. ClauseGraph eliminates days of manual drafting by generating instant side-by-side visual diffs and formal contract addenda.

### Key Capabilities
- **Visual Strikethrough & Highlight Diff**:
  - Repealed language marked with red strikethrough (`14.2 Compliance with Laws... Digital Security Act 2018 (Act No. 46 of 2018)...`).
  - Proposed compliant text highlighted in emerald (`14.2 Compliance with Laws & Cloud Sovereignty... Cyber Security Act 2023 (Act No. 38 of 2023)... Section 8 CII residency...`).
- **Statutory Alignment Rationale**: Full legal reasoning explaining why the clause fails audit and quoting applicable statutory penalties.
- **1-Click Actions**:
  - `Copy Clause`: Instant clipboard copy of the sanitized compliant clause.
  - `Download Addendum`: Generates and downloads a formal `.txt` Contract Addendum complete with SHA-256 cryptographic attestation, execution signature blocks, and governing law citations.
  - `Approve & Merge Addendum`: Simulated instant merger into the portfolio with automated audit logging and toast confirmation.

---

## 3. 📊 Board-Ready Executive Dossier & Cryptographic PDF Report

### Purpose
Generates formal compliance dossiers formatted for Board of Directors and Supervisory Committee review in 1 click, without server roundtrips or third-party data leakage.

### Architecture (`src/lib/pdf-dossier.ts`)
- **Engine**: Client-side execution via `jspdf` and `jspdf-autotable`.
- **Zero Data Leakage**: Generated entirely inside the user's browser runtime; contract texts and financial figures never leave the client.
- **Cryptographic Attestation**:
  - Unique Report ID (`CG-AUDIT-...`).
  - SHA-256 integrity hash guaranteeing non-tampering of the generated findings.
- **Visual Styling**:
  - Obsidian dark theme headers (`rgb(15, 23, 42)` and brass accents `rgb(245, 158, 11)`).
  - Executive KPI summary metric tiles (Portfolio Value, Monitored Agreements, Open Regulatory Exposure, Compliance Health Score).
  - Multi-jurisdictional statutory coverage matrix (Bangladesh CSA 2023, EU DORA Art 30, EU GDPR Art 28, US SEC Cyber Rules).
  - Formal signature and legal disclaimer footer.

---

## 4. 🗣️ "Alexa+ for Legal" Hands-Free Voice Agent & Command Engine

### Purpose
Enables executives to navigate, triage, and control the entire compliance suite through natural voice commands or interactive playback controls.

### Voice Command Routing
Integrated into `useVoice()` and `GlobalCopilot`:
| Voice Phrase | Action Triggered |
|---|---|
| *"pause"* / *"stop"* / *"shush"* | Pauses/stops active audio narration |
| *"resume"* / *"continue"* | Resumes paused audio narration |
| *"faster"* / *"speed up"* | Increases playback rate (`1x` $\to$ `1.25x` $\to$ `1.5x`) |
| *"slower"* / *"slow down"* | Sets playback rate to normal (`1x`) |
| *"shock"* / *"simulate shock"* | Opens Live Statutory Shock Simulator modal |
| *"redline"* / *"contract addendum"* | Opens Visual Redline Diff & Addendum modal |
| *"dossier"* / *"export pdf"* | Generates cryptographic Board Dossier PDF |
| *"briefing"* / *"morning briefing"* | Starts 45s Executive Compliance Morning Briefing |

### UI Equalizer Controls
- **Speed Toggle Pill**: Cycle between `1x`, `1.25x`, and `1.5x` dynamically without interrupting audio.
- **Persona Pill**: Switch between Microsoft Natural Neural personas (`Aria Natural`, `Guy Natural`, `Bangla Natural`).
- **Audio Waveform**: Real-time CSS-animated 5-bar dancing equalizer synced with audio playback state.
