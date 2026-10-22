/**
 * Enterprise Natural Voice & Speech System — Types & Models
 *
 * Designed for ClauseGraph Legal Intelligence:
 * - Ultra-natural human neural voice selection (Aria, Jenny, Guy, Google Neural)
 * - Executive Compliance Audio Briefings ("Daily Legal Podcast")
 * - Notification narration & alert audio readouts
 * - Multimodal Voice-to-Copilot (Speech-to-Text via WebSpeech / Whisper)
 * - Holographic obsidian-mint audio waveform visualizer
 */

export type VoicePersona = "executive_female" | "executive_male" | "bengali_natural";

export type PlaybackState = "idle" | "speaking" | "paused" | "loading";

export type ListeningState = "idle" | "listening" | "processing" | "error";

export interface VoiceSettings {
  persona: VoicePersona;
  rate: number; // 0.8 to 1.3 (default 1.0)
  pitch: number; // 0.8 to 1.2 (default 1.0)
  volume: number; // 0.0 to 1.0 (default 1.0)
  autoReadCopilotReplies: boolean;
  selectedVoiceName?: string;
}

export interface SpeakOptions {
  id?: string; // Identifier for the active item (e.g., notification id or briefing id)
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  rate?: number;
  pitch?: number;
}

export interface AvailableVoice {
  name: string;
  lang: string;
  isNatural: boolean;
  gender?: "female" | "male";
  provider?: "microsoft" | "google" | "apple" | "system";
}
