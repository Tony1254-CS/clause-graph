import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useNotifications } from "@/lib/notifications.context";
import type { NotificationSeverity } from "@/lib/notifications.types";

export function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-5 right-5 z-[100001] flex max-h-[85vh] w-full max-w-sm sm:max-w-md flex-col gap-2.5 px-3 sm:px-0"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: {
    id: string;
    title: string;
    message?: string;
    severity?: NotificationSeverity;
    actionLabel?: string;
    onAction?: () => void;
  };
  onDismiss: () => void;
}) {
  const severity = toast.severity || "info";

  const config = {
    critical: {
      border: "border-rose-500/40",
      bg: "bg-rose-950/80",
      text: "text-rose-200",
      icon: <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />,
      glow: "shadow-[0_0_24px_rgba(244,63,94,0.3)]",
    },
    high: {
      border: "border-amber-500/40",
      bg: "bg-amber-950/80",
      text: "text-amber-200",
      icon: <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />,
      glow: "shadow-[0_0_24px_rgba(245,158,11,0.25)]",
    },
    medium: {
      border: "border-amber-500/30",
      bg: "bg-stone-900/90",
      text: "text-amber-300",
      icon: <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />,
      glow: "shadow-[0_0_20px_rgba(245,158,11,0.2)]",
    },
    low: {
      border: "border-[var(--hairline-strong)]",
      bg: "bg-[var(--surface-raised)]",
      text: "text-[var(--ink)]",
      icon: <Info className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />,
      glow: "shadow-lg",
    },
    info: {
      border: "border-emerald-500/30",
      bg: "bg-stone-900/90",
      text: "text-emerald-300",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />,
      glow: "shadow-[0_0_20px_rgba(16,185,129,0.2)]",
    },
  }[severity];

  return (
    <div
      className={`pointer-events-auto relative flex w-full items-start gap-3 rounded-xl border ${config.border} ${config.bg} p-3.5 backdrop-blur-xl ${config.glow} transition-all duration-300 animate-in slide-in-from-bottom-3 fade-in`}
    >
      {config.icon}

      <div className="flex-1 min-w-0 pr-1">
        <h4 className="text-xs font-semibold tracking-tight text-[var(--ink)]">
          {toast.title}
        </h4>
        {toast.message && (
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-muted)] line-clamp-2">
            {toast.message}
          </p>
        )}

        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onDismiss();
            }}
            className="mt-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--ink)] hover:bg-white/20 transition-colors"
          >
            {toast.actionLabel} &rarr;
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss toast"
        className="shrink-0 rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--ink)] hover:bg-white/10 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
