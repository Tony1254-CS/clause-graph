import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import type {
  VoiceSettings,
  PlaybackState,
  ListeningState,
  SpeakOptions,
} from "./voice.types";
import {
  chunkTextIntoSentences,
  getAvailableNaturalVoices,
  selectVoiceForPersona,
  SpeechRecognitionSession,
} from "./voice.service";

interface VoiceContextValue {
  speak: (text: string, options?: SpeakOptions) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  playbackState: PlaybackState;
  activeSpeechId: string | null;
  currentSpeechText: string | null;
  isSpeakingId: (id: string) => boolean;

  startListening: (onResult?: (text: string, isFinal: boolean) => void) => boolean;
  stopListening: () => void;
  listeningState: ListeningState;
  transcript: string;

  voiceSettings: VoiceSettings;
  updateVoiceSettings: (settings: Partial<VoiceSettings>) => void;
  availableVoices: SpeechSynthesisVoice[];
  isSpeechSupported: boolean;
  isMicSupported: boolean;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

const STORAGE_KEY_VOICE = "clausegraph_voice_settings_v1";

const DEFAULT_SETTINGS: VoiceSettings = {
  persona: "executive_female",
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  autoReadCopilotReplies: false,
};

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_VOICE);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);
  const [currentSpeechText, setCurrentSpeechText] = useState<string | null>(null);

  const [listeningState, setListeningState] = useState<ListeningState>("idle");
  const [transcript, setTranscript] = useState("");

  const speechSessionRef = useRef<SpeechRecognitionSession | null>(null);
  const queueRef = useRef<string[]>([]);
  const queueIndexRef = useRef<number>(0);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const optionsRef = useRef<SpeakOptions | undefined>(undefined);

  // Discover voices on mount
  useEffect(() => {
    getAvailableNaturalVoices().then((voices) => {
      setAvailableVoices(voices);
    });
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_VOICE, JSON.stringify(voiceSettings));
    } catch {
      // ignore
    }
  }, [voiceSettings]);

  const isSpeechSupported = useMemo(() => {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }, []);

  const isMicSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    );
  }, []);

  // Stop function
  const stop = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    queueRef.current = [];
    queueIndexRef.current = 0;
    currentUtteranceRef.current = null;
    setPlaybackState("idle");
    setActiveSpeechId(null);
    setCurrentSpeechText(null);
  }, []);

  // Play next sentence in queue
  const playNextChunk = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setPlaybackState("idle");
      return;
    }

    if (queueIndexRef.current >= queueRef.current.length) {
      // Finished all chunks
      stop();
      optionsRef.current?.onEnd?.();
      return;
    }

    const chunk = queueRef.current[queueIndexRef.current];
    queueIndexRef.current += 1;

    const utterance = new SpeechSynthesisUtterance(chunk);
    currentUtteranceRef.current = utterance;

    // Configure voice properties
    const chosenVoice = selectVoiceForPersona(
      availableVoices,
      voiceSettings.persona,
      voiceSettings.selectedVoiceName
    );

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.rate = optionsRef.current?.rate ?? voiceSettings.rate;
    utterance.pitch = optionsRef.current?.pitch ?? voiceSettings.pitch;
    utterance.volume = voiceSettings.volume;

    utterance.onend = () => {
      playNextChunk();
    };

    utterance.onerror = (e) => {
      console.warn("[VoiceService] Chunk synthesis error:", e);
      optionsRef.current?.onError?.(e);
      playNextChunk();
    };

    setPlaybackState("speaking");
    window.speechSynthesis.speak(utterance);
  }, [availableVoices, voiceSettings, stop]);

  // Main Speak function
  const speak = useCallback(
    (text: string, options?: SpeakOptions) => {
      if (!isSpeechSupported || !text) return;

      // If already speaking the same id, toggle stop
      if (options?.id && activeSpeechId === options.id && playbackState === "speaking") {
        stop();
        return;
      }

      // Stop any current playback
      stop();

      const chunks = chunkTextIntoSentences(text);
      if (chunks.length === 0) return;

      queueRef.current = chunks;
      queueIndexRef.current = 0;
      optionsRef.current = options;
      setActiveSpeechId(options?.id || `speech-${Date.now()}`);
      setCurrentSpeechText(text);

      options?.onStart?.();
      playNextChunk();
    },
    [isSpeechSupported, activeSpeechId, playbackState, stop, playNextChunk]
  );

  const pause = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.pause();
      setPlaybackState("paused");
    }
  }, []);

  const resume = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.resume();
      setPlaybackState("speaking");
    }
  }, []);

  const isSpeakingId = useCallback(
    (id: string) => {
      return activeSpeechId === id && playbackState === "speaking";
    },
    [activeSpeechId, playbackState]
  );

  // Speech-to-Text (Mic Dictation)
  const startListening = useCallback(
    (onResultCallback?: (text: string, isFinal: boolean) => void): boolean => {
      if (!isMicSupported) return false;

      // If already speaking, pause audio during speech input
      if (playbackState === "speaking") {
        pause();
      }

      if (!speechSessionRef.current) {
        speechSessionRef.current = new SpeechRecognitionSession();
      }

      setListeningState("listening");
      setTranscript("");

      const started = speechSessionRef.current.start(
        (text, isFinal) => {
          setTranscript(text);
          onResultCallback?.(text, isFinal);
        },
        (err) => {
          console.warn("[SpeechRecognition Error]:", err);
          setListeningState("error");
          setTimeout(() => setListeningState("idle"), 2500);
        },
        () => {
          setListeningState("idle");
        }
      );

      if (!started) {
        setListeningState("error");
      }

      return started;
    },
    [isMicSupported, playbackState, pause]
  );

  const stopListening = useCallback(() => {
    if (speechSessionRef.current) {
      speechSessionRef.current.stop();
    }
    setListeningState("idle");
  }, []);

  const updateVoiceSettings = useCallback((settings: Partial<VoiceSettings>) => {
    setVoiceSettings((prev) => ({ ...prev, ...settings }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      if (speechSessionRef.current) {
        speechSessionRef.current.stop();
      }
    };
  }, [stop]);

  const value = useMemo(
    () => ({
      speak,
      stop,
      pause,
      resume,
      playbackState,
      activeSpeechId,
      currentSpeechText,
      isSpeakingId,
      startListening,
      stopListening,
      listeningState,
      transcript,
      voiceSettings,
      updateVoiceSettings,
      availableVoices,
      isSpeechSupported,
      isMicSupported,
    }),
    [
      speak,
      stop,
      pause,
      resume,
      playbackState,
      activeSpeechId,
      currentSpeechText,
      isSpeakingId,
      startListening,
      stopListening,
      listeningState,
      transcript,
      voiceSettings,
      updateVoiceSettings,
      availableVoices,
      isSpeechSupported,
      isMicSupported,
    ]
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error("useVoice must be used within a VoiceProvider");
  }
  return ctx;
}
