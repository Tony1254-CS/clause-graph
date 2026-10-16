import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Scale,
  Binary,
  Database,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from "lucide-react";

export type ProvenanceKind =
  "source_text" | "ai_interpretation" | "heuristic" | "synthetic" | "human_approved" | "unverified";

type Config = {
  label: string;
  tooltip: string;
  className: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PROVENANCE_CONFIG: Record<ProvenanceKind, Config> = {
  source_text: {
    label: "Official Source",
    tooltip: "Authoritative text retrieved from an official statutory or regulatory source.",
    className:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20",
    icon: Scale,
  },
  ai_interpretation: {
    label: "AI Interpretation",
    tooltip:
      "AI-generated draft assessment. Does not constitute legal advice and requires human verification.",
    className:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25 hover:bg-amber-500/20",
    icon: Sparkles,
  },
  heuristic: {
    label: "Deterministic Heuristic",
    tooltip: "Computed deterministically via statutory graph rules and BFS algorithms.",
    className: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25 hover:bg-sky-500/20",
    icon: Binary,
  },
  synthetic: {
    label: "Synthetic Demo Data",
    tooltip: "Reconstructed scenario with fictional counterparties for evaluation testing.",
    className:
      "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/25 hover:bg-purple-500/20",
    icon: Database,
  },
  human_approved: {
    label: "Counsel Approved",
    tooltip: "Verified and signed off by authorized compliance officer or legal counsel.",
    className:
      "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/25 hover:bg-teal-500/20",
    icon: CheckCircle2,
  },
  unverified: {
    label: "Unverified / Disputed",
    tooltip: "Status pending gazette publication or secondary source verification.",
    className:
      "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25 hover:bg-rose-500/20",
    icon: AlertTriangle,
  },
};

export type ProvenanceBadgeProps = {
  kind: ProvenanceKind;
  customLabel?: string;
  size?: "sm" | "md";
  className?: string;
  showIcon?: boolean;
};

export function ProvenanceBadge({
  kind,
  customLabel,
  size = "sm",
  className = "",
  showIcon = true,
}: ProvenanceBadgeProps) {
  const config = PROVENANCE_CONFIG[kind] ?? {
    label: kind,
    tooltip: "",
    className: "bg-muted text-muted-foreground",
    icon: FileText,
  };

  const Icon = config.icon;
  const isSm = size === "sm";

  return (
    <Badge
      variant="outline"
      title={config.tooltip}
      className={`inline-flex items-center gap-1 font-mono font-medium tracking-wide transition-colors ${
        isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${config.className} ${className}`}
    >
      {showIcon && <Icon className={isSm ? "h-2.5 w-2.5 shrink-0" : "h-3.5 w-3.5 shrink-0"} />}
      <span>{customLabel || config.label}</span>
    </Badge>
  );
}
