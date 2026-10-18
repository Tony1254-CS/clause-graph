import React, { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  ExternalLink,
  Info,
} from 'lucide-react';
import type { StaleFindingsStats } from '../../../lib/stale/fetch.functions';
import { formatUSD } from '@/data/queries';

export interface StaleCitationWidgetProps {
  stats: StaleFindingsStats | null;
  isLoading?: boolean;
  onRunScan?: () => Promise<void>;
  className?: string;
}

export const StaleCitationWidget: React.FC<StaleCitationWidgetProps> = ({
  stats,
  isLoading = false,
  onRunScan,
  className = '',
}) => {
  const [scanning, setScanning] = useState(false);

  const handleScan = async () => {
    if (!onRunScan || scanning) return;
    setScanning(true);
    try {
      await onRunScan();
    } finally {
      setScanning(false);
    }
  };

  const totalFindings = stats?.total_findings || 0;
  const criticalCount = stats?.critical_count || 0;
  const highCount = stats?.high_count || 0;
  const mediumCount = stats?.medium_count || 0;
  const lowCount = stats?.low_count || 0;
  const totalExposure = stats?.total_exposure || 0;
  const lastScanAt = stats?.last_scan_at;

  return (
    <section
      className={`glass-panel p-6 sm:p-7 relative overflow-hidden transition-all duration-200 hover:border-[var(--hairline-strong)] ${className}`}
    >
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 pb-5 border-b border-[var(--hairline)]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--brass)] opacity-60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brass)]" />
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
              Temporal Audit · Stale Citations
            </span>
          </div>
          <h2 className="mt-2 font-display text-[22px] md:text-[24px] leading-[1.15] tracking-tight text-foreground">
            Temporal Legal Graph & Stale Citations
          </h2>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground max-w-[65ch]">
            Continuous detection of repealed acts, amended statutes, and renumbered provisions across your portfolio.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {onRunScan && (
            <button
              type="button"
              onClick={handleScan}
              disabled={scanning || isLoading}
              className="press inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground transition-all duration-200 ease-out hover:-translate-y-px hover:border-[var(--brass)] hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw size={13} className={scanning ? 'animate-spin text-[var(--brass)]' : ''} />
              <span>{scanning ? 'Scanning…' : 'Scan'}</span>
            </button>
          )}

          <Link
            to="/stale-citations"
            className="press inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-4 py-1.5 text-xs font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 ease-out hover:-translate-y-px hover:bg-[var(--brass-strong)]"
          >
            <span>View Dossier</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-5">
        {/* Critical */}
        <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-glass)] p-4 flex flex-col justify-between transition-all duration-200 hover:border-[rgba(225,82,75,0.4)]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--risk)]">
              Critical
            </span>
            <AlertCircle size={15} className="text-[var(--risk)]" />
          </div>
          <div className="mt-3 font-mono text-[26px] font-bold tracking-tight text-[var(--risk)]">
            {isLoading ? '—' : criticalCount}
          </div>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Repealed Laws
          </span>
        </div>

        {/* High */}
        <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-glass)] p-4 flex flex-col justify-between transition-all duration-200 hover:border-amber-500/40">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-400">
              High
            </span>
            <AlertTriangle size={15} className="text-amber-400" />
          </div>
          <div className="mt-3 font-mono text-[26px] font-bold tracking-tight text-amber-400">
            {isLoading ? '—' : highCount}
          </div>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Substantive Amends
          </span>
        </div>

        {/* Medium */}
        <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-glass)] p-4 flex flex-col justify-between transition-all duration-200 hover:border-yellow-500/40">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-yellow-300">
              Medium
            </span>
            <Clock size={15} className="text-yellow-400" />
          </div>
          <div className="mt-3 font-mono text-[26px] font-bold tracking-tight text-yellow-300">
            {isLoading ? '—' : mediumCount}
          </div>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Cosmetic / Recode
          </span>
        </div>

        {/* Low */}
        <div className="rounded-[14px] border border-[var(--hairline)] bg-[var(--surface-glass)] p-4 flex flex-col justify-between transition-all duration-200 hover:border-[var(--hairline-strong)]">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--brass)]">
              Low
            </span>
            <Info size={15} className="text-[var(--brass)]" />
          </div>
          <div className="mt-3 font-mono text-[26px] font-bold tracking-tight text-[var(--brass)]">
            {isLoading ? '—' : lowCount}
          </div>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Informational
          </span>
        </div>
      </div>

      {/* Footer Banner: Total Exposure & Last Scan */}
      <footer className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[var(--hairline)]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Contract Exposure Proxy:
          </span>
          <span className="font-mono text-[15px] font-bold text-amber-400">
            {formatUSD(totalExposure)}
          </span>
        </div>

        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {lastScanAt ? (
            <span>Last Scanned: {new Date(lastScanAt).toLocaleDateString()} {new Date(lastScanAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          ) : (
            <span>No scans performed yet</span>
          )}
        </div>
      </footer>
    </section>
  );
};

