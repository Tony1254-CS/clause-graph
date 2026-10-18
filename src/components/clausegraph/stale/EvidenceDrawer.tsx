// ============================================================================
// Evidence Drawer Component: src/components/clausegraph/stale/EvidenceDrawer.tsx
// Comprehensive evidence presentation for temporal legal findings.
// Generously sized (wide max-w-[860px]) with clear typography and comfortable layout.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ExternalLink,
  ShieldAlert,
  FileText,
  Scale,
  GitCompare,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import type { StaleFindingItem } from '../../../lib/stale/fetch.functions';
import { formatUSD } from '@/data/queries';

export interface EvidenceDrawerProps {
  finding: StaleFindingItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus?: (findingId: string, newStatus: 'open' | 'acknowledged' | 'remediated' | 'ignored') => Promise<void>;
}

function renderHighlightedClause(clauseText: string, rawCitation: string) {
  if (!clauseText) return null;
  if (!rawCitation) return <span>"{clauseText}"</span>;

  const cleanCitation = rawCitation.trim();
  const escaped = cleanCitation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'i');
  const match = clauseText.match(regex);

  if (match && match.index !== undefined) {
    const before = clauseText.slice(0, match.index);
    const highlighted = match[0];
    const after = clauseText.slice(match.index + highlighted.length);

    return (
      <span>
        "{before}
        <mark className="not-italic font-semibold text-foreground bg-[rgba(225,82,75,0.14)] text-[var(--risk)] border border-[rgba(225,82,75,0.28)] px-1.5 py-0.5 rounded-[6px]">
          {highlighted}
        </mark>
        {after}"
      </span>
    );
  }

  // Fallback: match Section/Article number
  const secMatch = cleanCitation.match(/(?:Section|Article|Directive)\s+\d+[\w-]*/i);
  if (secMatch) {
    const secEscaped = secMatch[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const secRegex = new RegExp(`(${secEscaped})`, 'i');
    const m = clauseText.match(secRegex);
    if (m && m.index !== undefined) {
      const before = clauseText.slice(0, m.index);
      const highlighted = m[0];
      const after = clauseText.slice(m.index + highlighted.length);

      return (
        <span>
          "{before}
          <mark className="not-italic font-semibold text-foreground bg-[rgba(225,82,75,0.14)] text-[var(--risk)] border border-[rgba(225,82,75,0.28)] px-1.5 py-0.5 rounded-[6px]">
            {highlighted}
          </mark>
          {after}"
        </span>
      );
    }
  }

  return <span>"{clauseText}"</span>;
}

