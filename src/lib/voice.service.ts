/**
 * Enterprise Natural Voice Synthesizer & Speech Service
 *
 * Implements:
 * 1. Automatic Neural / Natural voice discovery (Edge Natural & Google Neural voices).
 * 2. Legal text pre-processing (removes markdown, converts currency, spells acronyms).
 * 3. Buffer-safe chunking to prevent browser SpeechSynthesis API timeouts.
 * 4. Speech Recognition (STT) for hands-free voice-to-Copilot dictation.
 */

import type { AvailableVoice, VoicePersona } from "./voice.types";

/**
 * Strips markdown and formats legal strings for fluent human narration
 */
export function sanitizeTextForSpeech(text: string): string {
  if (!text) return "";

  let cleaned = text
    // Remove markdown code fences and backticks
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    // Remove bold and italic markers
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Remove markdown links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove markdown headers
    .replace(/^#+\s+/gm, "")
    // Remove bullet point markers
    .replace(/^[-*+]\s+/gm, "")
    // Format currency amounts for speech (e.g. $450,000 -> 450 thousand dollars)
    .replace(/\$([0-9,.]+)\s*(?:USD|dollars)?/gi, (match, numStr) => {
      const num = parseFloat(numStr.replace(/,/g, ""));
      if (isNaN(num)) return match;
      if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(1)} million dollars`;
      }
      if (num >= 1_000) {
        return `${(num / 1_000).toFixed(0)} thousand dollars`;
      }
      return `${num} dollars`;
    })
    // Acronym pronunciation hints
    .replace(/\bGDPR\b/g, "G-D-P-R")
    .replace(/\bDORA\b/g, "Dora")
    .replace(/\bMSA\b/g, "M-S-A")
    .replace(/\bDPA\b/g, "D-P-A")
    .replace(/\bDSA\b/g, "D-S-A")
    .replace(/\bCSA\b/g, "C-S-A")
    .replace(/\bSEC\b/g, "S-E-C")
    .replace(/\bEUR-Lex\b/g, "Eur Lex")
    // Remove excessive newlines and whitespace
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

/**
 * Splits long text into natural sentence chunks to prevent browser speech synthesis truncation
 */
export function chunkTextIntoSentences(text: string, maxChunkLength: number = 180): string[] {
  const clean = sanitizeTextForSpeech(text);
  if (!clean) return [];

  // Match sentences ending in punctuation
  const sentenceRegex = /[^.!?]+[.!?]+|[^.!?]+$/g;
  const rawSentences = clean.match(sentenceRegex) || [clean];

  const chunks: string[] = [];
  let current = "";

  for (const sentence of rawSentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (current.length + trimmed.length > maxChunkLength && current.length > 0) {
      chunks.push(current.trim());
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}

/**
 * Discovers and ranks available browser voices, prioritizing ultra-natural neural voices
 */
export function getAvailableNaturalVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(rankVoices(voices));
      return;
    }

    // Wait for voiceschanged event if not loaded yet
    const onVoicesChanged = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      const loaded = window.speechSynthesis.getVoices();
      resolve(rankVoices(loaded));
    };

    window.speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);

    // Timeout fallback in case voiceschanged never fires
    setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(rankVoices(window.speechSynthesis.getVoices()));
    }, 1000);
  });
}

function rankVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  return voices.slice().sort((a, b) => {
    const aNatural = isNaturalVoice(a.name);
    const bNatural = isNaturalVoice(b.name);
    if (aNatural && !bNatural) return -1;
    if (!aNatural && bNatural) return 1;

    // Prefer English US/UK or Bengali
    const aEn = a.lang.startsWith("en") || a.lang.startsWith("bn");
    const bEn = b.lang.startsWith("en") || b.lang.startsWith("bn");
    if (aEn && !bEn) return -1;
    if (!aEn && bEn) return 1;

    return a.name.localeCompare(b.name);
  });
}

function isNaturalVoice(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("natural") ||
    lower.includes("neural") ||
    lower.includes("online") ||
    lower.includes("enhanced") ||
    lower.includes("premium") ||
    lower.includes("google")
  );
}

/**
 * Selects the optimal natural voice for a given persona
 */
export function selectVoiceForPersona(
  voices: SpeechSynthesisVoice[],
  persona: VoicePersona,
  customVoiceName?: string
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  if (customVoiceName) {
    const custom = voices.find((v) => v.name === customVoiceName);
    if (custom) return custom;
  }

  // Persona 1: Executive Female (Aria, Jenny, Samantha)
  if (persona === "executive_female") {
    const aria = voices.find((v) => v.name.includes("Aria") && v.name.includes("Natural"));
    if (aria) return aria;

    const jenny = voices.find((v) => v.name.includes("Jenny") && v.name.includes("Natural"));
    if (jenny) return jenny;

    const googleUs = voices.find((v) => v.name.toLowerCase().includes("google us english") && v.lang.startsWith("en"));
    if (googleUs) return googleUs;

    const femaleAny = voices.find((v) => (v.name.includes("Female") || v.name.includes("Zira") || v.name.includes("Samantha")) && v.lang.startsWith("en"));
    if (femaleAny) return femaleAny;
  }

  // Persona 2: Executive Male (Guy, Christopher, David)
  if (persona === "executive_male") {
    const guy = voices.find((v) => v.name.includes("Guy") && v.name.includes("Natural"));
    if (guy) return guy;

    const chris = voices.find((v) => v.name.includes("Christopher") && v.name.includes("Natural"));
    if (chris) return chris;

    const maleAny = voices.find((v) => (v.name.includes("Male") || v.name.includes("David") || v.name.includes("George")) && v.lang.startsWith("en"));
    if (maleAny) return maleAny;
  }

  // Persona 3: Bengali Natural
  if (persona === "bengali_natural") {
    const bn = voices.find((v) => v.lang.startsWith("bn"));
    if (bn) return bn;
  }

  // Fallback to highest ranked natural voice
  const topNatural = voices.find((v) => isNaturalVoice(v.name) && v.lang.startsWith("en"));
  return topNatural || voices[0] || null;
}

/**
 * Speech-to-Text Speech Recognition Wrapper
 */
export class SpeechRecognitionSession {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = "en-US";
      }
    }
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public start(
    onResult: (text: string, isFinal: boolean) => void,
    onError: (err: any) => void,
    onEnd: () => void
  ): boolean {
    if (!this.recognition) return false;

    try {
      this.recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const text = finalTranscript || interimTranscript;
        onResult(text, Boolean(finalTranscript));
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        onError(event.error);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        onEnd();
      };

      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (err) {
      this.isListening = false;
      onError(err);
      return false;
    }
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.isListening = false;
    }
  }
}
