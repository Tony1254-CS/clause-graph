import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Zap, AlertTriangle, ShieldAlert, ArrowRight, CheckCircle2, Sparkles, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { useVoice } from "@/lib/voice.context";

export interface ShockScenario {
  id: string;
  jurisdiction: "BD" | "EU" | "US";
  flag: string;
  title: string;
  actName: string;
  statutoryInstrument: string;
  exposureDelta: string;
  affectedContracts: number;
  severity: "critical" | "regulatory";
  summary: string;
  voiceAnnouncement: string;
}

export const PRESET_SHOCK_SCENARIOS: ShockScenario[] = [
  {
    id: "bd-csa-sec8",
    jurisdiction: "BD",
    flag: "🇧🇩",
    title: "Bangladesh Cyber Security Act 2023 — Sec 8 Cloud Sovereignty Order",
    actName: "Cyber Security Act 2023 (Act No. 38 of 2023)",
    statutoryInstrument: "B.G. Press S.R.O. No. 248-Law/2023",
    exposureDelta: "+$450,000 USD",
    affectedContracts: 3,
    severity: "critical",
    summary:
      "ICT Division gazetted an emergency binding directive mandating in-country mirrored data residency for all Critical Information Infrastructure (CII). 3 active vendor MSAs cite the repealed Digital Security Act 2018 or lack localization warranties.",
    voiceAnnouncement:
      "Critical regulatory alert detected from Bangladesh. The Cyber Security Act 2023 Section 8 Emergency Order requires immediate contract remediation. 3 enterprise agreements violated with 450 thousand dollars in direct financial exposure.",
  },
  {
    id: "eu-dora-art30",
    jurisdiction: "EU",
    flag: "🇪🇺",
    title: "EU DORA Article 30 — ICT Subcontracting Restrictions (Candidate)",
    actName: "Digital Operational Resilience Act (Regulation (EU) 2022/2554)",
    statutoryInstrument: "EUR-Lex COM(2022) 540 final",
    exposureDelta: "+$180,000 USD",
    affectedContracts: 2,
    severity: "regulatory",
    summary:
      "EUR-Lex candidate version discovered introducing strict chained subcontractor oversight and supervisory exit audit clauses for cloud hosting providers.",
    voiceAnnouncement:
      "European Union regulatory update. EUR-Lex has published a candidate amendment for DORA Article 30. 2 subcontracting agreements require compliance review before audit cutoff.",
  },
  {
    id: "us-sec-24h",
    jurisdiction: "US",
    flag: "🇺🇸",
    title: "US SEC 24-Hour Material Incident Disclosure Directive",
    actName: "SEC Cybersecurity Risk Governance (17 CFR Part 229)",
    statutoryInstrument: "Release Nos. 33-11216; 34-97989",
    exposureDelta: "+$320,000 USD",
    affectedContracts: 4,
    severity: "critical",
    summary:
      "SEC enforcement update reduces material incident disclosure window from 72 hours to 24 hours. 4 vendor master agreements specifying 72h notification are now in direct statutory conflict.",
    voiceAnnouncement:
      "United States SEC compliance shock. Mandatory incident disclosure window reduced to 24 hours. 4 commercial agreements are now in direct SLA breach.",
  },
];

interface LiveShockSimulatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShockInjected?: (scenario: ShockScenario) => void;
}

export function LiveShockSimulatorModal({
  open,
  onOpenChange,
  onShockInjected,
}: LiveShockSimulatorModalProps) {
  const [selectedId, setSelectedId] = useState<string>("bd-csa-sec8");
  const [injecting, setInjecting] = useState(false);
  const { speak } = useVoice();

  const selectedScenario =
    PRESET_SHOCK_SCENARIOS.find((s) => s.id === selectedId) || PRESET_SHOCK_SCENARIOS[0];

  const handleExecuteShock = () => {
    setInjecting(true);

    setTimeout(() => {
      // 1. Dispatch custom window event for real-time reactivity
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("clausegraph:regulatory_shock", {
            detail: selectedScenario,
          })
        );
      }

      // 2. High-impact Toast Alert
      toast.error(`🚨 BREAKING REGULATORY AMENDMENT [${selectedScenario.jurisdiction}]`, {
        description: `${selectedScenario.title} — Exposure Increased by ${selectedScenario.exposureDelta}!`,
        duration: 8000,
      });

      // 3. Audio Narration
      speak(selectedScenario.voiceAnnouncement, {
        id: `shock-${selectedScenario.id}`,
        rate: 1.04,
      });

      onShockInjected?.(selectedScenario);
      setInjecting(false);
      onOpenChange(false);
    }, 600);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden rounded-[24px] border border-amber-500/40 bg-[var(--shell-bg)] p-0 shadow-[0_25px_70px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
        {/* Ambient Top Glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-amber-500/15 via-transparent to-transparent" />

        {/* Modal Header - Fixed */}
        <div className="relative px-6 pt-6 pb-4 sm:px-7 sm:pt-7 sm:pb-4 border-b border-[var(--hairline)] shrink-0">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.3)]">
                <Zap className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400">
                  Live Demonstration Engine
                </span>
                <DialogTitle className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  Simulate Live Statutory Shock
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Select an overnight regulatory gazette to inject into the live portfolio. Demonstrates real-time autonomous detection, blast radius recalculation, notification dispatch, and neural voice advisory.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 sm:px-7 space-y-4 premium-scrollbar">
          {/* Scenario Selection Grid */}
          <div className="space-y-2.5">
            {PRESET_SHOCK_SCENARIOS.map((scenario) => {
              const isSelected = scenario.id === selectedId;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => setSelectedId(scenario.id)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-all cursor-pointer ${
                    isSelected
                      ? "border-amber-400/80 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/30"
                      : "border-[var(--hairline)] bg-[var(--surface-raised)]/40 hover:border-white/20 hover:bg-[var(--surface-raised)]/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-lg shrink-0">{scenario.flag}</span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-foreground truncate">
                          {scenario.title}
                        </h4>
                        <p className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">
                          {scenario.statutoryInstrument}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-mono text-xs font-bold text-rose-400">
                        {scenario.exposureDelta}
                      </span>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {scenario.affectedContracts} contracts
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed Selected Shock Preview */}
          <div className="rounded-xl border border-[var(--hairline)] bg-black/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-400" /> Expected Cascade Reaction:
              </span>
              <span className="font-mono text-[10px] text-emerald-400 flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5" /> Voice Narration Active
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              {selectedScenario.summary}
            </p>
          </div>
        </div>

        {/* Action Trigger Footer - Fixed */}
        <div className="px-6 py-4 sm:px-7 border-t border-[var(--hairline)] bg-black/30 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={injecting}
            onClick={handleExecuteShock}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-stone-950 hover:bg-amber-400 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] cursor-pointer disabled:opacity-50"
          >
            {injecting ? (
              <>Injecting Telemetry...</>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5 fill-current" />
                Execute Live Shock
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
