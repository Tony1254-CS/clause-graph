import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { CopilotInspectContext } from "@/lib/copilot.server";

interface CopilotContextType {
  isInspectModeActive: boolean;
  toggleInspectMode: () => void;
  setInspectModeActive: (active: boolean) => void;
  activeContext: CopilotInspectContext | null;
  setActiveContext: (ctx: CopilotInspectContext | null) => void;
  openWithContext: (ctx: CopilotInspectContext) => void;
  clearContext: () => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  pendingPrompt: string | null;
  setPendingPrompt: (prompt: string | null) => void;
  openWithPrompt: (prompt: string, ctx?: CopilotInspectContext) => void;
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

const GROQ_KEY_STORAGE = "clausegraph_groq_api_key";

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [isInspectModeActive, setInspectModeActive] = useState(false);
  const [activeContext, setActiveContext] = useState<CopilotInspectContext | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [groqApiKey, setGroqApiKeyState] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem(GROQ_KEY_STORAGE) || "";
      setGroqApiKeyState(savedKey);
    }
  }, []);

  const setGroqApiKey = useCallback((key: string) => {
    setGroqApiKeyState(key);
    if (typeof window !== "undefined") {
      if (key) {
        localStorage.setItem(GROQ_KEY_STORAGE, key.trim());
      } else {
        localStorage.removeItem(GROQ_KEY_STORAGE);
      }
    }
  }, []);

  const toggleInspectMode = useCallback(() => {
    setInspectModeActive((prev) => !prev);
  }, []);

  const openWithContext = useCallback((ctx: CopilotInspectContext) => {
    setActiveContext(ctx);
    setIsChatOpen(true);
    setInspectModeActive(false);
  }, []);

  const openWithPrompt = useCallback(
    (prompt: string, ctx?: CopilotInspectContext) => {
      if (ctx) setActiveContext(ctx);
      setPendingPrompt(prompt);
      setIsChatOpen(true);
      setInspectModeActive(false);
    },
    []
  );

  const clearContext = useCallback(() => {
    setActiveContext(null);
  }, []);

  // Keyboard shortcut: Escape exits inspect mode
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isInspectModeActive) {
        setInspectModeActive(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isInspectModeActive]);

  return (
    <CopilotContext.Provider
      value={{
        isInspectModeActive,
        toggleInspectMode,
        setInspectModeActive,
        activeContext,
        setActiveContext,
        openWithContext,
        clearContext,
        isChatOpen,
        setIsChatOpen,
        pendingPrompt,
        setPendingPrompt,
        openWithPrompt,
        groqApiKey,
        setGroqApiKey,
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
}

export function useCopilot() {
  const context = useContext(CopilotContext);
  if (!context) {
    throw new Error("useCopilot must be used within a CopilotProvider");
  }
  return context;
}
