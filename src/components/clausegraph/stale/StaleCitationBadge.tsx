// ============================================================================
// Stale Citation Badge: src/components/clausegraph/stale/StaleCitationBadge.tsx
// Visual status indicator respecting Obsidian & Mint / Risk Crimson design tokens.
// Clean, minimal badge focusing on statutory status without text noise.
// ============================================================================

import React from 'react';
import { AlertCircle, AlertTriangle, Info, Clock } from 'lucide-react';

export interface StaleCitationBadgeProps {
  severity: 'critical' | 'high' | 'medium' | 'low';
  stalenessType?: 'repealed' | 'substantive_amendment' | 'renumbered' | 'superseded' | 'cosmetic';
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StaleCitationBadge: React.FC<StaleCitationBadgeProps> = ({
  severity,
  stalenessType,
  className = '',
  size = 'md',
  showIcon = true,
}) => {
  const sizeClasses = {
    sm: 'text-[9.5px] px-2.5 py-1 min-h-[24px] gap-1.5 tracking-[0.14em]',
    md: 'text-[10.5px] px-3.5 py-1.5 min-h-[28px] gap-2 tracking-[0.16em]',
    lg: 'text-[12px] px-4 py-2 min-h-[34px] gap-2.5 tracking-[0.16em]',
  }[size];

  const iconSize = {
    sm: 11,
    md: 13,
    lg: 15,
  }[size];

  // Theme styling per severity
  const severityStyles = {
    critical: {
      bg: 'bg-[color-mix(in_oklab,var(--risk)_14%,transparent)] border-[rgba(225,82,75,0.4)] text-[var(--risk)] shadow-[0_0_12px_rgba(225,82,72,0.12)]',
      icon: <AlertCircle size={iconSize} className="text-[var(--risk)]" />,
    },
    high: {
      bg: 'bg-amber-500/10 border-amber-500/35 text-amber-400',
      icon: <AlertTriangle size={iconSize} className="text-amber-400" />,
    },
    medium: {
      bg: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
      icon: <Clock size={iconSize} className="text-yellow-400" />,
    },
    low: {
      bg: 'bg-[color-mix(in_oklab,var(--brass)_10%,transparent)] border-[var(--hairline-strong)] text-[var(--brass)]',
      icon: <Info size={iconSize} className="text-[var(--brass)]" />,
    },
  }[severity];

  const typeLabels: Record<string, string> = {
    repealed: 'Repealed',
    substantive_amendment: 'Amended',
    renumbered: 'Renumbered',
    superseded: 'Superseded',
    cosmetic: 'Cosmetic',
  };

  const label = (stalenessType && typeLabels[stalenessType]) || stalenessType || 'Stale';

  return (
    <span
      className={`inline-flex items-center font-mono uppercase font-semibold rounded-full border transition-all duration-200 ${severityStyles.bg} ${sizeClasses} ${className}`}
    >
      {showIcon && severityStyles.icon}
      <span>{label}</span>
    </span>
  );
};