export const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({
  finding,
  isOpen,
  onClose,
  onUpdateStatus,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !finding || !mounted || typeof document === 'undefined') return null;

  const evidence = finding.evidence || {};
  const diff = evidence.version_diff || {};
  const unverifiedNote = evidence.unverified_mapping_note;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      {/* Backdrop click */}
      <div className="flex-1" onClick={onClose} aria-label="Close backdrop" />

      {/* Slide-in panel: Full height h-dvh / h-screen */}
      <div className="w-full max-w-[860px] h-full h-dvh bg-[var(--shell-bg)] border-l border-[var(--hairline-strong)] text-foreground shadow-[var(--shadow-lift)] flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="px-7 py-5 border-b border-[var(--hairline)] bg-[var(--shell-secondary)] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-[23px] md:text-[25px] leading-tight tracking-tight text-foreground truncate">
              Temporal Evidence Dossier
            </h2>
            <p className="mt-1.5 text-[14px] text-muted-foreground truncate">
              Contract:{' '}
              <span className="text-foreground font-medium">{finding.contract_name}</span>
            </p>
          </div>

          {/* Right metadata badges + close button */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full bg-[rgba(255,255,255,0.04)] text-muted-foreground border border-[var(--hairline)]">
              Finding ID: {finding.id.slice(0, 8)}
            </span>
            <button
              onClick={onClose}
              className="press p-2.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.05)] transition-colors ml-1"
              title="Close Drawer (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 premium-scrollbar">

          {/* Section 1: Citation and Clause in Question */}
          <div className="glass-panel p-6 sm:p-7 space-y-5 border border-[rgba(225,82,75,0.28)] border-l-4 border-l-[var(--risk)] bg-gradient-to-br from-[rgba(225,82,75,0.05)] via-transparent to-transparent shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span className="flex items-center gap-2 text-[var(--risk)] font-semibold uppercase tracking-wider text-[11px]">
                <ShieldAlert size={15} /> Flagged Citation
              </span>
              <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.14)] text-foreground">
                Confidence: {(finding.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="p-4 sm:p-5 rounded-[12px] bg-[rgba(225,82,75,0.05)] border border-[rgba(225,82,75,0.32)] font-mono text-[15px] font-semibold text-foreground break-words min-h-[58px] flex items-center justify-between gap-3 shadow-[0_2px_12px_-4px_rgba(225,82,75,0.15)]">
              <span>{finding.raw_citation}</span>
              <span className="shrink-0 text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--risk)] px-2.5 py-0.5 rounded bg-[rgba(225,82,75,0.12)] border border-[rgba(225,82,75,0.3)]">
                Stale Reference
              </span>
            </div>
            <div className="text-[13px] text-muted-foreground">
              <span className="font-semibold text-foreground font-mono uppercase text-[11px] tracking-wider">Clause Context:</span>
              <p className="mt-2.5 italic text-foreground/90 bg-[rgba(0,0,0,0.3)] p-5 sm:p-6 rounded-[12px] border border-[rgba(255,255,255,0.14)] leading-relaxed text-[14.5px] min-h-[110px] flex items-center">
                {renderHighlightedClause(finding.clause_text, finding.raw_citation)}
              </p>
            </div>
          </div>

          {/* Section 2: Legal Finding & Staleness Reasoning */}
          <div className="glass-panel p-6 sm:p-7 space-y-3.5 min-h-[110px] border border-[rgba(94,234,212,0.28)] border-l-4 border-l-[var(--brass)] bg-gradient-to-br from-[rgba(94,234,212,0.03)] via-transparent to-transparent shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--brass)] flex items-center gap-2 font-semibold">
              <Scale size={15} /> Legal Staleness Determination
            </h3>
            <p className="text-[14px] text-foreground/90 leading-relaxed">
              {finding.reason}
            </p>
          </div>

          {/* Section 3: Official Statutory Source & Gazette Provenance */}
          <div className="glass-panel p-6 sm:p-7 space-y-5 border border-[var(--hairline-strong)] shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
            <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 font-semibold">
              <FileText size={15} className="text-[var(--brass)]" /> Official Statutory Provenance
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-[12px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.14)] min-h-[72px] flex flex-col justify-center">
                <span className="text-muted-foreground block mb-1 text-[11px] font-mono uppercase tracking-wider">Regulation Status</span>
                <span className="font-mono font-medium text-[14px] capitalize text-foreground">
                  {evidence.regulation_status || finding.staleness_type}
                </span>
              </div>
              <div className="p-4 rounded-[12px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.14)] min-h-[72px] flex flex-col justify-center">
                <span className="text-muted-foreground block mb-1 text-[11px] font-mono uppercase tracking-wider">Effective Dates</span>
                <span className="font-mono text-[14px] text-foreground">
                  {evidence.effective_from || 'Unknown'} →{' '}
                  {evidence.effective_to || 'Active'}
                </span>
              </div>
            </div>

            {/* Gazette Reference */}
            {finding.gazette_reference && (
              <div className="p-4 rounded-[12px] bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.14)] text-xs min-h-[64px] flex flex-col justify-center">
                <span className="text-muted-foreground block mb-1 text-[11px] font-mono uppercase tracking-wider">Official Gazette Reference</span>
                <span className="font-mono text-[13.5px] text-foreground">{finding.gazette_reference}</span>
              </div>
            )}

            {/* Official Source Link */}
            {finding.official_source_url && (
              <div className="pt-1">
                <a
                  href={finding.official_source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-[13px] font-mono text-[var(--brass)] hover:underline transition-colors py-1"
                >
                  <ExternalLink size={15} />
                  <span>Verify Primary Legal Source (Official Government Repository)</span>
                </a>
              </div>
            )}
          </div>

          {/* Section 4: Version Comparison & Diff */}
          {(evidence.current_version || diff.reorganized_sections || unverifiedNote) && (
            <div className="glass-panel p-6 sm:p-7 space-y-5 border border-amber-500/30 border-l-4 border-l-amber-400 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-400 flex items-center gap-2 font-semibold">
                <GitCompare size={15} className="text-amber-400" /> Version Lineage & Provision Recoding
              </h3>

              {unverifiedNote && (
                <div className="p-4 rounded-[12px] bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5 min-h-[72px]">
                  <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-[13px] block">Caution on Provision Equivalence:</span>
                    <p className="mt-1 leading-relaxed text-[12.5px]">{unverifiedNote}</p>
                  </div>
                </div>
              )}

              {diff.reorganized_sections && (
                <div className="space-y-2 text-xs">
                  <span className="text-muted-foreground text-[11px] font-mono uppercase tracking-wider">Section Recoding Map:</span>
                  <div className="space-y-2.5 mt-2">
                    {diff.reorganized_sections.map((sec: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3.5 rounded-[10px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.14)] font-mono text-xs text-foreground min-h-[52px]"
                      >
                        <span className="text-[var(--risk)] font-medium text-[13px]">{sec.old}</span>
                        <ArrowRight size={15} className="text-muted-foreground" />
                        <span className="text-[var(--brass)] font-medium text-[13px]">{sec.new}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 5: Remediation Recommendation & Suggested Redline */}
          {(finding.suggested_citation || finding.suggested_clause_text) && (
            <div className="glass-panel p-6 sm:p-7 border border-[rgba(94,234,212,0.32)] border-l-4 border-l-[var(--brass)] bg-gradient-to-br from-[rgba(94,234,212,0.04)] via-transparent to-transparent shadow-[0_4px_24px_rgba(0,0,0,0.4)] space-y-5">
              <h3 className="text-[11px] font-mono uppercase tracking-[0.2em] text-[var(--brass)] flex items-center gap-2 font-semibold">
                <Sparkles size={15} /> Remediation Proposal
              </h3>
              {finding.suggested_citation && (
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">Recommended Citation Replacement:</span>
                  <div className="p-3.5 rounded-[10px] bg-[rgba(0,0,0,0.3)] border border-[rgba(94,234,212,0.35)] font-mono text-[14px] font-semibold text-[var(--brass)] min-h-[48px] flex items-center">
                    {finding.suggested_citation}
                  </div>
                </div>
              )}
              {finding.suggested_clause_text && (
                <div>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block mb-1.5">Proposed Redline Clause Text:</span>
                  <div className="p-4 sm:p-5 rounded-[10px] bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.14)] text-[13.5px] text-foreground leading-relaxed italic min-h-[88px] flex items-center">
                    "{finding.suggested_clause_text}"
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 6: Financial Exposure Proxy */}
          {finding.financial_exposure && (
            <div className="glass-panel p-6 flex items-center justify-between min-h-[84px] border border-amber-500/30 border-l-4 border-l-amber-400 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">Potential Contract Exposure</span>
                <span className="text-[13px] text-muted-foreground">Contract valuation baseline</span>
              </div>
              <div className="text-[24px] font-mono font-bold text-amber-400">
                {formatUSD(Number(finding.financial_exposure))}
              </div>
            </div>
          )}
        </div>

        {/* Footer / Status Actions */}
        <div className="px-7 py-3.5 border-t border-[var(--hairline)] bg-[var(--shell-secondary)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            <span className="font-mono text-[11.5px] uppercase tracking-wider">Status:</span>
            <span className="capitalize font-mono text-[11.5px] text-foreground px-3 py-1 rounded-full bg-[rgba(255,255,255,0.05)] border border-[var(--hairline)]">
              {finding.status}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            {finding.status !== 'acknowledged' && (
              <button
                onClick={() => onUpdateStatus?.(finding.id, 'acknowledged')}
                className="press px-4 py-2 rounded-full text-xs font-mono border border-[var(--hairline)] bg-[rgba(255,255,255,0.03)] hover:border-[var(--brass)] hover:text-[var(--brass)] text-foreground transition-ui"
              >
                Acknowledge
              </button>
            )}
            {finding.status !== 'remediated' && (
              <button
                onClick={() => onUpdateStatus?.(finding.id, 'remediated')}
                className="press px-5 py-2 rounded-full text-xs font-mono font-medium bg-[var(--brass)] text-[var(--primary-foreground)] shadow-[var(--glow-brass)] hover:bg-[var(--brass-strong)] transition-ui flex items-center gap-2"
              >
                <CheckCircle2 size={15} />
                <span>Mark Remediated</span>
              </button>
            )}
            {finding.status !== 'ignored' && (
              <button
                onClick={() => onUpdateStatus?.(finding.id, 'ignored')}
                className="press px-3.5 py-2 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground transition-ui"
              >
                Ignore
              </button>
            )}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

