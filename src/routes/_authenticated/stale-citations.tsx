// ============================================================================
// Stale Citations Route: src/routes/_authenticated/stale-citations.tsx
// Clean, minimal temporal audit dossier following ClauseGraph's luxury design system.
// Free of excessive text, clutter, and verbose severity labels.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  FlaskConical,
  CheckCircle2,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/clausegraph/AppShell';
import { StaleCitationBadge } from '@/components/clausegraph/stale/StaleCitationBadge';
import { EvidenceDrawer } from '@/components/clausegraph/stale/EvidenceDrawer';
import {
  fetchStaleFindings,
  updateFindingStatus,
  type StaleFindingItem,
  type StaleFindingsStats,
} from '@/lib/stale/fetch.functions';
import { runStaleScan } from '@/lib/stale/scan.functions';
import { runDsaBacktest, type DsaBacktestResult } from '@/lib/stale/backtest.functions';
import { formatUSD } from '@/data/queries';

export const Route = createFileRoute("/_authenticated/stale-citations")({
  head: () => ({
    meta: [
      { title: "Stale Citations — ClauseGraph" },
      {
        name: "description",
        content: "Continuous temporal audit of contract citations against statutory lifecycles.",
      },
      { property: "og:title", content: "Stale Citations — ClauseGraph" },
    ],
  }),
  component: StaleCitationsPage,
});

