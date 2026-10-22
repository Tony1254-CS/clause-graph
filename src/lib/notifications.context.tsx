import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import type {
  LegalNotification,
  ToastItem,
  WebhookConfig,
  NotificationType,
  NotificationSeverity,
} from "./notifications.types";

const INITIAL_NOTIFICATIONS: LegalNotification[] = [
  {
    id: "notif-001",
    type: "critical_violation",
    severity: "critical",
    title: "Repealed Law Reference Detected",
    message: "Vendor agreement 'Cloud Infrastructure MSA' cites repealed Digital Security Act 2018. Immediate remediation required.",
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12 mins ago
    isRead: false,
    jurisdiction: "BD",
    actionUrl: "/review-queue",
    actionLabel: "Fix in Review Queue",
    targetEntityId: "REG-BD-CSA-2023",
    suggestedPrompt: "How does the repeal of Bangladesh Digital Security Act 2018 affect our Cloud Infrastructure MSA, and what is the exact amendment required?",
    metadata: {
      exposureUsd: 450000,
      affectedContractCount: 1,
      regulationTitle: "Cyber Security Act 2023 (Act 40 of 2023)",
    },
  },
  {
    id: "notif-002",
    type: "regulatory_update",
    severity: "high",
    title: "New Candidate Version Discovered",
    message: "EUR-Lex published update for DORA Article 30 (ICT Third-Party Subcontracting Rules). Candidate version awaiting review.",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    isRead: false,
    jurisdiction: "EU",
    actionUrl: "/legal-sources",
    actionLabel: "Inspect Candidate Diff",
    targetEntityId: "REG-DORA-30",
    suggestedPrompt: "Summarize the newly discovered candidate version for DORA Article 30 and its diff against our current baseline.",
    metadata: {
      regulationTitle: "Digital Operational Resilience Act (DORA)",
      amendmentDirection: "tightened",
    },
  },
  {
    id: "notif-003",
    type: "job_complete",
    severity: "info",
    title: "Contract Extraction Complete",
    message: "Autonomous AI segmentation completed for 'Vendor_Cloud_DPA.pdf'. 14 clauses extracted with 95% confidence.",
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    isRead: false,
    jurisdiction: "GLOBAL",
    actionUrl: "/contracts",
    actionLabel: "View Contract Clauses",
    suggestedPrompt: "Review the extracted clauses of Vendor_Cloud_DPA.pdf and summarize regulatory coverage.",
  },
  {
    id: "notif-004",
    type: "contract_lifecycle",
    severity: "medium",
    title: "Statutory Review Milestone (60 Days)",
    message: "Acme Analytics Data Processing Addendum reaches annual compliance audit milestone in 60 days.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
    isRead: true,
    jurisdiction: "US",
    actionUrl: "/contracts",
    actionLabel: "Inspect Schedule",
    suggestedPrompt: "What are the required annual audit deliverables under the Acme Analytics Data Processing Addendum?",
  },
];

const DEFAULT_WEBHOOK_CONFIG: WebhookConfig = {
  slackWebhookUrl: "",
  slackEnabled: false,
  emailDigestEnabled: true,
  emailRecipient: "compliance-team@clausegraph.internal",
  notifyOnCriticalOnly: true,
  notifyOnRegulatoryCandidates: true,
  notifyOnContractExtraction: false,
};

interface NotificationContextValue {
  notifications: LegalNotification[];
  unreadCount: number;
  criticalCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: string) => void;
  addNotification: (notif: Omit<LegalNotification, "id" | "timestamp" | "isRead">) => void;
  toasts: ToastItem[];
  showToast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: string) => void;
  webhookConfig: WebhookConfig;
  updateWebhookConfig: (config: Partial<WebhookConfig>) => void;
  isChannelsModalOpen: boolean;
  setIsChannelsModalOpen: (open: boolean) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const STORAGE_KEY_NOTIFS = "clausegraph_notifications_v1";
const STORAGE_KEY_CONFIG = "clausegraph_webhook_config_v1";

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<LegalNotification[]>(() => {
    if (typeof window === "undefined") return INITIAL_NOTIFICATIONS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_NOTIFS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return INITIAL_NOTIFICATIONS;
  });

  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>(() => {
    if (typeof window === "undefined") return DEFAULT_WEBHOOK_CONFIG;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return DEFAULT_WEBHOOK_CONFIG;
  });

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isChannelsModalOpen, setIsChannelsModalOpen] = useState(false);

  // Sync notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(notifications));
    } catch {
      // ignore
    }
  }, [notifications]);

  // Sync webhook config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(webhookConfig));
    } catch {
      // ignore
    }
  }, [webhookConfig]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const criticalCount = useMemo(
    () => notifications.filter((n) => !n.isRead && (n.severity === "critical" || n.severity === "high")).length,
    [notifications]
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toastInput: Omit<ToastItem, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newToast: ToastItem = { ...toastInput, id };
      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep maximum 5 toasts

      const duration = toastInput.durationMs ?? 4500;
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    },
    [dismissToast]
  );

  const addNotification = useCallback(
    (notif: Omit<LegalNotification, "id" | "timestamp" | "isRead">) => {
      const newNotif: LegalNotification = {
        ...notif,
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        isRead: false,
      };

      setNotifications((prev) => [newNotif, ...prev]);

      // Also trigger a global toast
      showToast({
        title: newNotif.title,
        message: newNotif.message,
        severity: newNotif.severity,
        actionLabel: newNotif.actionLabel,
        onAction: newNotif.actionUrl
          ? () => {
              if (typeof window !== "undefined") {
                window.location.href = newNotif.actionUrl!;
              }
            }
          : undefined,
      });
    },
    [showToast]
  );

  const updateWebhookConfig = useCallback((newConfig: Partial<WebhookConfig>) => {
    setWebhookConfig((prev) => ({ ...prev, ...newConfig }));
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      criticalCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      addNotification,
      toasts,
      showToast,
      dismissToast,
      webhookConfig,
      updateWebhookConfig,
      isChannelsModalOpen,
      setIsChannelsModalOpen,
    }),
    [
      notifications,
      unreadCount,
      criticalCount,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      addNotification,
      toasts,
      showToast,
      dismissToast,
      webhookConfig,
      updateWebhookConfig,
      isChannelsModalOpen,
      setIsChannelsModalOpen,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return ctx;
}
