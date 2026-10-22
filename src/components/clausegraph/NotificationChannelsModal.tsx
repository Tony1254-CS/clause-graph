import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  Mail,
  Send,
  ShieldAlert,
  Sparkles,
  Check,
  X,
  ExternalLink,
  MessageSquare,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { useNotifications } from "@/lib/notifications.context";

export function NotificationChannelsModal() {
  const {
    isChannelsModalOpen,
    setIsChannelsModalOpen,
    webhookConfig,
    updateWebhookConfig,
    showToast,
  } = useNotifications();

  const [slackUrl, setSlackUrl] = useState(webhookConfig.slackWebhookUrl);
  const [slackEnabled, setSlackEnabled] = useState(webhookConfig.slackEnabled);
  const [emailDigest, setEmailDigest] = useState(webhookConfig.emailDigestEnabled);
  const [emailRecipient, setEmailRecipient] = useState(webhookConfig.emailRecipient);
  const [criticalOnly, setCriticalOnly] = useState(webhookConfig.notifyOnCriticalOnly);
  const [notifyCandidates, setNotifyCandidates] = useState(webhookConfig.notifyOnRegulatoryCandidates);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isChannelsModalOpen) return null;

  const handleSave = () => {
    updateWebhookConfig({
      slackWebhookUrl: slackUrl,
      slackEnabled,
      emailDigestEnabled: emailDigest,
      emailRecipient,
      notifyOnCriticalOnly: criticalOnly,
      notifyOnRegulatoryCandidates: notifyCandidates,
    });
    setSaveSuccess(true);
    showToast({
      title: "Notification Settings Saved",
      message: "External dispatch preferences and webhook endpoints updated.",
      severity: "info",
    });
    setTimeout(() => {
      setSaveSuccess(false);
      setIsChannelsModalOpen(false);
    }, 600);
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    // Simulate real webhook ping
    await new Promise((r) => setTimeout(r, 800));
    setIsSendingTest(false);

    showToast({
      title: "Test Alert Dispatched",
      message: slackUrl.trim()
        ? `Simulated Slack alert dispatched to webhook: ${slackUrl.substring(0, 32)}...`
        : "Simulated enterprise compliance alert dispatched to in-app stream.",
      severity: "high",
    });
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-[var(--hairline-strong)] bg-[var(--surface-raised)] p-6 shadow-2xl backdrop-blur-2xl text-[var(--ink)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">
                Alert Channels & Dispatch
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Connect Slack webhooks, email digests, and incident triggers
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsChannelsModalOpen(false)}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--ink)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="mt-5 space-y-5 text-xs">
          {/* Slack Webhook Section */}
          <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-glass)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold text-sm">Slack Incident Channel</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={slackEnabled}
                  onChange={(e) => setSlackEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                Incoming Webhook URL
              </label>
              <input
                type="url"
                value={slackUrl}
                onChange={(e) => setSlackUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
                className="w-full rounded-lg border border-[var(--hairline-strong)] bg-stone-900/60 px-3 py-2 text-xs font-mono text-[var(--ink)] placeholder:text-stone-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-[var(--text-muted)]">
                Dispatches high-severity regulatory shocks & blast radius alerts
              </span>
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isSendingTest}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              >
                <Send className="h-3 w-3" />
                {isSendingTest ? "Sending..." : "Test Webhook"}
              </button>
            </div>
          </div>

          {/* Email Digest Section */}
          <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-glass)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-sky-400" />
                <span className="font-semibold text-sm">Compliance Email Alerts</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailDigest}
                  onChange={(e) => setEmailDigest(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-stone-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
              </label>
            </div>

            <div>
              <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                Recipient Email Address
              </label>
              <input
                type="email"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                placeholder="general-counsel@company.com"
                className="w-full rounded-lg border border-[var(--hairline-strong)] bg-stone-900/60 px-3 py-2 text-xs text-[var(--ink)] placeholder:text-stone-600 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Alert Threshold Filters */}
          <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-glass)] p-4 space-y-2.5">
            <h4 className="font-semibold text-xs text-[var(--ink)]">Notification Triggers</h4>
            
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={criticalOnly}
                onChange={(e) => setCriticalOnly(e.target.checked)}
                className="rounded border-[var(--hairline-strong)] bg-stone-900 text-emerald-500 focus:ring-0"
              />
              <span className="text-xs text-[var(--ink)]">
                Notify immediately on <strong>Critical Violations & Repealed Acts</strong>
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyCandidates}
                onChange={(e) => setNotifyCandidates(e.target.checked)}
                className="rounded border-[var(--hairline-strong)] bg-stone-900 text-emerald-500 focus:ring-0"
              />
              <span className="text-xs text-[var(--ink)]">
                Notify when new <strong>Regulatory Candidate Gazettes</strong> are discovered
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--hairline)] pt-4">
          <button
            type="button"
            onClick={() => setIsChannelsModalOpen(false)}
            className="rounded-xl border border-[var(--hairline)] px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--ink)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2 text-xs font-semibold text-stone-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved!
              </>
            ) : (
              "Save Preferences"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
