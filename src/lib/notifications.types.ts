/**
 * Enterprise Notification & Alert System — Types & Models
 *
 * Designed for ClauseGraph Legal Intelligence:
 * - Regulatory Gazette updates & Candidate Version arrivals
 * - Critical contract violations & Blast Radius warnings
 * - Contract pipeline (OCR, Extraction, Citation verification)
 * - Expiration and renewal milestones
 * - Webhook / Slack / Email dispatch integration
 */

export type NotificationType =
  | "critical_violation"
  | "regulatory_update"
  | "contract_lifecycle"
  | "job_complete"
  | "system_alert";

export type NotificationSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface LegalNotification {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  timestamp: string; // ISO string
  isRead: boolean;
  jurisdiction?: "BD" | "EU" | "US" | "GLOBAL";
  actionUrl?: string;
  actionLabel?: string;
  targetEntityId?: string; // e.g. contractId or regulationId
  suggestedPrompt?: string; // Preloaded prompt for AI Copilot
  metadata?: {
    exposureUsd?: number;
    affectedContractCount?: number;
    regulationTitle?: string;
    amendmentDirection?: string;
  };
}

export interface ToastItem {
  id: string;
  title: string;
  message?: string;
  severity?: NotificationSeverity;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

export interface WebhookConfig {
  slackWebhookUrl: string;
  slackEnabled: boolean;
  emailDigestEnabled: boolean;
  emailRecipient: string;
  notifyOnCriticalOnly: boolean;
  notifyOnRegulatoryCandidates: boolean;
  notifyOnContractExtraction: boolean;
}
