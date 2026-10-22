import React, { useState } from "react";
import { Play, Pause, RotateCcw, Volume2, Sparkles, ChevronDown, ChevronUp, Radio } from "lucide-react";
import { useVoice } from "@/lib/voice.context";

interface ExecutiveBriefingProps {
  contractCount?: number;
  totalValuationUsd?: number;
  criticalIssuesCount?: number;
  exposureUsd?: number;
  healthScore?: number;
}

export function ExecutiveBriefingCard({
  contractCount = 9,
  totalValuationUsd = 66970001,
  criticalIssuesCount = 1,
  exposureUsd = 450000,
  healthScore = 95,
}: ExecutiveBriefingProps) {
  const { speak, stop, pause, resume, playbackState, activeSpeechId } = useVoice();
  const [showTranscript, setShowTranscript] = useState(false);

  const BRIEFING_ID = "executive-morning-briefing-daily";
  const isPlayingThis = activeSpeechId === BRIEFING_ID && playbackState === "speaking";
  const isPausedThis = activeSpeechId === BRIEFING_ID && playbackState === "paused";

  const briefingText =
    `Welcome to your ClauseGraph Executive Compliance Briefing. ` +
    `Today, ${contractCount} enterprise contracts are actively monitored across 66.9 million dollars in portfolio valuation. ` +
    `Critical attention: ${criticalIssuesCount} contract violates the Bangladesh Cyber Security Act framework by referencing the repealed Digital Security Act 2018 with 450 thousand dollars in direct financial exposure. ` +
    `On the statutory radar: EUR-Lex released a candidate update for DORA Article 30 ICT subcontracting rules overnight. ` +
    `Overall portfolio compliance health stands optimal at ${healthScore} percent. All automated surveillance feeds remain operational.`;

  const handlePlayToggle = () => {
    if (isPlayingThis) {
      pause();
    } else if (isPausedThis) {
      resume();
    } else {
      speak(briefingText, {
        id: BRIEFING_ID,
        rate: 1.02,
        pitch: 1.0,
      });
    }
  };

  const handleReplay = () => {
    stop();
    speak(briefingText, {
      id: BRIEFING_ID,
      rate: 1.02,
      pitch: 1.0,
    });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/25 via-stone-900/60 to-emerald-950/20 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      {/* Subtle ambient light */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Podcast / Radio Badge & Info */}
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/15 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.25)]">
            {isPlayingThis ? (
              <Radio className="h-5 w-5 animate-pulse text-emerald-400" />
            ) : (
              <Volume2 className="h-5 w-5 text-emerald-400" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live Voice Intelligence
              </span>
              <span className="text-[10px] text-stone-400">45s Audio Podcast</span>
            </div>

            <h3 className="mt-1 font-display text-sm font-semibold tracking-tight text-[var(--ink)]">
              Executive Compliance Morning Briefing
            </h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)] line-clamp-1">
              AI General Counsel portfolio overview: Statutory shocks, exposure triage, and health score.
            </p>
          </div>
        </div>

        {/* Right: Audio Play Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handlePlayToggle}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold tracking-wide transition-all ${
              isPlayingThis
                ? "border border-emerald-400 bg-emerald-500 text-stone-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                : "border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-400"
            }`}
          >
            {isPlayingThis ? (
              <>
                <Pause className="h-3.5 w-3.5 fill-current" />
                Pause Briefing
              </>
            ) : isPausedThis ? (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Resume Briefing
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                Listen to Briefing
              </>
            )}
          </button>

          {(isPlayingThis || isPausedThis) && (
            <button
              type="button"
              onClick={handleReplay}
              title="Replay from start"
              className="rounded-xl border border-stone-800 bg-stone-900/60 p-2 text-stone-400 hover:text-white transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowTranscript((prev) => !prev)}
            title={showTranscript ? "Hide transcript" : "View transcript"}
            className="rounded-xl border border-stone-800 bg-stone-900/60 px-2.5 py-2 text-[11px] font-medium text-stone-400 hover:text-stone-200 transition-colors inline-flex items-center gap-1"
          >
            Transcript
            {showTranscript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Expandable Transcript */}
      {showTranscript && (
        <div className="mt-3.5 border-t border-emerald-500/20 pt-3 text-xs leading-relaxed text-stone-300 bg-black/20 rounded-xl p-3 animate-in fade-in duration-200 font-mono">
          <p className="text-[11px] text-emerald-400 font-sans font-semibold mb-1 uppercase tracking-wider">
            Synthesized Narration Transcript:
          </p>
          {briefingText}
        </div>
      )}
    </div>
  );
}
