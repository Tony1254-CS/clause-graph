# ClauseGraph: Enterprise Compliance Notification & Alert Dispatch Center

> **Overview**: The ClauseGraph Notification Center acts as an autonomous, 24/7 watchdog for legal and corporate compliance teams. When new statutory gazettes are discovered, contract clauses violate repealed statutes, blast radius exposures exceed thresholds, or background OCR pipelines complete, notifications are immediately dispatched to the interactive TopBar Notification Bell (🔔), Global Glassmorphic Toast alerts, and external Slack Incident Webhook channels.

---

## 1. Key Capabilities of the Notification Center

| Capability | Technical Description | Enterprise Operational Impact |
|---|---|---|
| **🔔 TopBar Notification Bell** | Real-time unread badge counter (`3 new`) with animated pulse indicator and dropdown drawer. | Instant access to audit alerts from any page across the entire workspace. |
| **🚨 Multi-Category Filtering** | Tabs for `All`, `Critical` (high-risk violations & repealed laws), `Regulatory` (incoming gazettes), and `Pipeline` (contract extraction). | Eliminates alert fatigue, enabling counsel to prioritize existential statutory exposures. |
| **🎯 1-Click "Ask Copilot 🎯"** | Contextual AI action chip attached to every notification item. Clicking launches the Groq Copilot with full notification metadata preloaded. | Counsel receives immediate statutory analysis without manual prompt engineering. |
| **💬 Slack Incident Webhook** | Configurable incoming webhook integration (`https://hooks.slack.com/...`) with live test simulator. | Automatically routes critical compliance shocks into legal team Slack channels. |
| **🍞 Global Glassmorphic Toast** | Floating toast stack in the bottom-right corner for background jobs, webhook tests, and action plans. | Provides non-intrusive, immediate feedback during active workflows. |
| **💾 Persistent State Synchronization** | Hybrid `localStorage` and React Context state synchronization. | Preserves read/unread statuses and dismissed notifications across page reloads. |

---

## 2. Notification Typology & Severity Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Enterprise Notification Center                       │
├───────────────────────┬─────────────────────────────────────────────────┤
│ 1. Critical Violation │ 🔴 Repealed Law / High-Risk Exposure            │
│                       │    - e.g., Vendor MSA cites repealed DSA 2018   │
│                       │    - Financial Exposure: $450,000 USD           │
│                       │    - Actions: [Fix in Review Queue] [Ask AI 🎯] │
├───────────────────────┼─────────────────────────────────────────────────┤
│ 2. Regulatory Update  │ ⚖️ New Candidate Gazette Discovered             │
│                       │    - e.g., EUR-Lex DORA Art 30 Tightened        │
│                       │    - Actions: [Inspect Candidate Diff] [Ask AI] │
├───────────────────────┼─────────────────────────────────────────────────┤
│ 3. Pipeline Complete  │ ⚡ Contract Extraction / OCR Finished           │
│                       │    - e.g., 14 clauses extracted with 95% conf   │
│                       │    - Actions: [View Contract Clauses]           │
├───────────────────────┼─────────────────────────────────────────────────┤
│ 4. Lifecycle Schedule │ ⏳ 60-Day Annual Statutory Audit Milestone      │
│                       │    - e.g., Acme Analytics DPA audit milestone   │
│                       │    - Actions: [Inspect Schedule]                │
└───────────────────────┴─────────────────────────────────────────────────┘
```

---

## 3. Architecture & File Structure

1. **`src/lib/notifications.types.ts`**:
   - Defines strict TypeScript interfaces for `LegalNotification`, `ToastItem`, `WebhookConfig`, and `NotificationSeverity`.
2. **`src/lib/notifications.context.tsx`**:
   - Central React state provider handling unread counters, mark-as-read handlers, and the global toast dispatch pipeline.
3. **`src/components/clausegraph/NotificationBell.tsx`**:
   - Interactive TopBar bell trigger, badge counter, category filter tabs, and glassmorphic dropdown list with action chips.
4. **`src/components/clausegraph/NotificationChannelsModal.tsx`**:
   - Enterprise settings modal for configuring Slack webhook URLs, email digests, and triggering live simulated incident payloads.
5. **`src/components/clausegraph/ToastContainer.tsx`**:
   - Floating glassmorphic toast notification stack positioned at the bottom right with auto-dismiss timers and action triggers.
6. **`src/components/clausegraph/AppShell.tsx`**:
   - Mounts `NotificationProvider`, `ToastContainer`, and `NotificationChannelsModal` across all authenticated routes.

---

## 4. Live Video & Demonstrations

- **Screen Recording Walkthrough**:
  - `recordings/clausegraph_notification_center_demo.webm`
  - Specifications: 1080p, 60fps (~5.66 MB)