function StaleCitationsPage() {
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [backtesting, setBacktesting] = useState(false);
  const [stats, setStats] = useState<StaleFindingsStats | null>(null);
  const [findings, setFindings] = useState<StaleFindingItem[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<StaleFindingItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [backtestResult, setBacktestResult] = useState<DsaBacktestResult | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchStaleFindings({
        data: {
          severity: 'all',
          status: 'all',
        },
      });
      setStats(res.stats);
      setFindings(res.findings);
    } catch (err) {
      console.error("[StaleCitationsPage] Error loading findings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunScan = async () => {
    try {
      setScanning(true);
      await runStaleScan({
        data: { triggerSource: 'manual' },
      });
      await loadData();
    } catch (err) {
      console.error("[StaleCitationsPage] Scan error:", err);
    } finally {
      setScanning(false);
    }
  };

  const handleRunBacktest = async () => {
    try {
      setBacktesting(true);
      const res = await runDsaBacktest();
      setBacktestResult(res);
      await loadData();
    } catch (err) {
      console.error("[StaleCitationsPage] Backtest error:", err);
    } finally {
      setBacktesting(false);
    }
  };

  const handleUpdateStatus = async (
    findingId: string,
    newStatus: 'open' | 'acknowledged' | 'remediated' | 'ignored'
  ) => {
    try {
      await updateFindingStatus({
        data: { findingId, status: newStatus },
      });
      await loadData();
      if (selectedFinding && selectedFinding.id === findingId) {
        setSelectedFinding((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err) {
      console.error("[StaleCitationsPage] Status update error:", err);
    }
  };

  const filteredFindings = findings.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.raw_citation.toLowerCase().includes(q) ||
      f.contract_name.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell>
      <div className="w-full max-w-[1200px]">
        
        {/* Header: Clean & minimal, identical to contracts.index.tsx */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
              Temporal Audit · {findings.length} citation{findings.length === 1 ? '' : 's'}
            </p>
            <h1 className="mt-2 font-display text-[38px] leading-[1.05] tracking-tight text-foreground">
              Stale Citations
            </h1>
          </div>

          <div className="flex flex-wrap items-end gap-6 sm:gap-8">
            <Stat label="Total Findings" value={String(stats?.total_findings ?? 0)} />
            <Stat label="Exposure" value={formatUSD(stats?.total_exposure ?? 0)} />
            
            <button
              type="button"
              onClick={handleRunBacktest}
              disabled={backtesting}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] px-3.5 py-1.5 text-xs font-semibold text-foreground transition-all duration-200 ease-out hover:-translate-y-px hover:border-[var(--brass)] hover:text-[var(--brass)] disabled:opacity-50"
              title="Run DSA 2018 Statutory Backtest"
            >
              <FlaskConical className={`h-3.5 w-3.5 ${backtesting ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
              <span>{backtesting ? 'Backtesting...' : 'Backtest'}</span>
            </button>

            <button
              type="button"
              onClick={handleRunScan}
              disabled={scanning || loading}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brass)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-[var(--glow-brass)] transition-all duration-200 ease-out hover:-translate-y-px hover:bg-[var(--brass-strong)] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Scanning...' : 'Scan'}</span>
            </button>
          </div>
        </header>

        {/* Dismissible Backtest Results Banner */}
        {backtestResult && (
          <div className="mb-6 glass-panel p-4 flex items-center justify-between gap-4 border border-amber-500/30">
            <div className="flex items-center gap-3">
              <FlaskConical className="h-4 w-4 text-amber-400 shrink-0" />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono">
                <span className="font-semibold text-foreground">DSA 2018 Backtest:</span>
                <span className="text-[var(--brass)]">Precision {(backtestResult.metrics.precision * 100).toFixed(0)}%</span>
                <span className="text-[var(--brass)]">Recall {(backtestResult.metrics.recall * 100).toFixed(0)}%</span>
                <span className="text-emerald-400">Accuracy {(backtestResult.metrics.accuracy * 100).toFixed(0)}%</span>
                <span className="text-muted-foreground">{backtestResult.passed_clauses}/{backtestResult.total_clauses} clauses passed</span>
              </div>
            </div>
            <button
              onClick={() => setBacktestResult(null)}
              className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.05)] transition-colors"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Streamlined Search Toolbar */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search citations or contracts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2 rounded-full bg-[var(--surface-glass)] border border-[var(--hairline)] text-xs md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--brass)] font-mono transition-colors"
            />
          </div>

          <span className="font-mono text-[11px] text-muted-foreground shrink-0 uppercase tracking-wider">
            {filteredFindings.length} citation{filteredFindings.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Findings List: Clean 3-Column Layout */}
        {loading ? (
          <div className="glass-panel p-10 text-center text-muted-foreground font-mono text-xs animate-pulse">
            Loading citations...
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="glass-panel mx-auto max-w-md p-10 text-center space-y-3">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-[var(--hairline-strong)]">
              <CheckCircle2 className="h-5 w-5 text-[var(--brass)]" strokeWidth={1.75} />
            </div>
            <h3 className="font-display text-[20px] leading-[1.15] tracking-tight text-foreground">
              No Stale Citations
            </h3>
            <p className="text-[13px] text-muted-foreground">
              All contract commitments reference active statutory lifecycles.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredFindings.map((finding) => (
              <div
                key={finding.id}
                onClick={() => {
                  setSelectedFinding(finding);
                  setDrawerOpen(true);
                }}
                className="glass-panel group grid grid-cols-1 md:grid-cols-[140px_1fr_auto] items-center gap-4 md:gap-7 px-6 py-5 min-h-[88px] duration-150 ease-out transition-all hover:border-[var(--hairline-strong)] cursor-pointer"
              >
                {/* Col 1: Clean Status Badge */}
                <div>
                  <StaleCitationBadge
                    severity={finding.severity}
                    stalenessType={finding.staleness_type}
                    size="md"
                  />
                </div>

                {/* Col 2: Citation Title & Contract */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-[17px] md:text-[18px] leading-snug tracking-tight text-foreground group-hover:text-[var(--brass)] duration-150 ease-out transition-colors truncate">
                      {finding.raw_citation}
                    </h3>
                    {finding.official_source_url && (
                      <a
                        href={finding.official_source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-[var(--brass)] transition-colors shrink-0"
                        title="View official statute"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground truncate">
                    {finding.contract_name}
                  </p>
                </div>

                {/* Col 3: Exposure + Pill Action Button */}
                <div className="flex items-center gap-4 justify-between md:justify-end shrink-0">
                  {finding.financial_exposure ? (
                    <span className="font-mono text-[15px] font-bold text-amber-400">
                      {formatUSD(Number(finding.financial_exposure))}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFinding(finding);
                      setDrawerOpen(true);
                    }}
                    className="press inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:border-[var(--brass)] hover:text-foreground transition-ui"
                  >
                    <span>Inspect</span>
                    <ChevronRight size={13} className="text-[var(--brass)]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Slide-out Evidence Drawer */}
        <EvidenceDrawer
          finding={selectedFinding}
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onUpdateStatus={handleUpdateStatus}
        />

      </div>
    </AppShell>
  );
}

function Stat({ label, value, isRisk }: { label: string; value: string; isRisk?: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className={`mt-0.5 font-mono text-[15px] ${isRisk ? 'text-[var(--risk)] font-semibold' : 'text-[var(--brass)]'}`}>
        {value}
      </span>
    </div>
  );
}
