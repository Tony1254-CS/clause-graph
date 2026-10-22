# ClauseGraph: Enterprise Compliance Notification & Alert Dispatch Center

> **Overview**: লিগ্যাল ও কমপ্লায়েন্স টিমের জন্য একটি সার্বক্ষণিক ওয়াচডগ (Watchdog) হিসেবে কাজ করে ClauseGraph-এর নোটিফিকেশন সেন্টার। নতুন আইনি গেজেট আবিষ্কার, বাতিল আইনের কারণে কন্ট্রাক্ট ভায়োলেশন, ব্লাস্ট রেডিয়াস এক্সপোজার, এবং ব্যাকগ্রাউন্ড পাইপলাইনের ফলাফল তাৎক্ষণিকভাবে নোটিফিকেশন বেল (🔔), গ্লোবাল টোস্ট (Toast Alerts), এবং এক্সটারনাল স্ল্যাক (Slack Webhook) চ্যানেলে পৌঁছে দেয়।

---

## ১. নোটিফিকেশন সেন্টারের কোর ফিচারসমূহ (Key Capabilities)

| ফিচার | বিবরণ | ব্যবহারিক সুবিধা |
|---|---|---|
| **🔔 TopBar Notification Bell** | রিয়েল-টাইম আনরিড ব্যাজ কাউন্টার (`3 new`) ও পালসিং অ্যালার্ট ইন্ডিকেটর। | ড্যাশবোর্ড বা যেকোনো পেজ থেকে এক ক্লিকে সব নোটিফিকেশন দেখা যায়। |
| **🚨 ক্যাটাগরি ফিল্টারিং** | `All`, `Critical` (হাই রিস্ক ও বাতিল আইন), `Regulatory` (নতুন গেজেট), `Pipeline` (কন্ট্রাক্ট এক্সট্রাকশন)। | নয়েজ কমিয়ে জরুরি ভায়োলেশনে সরাসরি নজর দেওয়া যায়। |
| **🎯 এক-ক্লিকে "Ask Copilot 🎯"** | প্রতিটি নোটিফিকেশনে ডেডিকেটেড AI চিপ। ক্লিক করলেই কপাইলট ওপেন হয়ে সুনির্দিষ্ট নোটিফিকেশনের কনটেক্সট নিয়ে ব্যাখ্যা দেয়। | আইনজীবীকে নিজে বড় প্রম্পট টাইপ করতে হয় না। |
| **💬 Slack Incident Webhook** | ইনকামিং স্ল্যাক ওয়েবহুক (`https://hooks.slack.com/...`) ইন্টিগ্রেশন। | বড় রেগুলেটরি শকের অ্যালার্ট সরাসরি কোম্পানির লিগ্যাল স্ল্যাক চ্যানেলে পাঠানো যায়। |
| **🍞 Global Glassmorphic Toast** | ব্যাকগ্রাউন্ড ইভেন্ট, টেস্ট ওয়েবহুক, বা অ্যাকশন প্ল্যানের তাৎক্ষণিক কর্নার পপ-আপ। | ব্যবহারকারী কাজ করার সময় বিঘ্ন না ঘটিয়ে তাৎক্ষণিক ফিডব্যাক দেয়। |
| **💾 পারসিস্টেন্ট মেমোরি** | `localStorage` ও রিঅ্যাক্ট স্টেট সিঙ্ক। | পেজ রিলোড করলেও রিড/আনরিড স্ট্যাটাস সংরক্ষিত থাকে। |

---

## ২. নোটিফিকেশনের ধরন ও গুরুত্ব (Notification Typology)

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

## ৩. ফাইল ও আর্কিটেকচার স্ট্রাকচার

1. **`src/lib/notifications.types.ts`**:
   - `LegalNotification`, `ToastItem`, `WebhookConfig`, `NotificationSeverity` টাইপ ডেফিনিশন।
2. **`src/lib/notifications.context.tsx`**:
   - সেন্ট্রাল স্টেট প্রোভাইডার, আনরিড কাউন্টার, মার্ক-অ্যাজ-রিড হ্যান্ডলার, গ্লোবাল টোস্ট ডিসপ্যাচার।
3. **`src/components/clausegraph/NotificationBell.tsx`**:
   - টপবারের জন্য ইন্টারেক্টিভ বেল বাটন, আনরিড ব্যাজ, ফিল্টার ট্যাব, এবং গ্লাস-মরফিক ড্রপডাউন।
4. **`src/components/clausegraph/NotificationChannelsModal.tsx`**:
   - স্ল্যাক ওয়েবহুক ইউআরএল কনফিগারেশন, ইমেইল ডাইজেস্ট সেটিংস, এবং লাইভ `Test Webhook` সিমুলেটর।
5. **`src/components/clausegraph/ToastContainer.tsx`**:
   - নিচের ডান কোণে ফ্লোটিং গ্লাস-মরফিক টোস্ট স্ট্যাক (অটো-ডিসমিস ও অ্যাকশন বাটন সহ)।
6. **`src/components/clausegraph/AppShell.tsx`**:
   - অ্যাপের মূল শেলে `NotificationProvider`, `ToastContainer`, এবং `NotificationChannelsModal` মাউন্ট করা।

---

## ৪. লাইভ ভিডিও ও ডেমো

- **লাইভ স্ক্রিন রেকর্ডিং ভিডিও**:
  - `H:\Projects\clause-graph\recordings\clausegraph_notification_center_demo.webm`
  - সাইজ: ~5.66 MB (1080p, 60fps)
