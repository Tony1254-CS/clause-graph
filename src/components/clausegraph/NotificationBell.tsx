import React, { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  Sliders,
  ShieldAlert,
  Sparkles,
  FileCheck2,
  Clock,
  ExternalLink,
  Bot,
  Trash2,
  Check,
  AlertTriangle,
  Info,
  Volume2,
  Pause,
  GitCompare,
} from "lucide-react";
import { useNotifications } from "@/lib/notifications.context";
import { useCopilot } from "./CopilotContext";
import { useVoice } from "@/lib/voice.context";
import type { LegalNotification, NotificationType } from "@/lib/notifications.types";

export function NotificationBell() {
  const {
    notifications,
    unreadCount,
    criticalCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setIsChannelsModalOpen,
  } = useNotifications();

  const { openWithPrompt } = useCopilot();
  const { speak, isSpeakingId } = useVoice();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "critical" | "regulatory" | "pipeline">("all");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const handleListenNotification = (notif: LegalNotification) => {
    markAsRead(notif.id);
    const exposureText = notif.metadata?.exposureUsd
      ? `Direct financial exposure is ${notif.metadata.exposureUsd.toLocaleString()} dollars.`
      : "";
    const textToSpeak = `${notif.title}. ${notif.message}. ${exposureText}`;
    speak(textToSpeak, { id: notif.id });
  };

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (activeTab === "critical") {
        return item.severity === "critical" || item.severity === "high" || item.type === "critical_violation";
      }
      if (activeTab === "regulatory") {
        return item.type === "regulatory_update";
      }
      if (activeTab === "pipeline") {
        return item.type === "job_complete" || item.type === "contract_lifecycle";
      }
      return true;
    });
  }, [notifications, activeTab]);

  const handleAskCopilot = (notif: LegalNotification) => {
    setIsOpen(false);
    markAsRead(notif.id);
    const prompt =
      notif.suggestedPrompt ||
      `Explain the compliance impact of notification: "${notif.title}". How should our legal team remediate it?`;
    openWithPrompt(prompt);
  };

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const getNotificationIcon = (type: NotificationType, severity: string) => {
    if (severity === "critical" || type === "critical_violation") {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400">
          <ShieldAlert className="h-4 w-4" />
        </div>
      );
    }
    if (type === "regulatory_update") {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <Sparkles className="h-4 w-4" />
        </div>
      );
    }
    if (type === "job_complete") {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
          <FileCheck2 className="h-4 w-4" />
        </div>
      );
    }
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400">
        <Clock className="h-4 w-4" />
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button in TopBar */}
      <button
        type="button"
        id="notification-bell-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="View compliance notifications"
        aria-expanded={isOpen}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all ${
          isOpen
            ? "border-emerald-400 bg-emerald-500/15 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.3)]"
            : "border-[var(--hairline-strong)] bg-[var(--surface-glass)] text-[var(--ink)] hover:border-emerald-400/50 hover:bg-[var(--surface-glass-strong)] hover:text-emerald-400"
        }`}
      >
        <Bell className="h-4 w-4" />

        {/* Unread Badge Counter */}
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold tracking-tight text-white ${
              criticalCount > 0
                ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)] animate-pulse"
                : "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
            }`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-11 z-[999] w-[360px] sm:w-[420px] rounded-2xl border border-stone-700/80 bg-[#0c1017] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden text-[var(--ink)]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--hairline)] px-4 py-3 bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-xs tracking-tight">Compliance Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-emerald-400 hover:bg-white/5 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setIsChannelsModalOpen(true);
                }}
                title="Configure alert channels & webhooks"
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-[var(--ink)] hover:bg-white/5 transition-colors"
              >
                <Sliders className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 border-b border-[var(--hairline)] px-3 py-1.5 bg-black/20 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-white/10 text-[var(--ink)]"
                  : "text-[var(--text-muted)] hover:text-[var(--ink)]"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("critical")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition-colors ${
                activeTab === "critical"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                  : "text-[var(--text-muted)] hover:text-rose-400"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Critical
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("regulatory")}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition-colors ${
                activeTab === "regulatory"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  : "text-[var(--text-muted)] hover:text-amber-400"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Regulatory
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pipeline")}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                activeTab === "pipeline"
                  ? "bg-white/10 text-[var(--ink)]"
                  : "text-[var(--text-muted)] hover:text-[var(--ink)]"
              }`}
            >
              Pipeline
            </button>
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--hairline)]">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-[var(--text-muted)]">
                <Bell className="h-8 w-8 text-stone-600 mb-2 stroke-[1.5]" />
                <p className="font-medium text-[var(--ink)]">No notifications in this category</p>
                <p className="text-[11px] mt-0.5">All monitored statutory and contract feeds are clear.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`group relative flex items-start gap-3 p-3.5 transition-colors ${
                    !notif.isRead ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  {/* Icon */}
                  {getNotificationIcon(notif.type, notif.severity)}

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h4
                          className={`text-xs font-semibold truncate ${
                            !notif.isRead ? "text-[var(--ink)]" : "text-stone-400"
                          }`}
                        >
                          {notif.title}
                        </h4>
                        {notif.jurisdiction && (
                          <span className="shrink-0 rounded bg-white/10 px-1 py-0.2 text-[9px] font-mono text-[var(--text-muted)]">
                            {notif.jurisdiction}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-stone-500 shrink-0">
                        {formatRelativeTime(notif.timestamp)}
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-relaxed">
                      {notif.message}
                    </p>

                    {/* Metadata Pill */}
                    {notif.metadata?.exposureUsd && (
                      <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 text-[10px] font-mono text-rose-300">
                        Exposure: ${notif.metadata.exposureUsd.toLocaleString()} USD
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="mt-2.5 flex items-center gap-2 pt-0.5">
                      {notif.actionUrl && (
                        <Link
                          to={notif.actionUrl}
                          onClick={() => {
                            markAsRead(notif.id);
                            setIsOpen(false);
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--hairline-strong)] bg-white/5 px-2 py-1 text-[10px] font-medium text-[var(--ink)] hover:bg-white/15 transition-colors"
                        >
                          {notif.actionLabel || "Inspect"}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      )}

                      {/* Listen to Alert Voice Button */}
                      <button
                        type="button"
                        onClick={() => handleListenNotification(notif)}
                        title={isSpeakingId(notif.id) ? "Stop reading" : "Listen to notification voice narration"}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
                          isSpeakingId(notif.id)
                            ? "border-emerald-400 bg-emerald-500/25 text-emerald-300 animate-pulse"
                            : "border-[var(--hairline-strong)] bg-white/5 text-[var(--ink)] hover:bg-white/15 hover:text-emerald-300"
                        }`}
                      >
                        {isSpeakingId(notif.id) ? (
                          <>
                            <Pause className="h-2.5 w-2.5 fill-current" />
                            Reading...
                          </>
                        ) : (
                          <>
                            <Volume2 className="h-2.5 w-2.5 text-emerald-400" />
                            Listen
                          </>
                        )}
                      </button>

                      {/* Ask Copilot Button */}
                      <button
                        type="button"
                        onClick={() => handleAskCopilot(notif)}
                        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                      >
                        <Bot className="h-3 w-3" />
                        Ask Copilot 🎯
                      </button>

                      {/* Auto Redline Button for Critical Alerts */}
                      {(notif.severity === "critical" || notif.type === "critical_violation") && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            window.dispatchEvent(new CustomEvent("clausegraph:open_redline_modal"));
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-medium text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
                        >
                          <GitCompare className="h-3 w-3" />
                          Auto Redline
                        </button>
                      )}

                      {/* Right icons */}
                      <div className="ml-auto flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        {!notif.isRead && (
                          <button
                            type="button"
                            onClick={() => markAsRead(notif.id)}
                            title="Mark as read"
                            className="p-1 rounded text-stone-400 hover:text-emerald-400 transition-colors"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteNotification(notif.id)}
                          title="Dismiss notification"
                          className="p-1 rounded text-stone-500 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--hairline)] px-4 py-2.5 bg-black/30 flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Enterprise Statutory Watcher</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsChannelsModalOpen(true);
              }}
              className="text-emerald-400 hover:underline inline-flex items-center gap-1 text-[10px]"
            >
              Slack & Webhooks &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
