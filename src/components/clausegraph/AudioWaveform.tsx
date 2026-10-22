import React from "react";
import { Volume2, VolumeX, Mic, Pause, Play, Square, Sparkles } from "lucide-react";
import { useVoice } from "@/lib/voice.context";

export function AudioWaveform() {
  const {
    playbackState,
    listeningState,
    stop,
    pause,
    resume,
    stopListening,
    currentSpeechText,
    voiceSettings,
    togglePlaybackRate,
    setVoicePersona,
  } = useVoice();

  const isSpeaking = playbackState === "speaking" || playbackState === "paused";
  const isListening = listeningState === "listening";

  if (!isSpeaking && !isListening) return null;

  return (
    <div
      role="region"
      aria-label="Audio Playback Bar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9990] flex items-center gap-3.5 rounded-full border border-emerald-500/40 bg-[#0c1017]/95 px-4 py-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in"
    >
      {/* Visualizer Icon & Wave */}
      <div className="flex items-center gap-2">
        {isListening ? (
          <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
            <Mic className="relative h-3.5 w-3.5 animate-pulse" />
          </div>
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
            <Volume2 className="h-3.5 w-3.5" />
          </div>
        )}

        {/* Dancing Waveform Bars */}
        <div className="flex items-center gap-1 h-5 px-1">
          <span
            className={`w-1 rounded-full bg-emerald-400 transition-all duration-150 ${
              playbackState === "speaking" || isListening ? "animate-[bounce_0.6s_ease-in-out_infinite]" : "h-1.5 opacity-40"
            }`}
            style={{ animationDelay: "0ms", height: playbackState === "speaking" ? "14px" : "6px" }}
          />
          <span
            className={`w-1 rounded-full bg-emerald-300 transition-all duration-150 ${
              playbackState === "speaking" || isListening ? "animate-[bounce_0.8s_ease-in-out_infinite]" : "h-2 opacity-40"
            }`}
            style={{ animationDelay: "150ms", height: playbackState === "speaking" ? "18px" : "8px" }}
          />
          <span
            className={`w-1 rounded-full bg-teal-400 transition-all duration-150 ${
              playbackState === "speaking" || isListening ? "animate-[bounce_0.5s_ease-in-out_infinite]" : "h-1 opacity-40"
            }`}
            style={{ animationDelay: "300ms", height: playbackState === "speaking" ? "12px" : "4px" }}
          />
          <span
            className={`w-1 rounded-full bg-emerald-400 transition-all duration-150 ${
              playbackState === "speaking" || isListening ? "animate-[bounce_0.7s_ease-in-out_infinite]" : "h-2.5 opacity-40"
            }`}
            style={{ animationDelay: "200ms", height: playbackState === "speaking" ? "16px" : "10px" }}
          />
        </div>
      </div>

      {/* Status Label & Text snippet */}
      <div className="flex flex-col min-w-0 max-w-[200px] sm:max-w-[320px]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            {isListening ? "Listening..." : "Natural Audio Narration"}
          </span>
          <button
            type="button"
            onClick={() => {
              const next =
                voiceSettings.persona === "executive_female"
                  ? "executive_male"
                  : voiceSettings.persona === "executive_male"
                  ? "bengali_natural"
                  : "executive_female";
              setVoicePersona(next);
            }}
            className="rounded bg-white/10 px-1.5 py-0.2 text-[9px] font-mono text-[var(--text-muted)] hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
            title="Click to cycle voice persona"
          >
            {voiceSettings.persona === "executive_female"
              ? "Aria Neural"
              : voiceSettings.persona === "bengali_natural"
              ? "Bangla Neural"
              : "Guy Neural"}
          </button>
        </div>
        {currentSpeechText && (
          <p className="truncate text-[11px] text-[var(--text-muted)]">
            {currentSpeechText}
          </p>
        )}
      </div>

      {/* Speed & Controls */}
      <div className="flex items-center gap-1.5 border-l border-stone-800 pl-2">
        {!isListening && (
          <button
            type="button"
            onClick={togglePlaybackRate}
            className="rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-400 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            title="Toggle playback speed (1x -> 1.25x -> 1.5x)"
          >
            {voiceSettings.rate}x
          </button>
        )}
        {isListening ? (
          <button
            type="button"
            onClick={stopListening}
            className="rounded-full bg-rose-500/20 p-1.5 text-rose-300 hover:bg-rose-500/30 transition-colors"
            title="Stop listening"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        ) : (
          <>
            {playbackState === "speaking" ? (
              <button
                type="button"
                onClick={pause}
                className="rounded-full p-1.5 text-stone-300 hover:bg-white/10 hover:text-white transition-colors"
                title="Pause audio"
              >
                <Pause className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={resume}
                className="rounded-full p-1.5 text-emerald-400 hover:bg-white/10 hover:text-emerald-300 transition-colors"
                title="Resume audio"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={stop}
              className="rounded-full p-1.5 text-stone-400 hover:bg-white/10 hover:text-rose-400 transition-colors"
              title="Stop playback"
            >
              <Square className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
