import { useState, useRef, useEffect } from "react";
import { useCopilot } from "./CopilotContext";
import { useServerFn } from "@tanstack/react-start";
import { chatWithCopilotFn } from "@/lib/copilot.functions";
import type { CopilotChatMessage, CopilotResponse } from "@/lib/copilot.server";
import {
  Sparkles,
  Zap,
  Target,
  X,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
  Key,
  RotateCcw,
  Bot,
  User,
  CheckCircle2,
  Brain,
  Sliders,
  Mic,
  Volume2,
  Pause,
} from "lucide-react";
import { useVoice } from "@/lib/voice.context";

export function GlobalCopilot() {
  const {
    isChatOpen,
    setIsChatOpen,
    activeContext,
    clearContext,
    toggleInspectMode,
    groqApiKey,
    setGroqApiKey,
    pendingPrompt,
    setPendingPrompt,
  } = useCopilot();

  const {
    speak,
    isSpeakingId,
    startListening,
    stopListening,
    listeningState,
    executeVoiceCommand,
  } = useVoice();

  const handleMicToggle = () => {
    if (listeningState === "listening") {
      stopListening();
    } else {
      startListening((text, isFinal) => {
        setInput(text);
        if (isFinal) {
          executeVoiceCommand(text);
        }
      });
    }
  };

  const handleSpeakMessage = (content: string, idx: number) => {
    const id = `msg-${idx}`;
    speak(content, { id });
  };

  const [messages, setMessages] = useState<CopilotChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your **ClauseGraph Legal Intelligence Copilot**, accelerated by **Groq LPU** inference.\n\nYou can ask me anything about your contract portfolio, simulate regulatory shocks, or click the **Inspect Lens (🎯)** to point at any card or contract on the screen to analyze it in depth.",
      suggested_actions: [
        "What is our maximum regulatory exposure right now?",
        "Simulate what happens if breach notice is shortened to 24h",
        "How do I use the Inspect Lens?",
      ],
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(groqApiKey);
  const [expandedThoughtIdx, setExpandedThoughtIdx] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatFn = useServerFn(chatWithCopilotFn);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    setTempApiKey(groqApiKey);
  }, [groqApiKey]);

  useEffect(() => {
    if (pendingPrompt && isChatOpen) {
      setInput(pendingPrompt);
      setPendingPrompt(null);
    }
  }, [pendingPrompt, isChatOpen, setPendingPrompt]);

  // When activeContext changes, add a system notification in chat
  useEffect(() => {
    if (activeContext) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `🎯 **Context Locked on:** *${activeContext.title}* (${activeContext.type.toUpperCase()})\n\nAsk me anything about this specific component. I will ground my reasoning directly on its metadata.`,
          suggested_actions: [
            `What are the critical risks in this ${activeContext.type}?`,
            `Suggest an amendment redline for this item`,
            `Test against Bangladesh Cyber Security Ordinance 2025`,
          ],
          context_ref: activeContext,
        },
      ]);
      setExpandedThoughtIdx(null);
    }
  }, [activeContext]);

  async function handleSend(textToSend?: string) {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: CopilotChatMessage = {
      role: "user",
      content: text,
      context_ref: activeContext ?? undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res: CopilotResponse = await chatFn({
        data: {
          message: text,
          history: messages.slice(-4),
          inspectContext: activeContext,
          userApiKey: groqApiKey || undefined,
        },
      });

      const assistantMsg: CopilotChatMessage = {
        role: "assistant",
        content: res.answer,
        thought_steps: res.thought_steps,
        suggested_actions: res.suggested_actions,
        context_ref: activeContext ?? undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      // Auto expand latest thought
      setExpandedThoughtIdx(messages.length + 1);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **Copilot Error**: ${err?.message || "Failed to process query. Please check your network or Groq API key."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    setGroqApiKey(tempApiKey);
    setShowSettings(false);
  }

  function handleClearHistory() {
    setMessages([
      {
        role: "assistant",
        content: "Chat cleared. What would you like to investigate next?",
        suggested_actions: [
          "Check overall portfolio exposure",
          "Simulate a regulatory amendment",
        ],
      },
    ]);
    clearContext();
  }

  return (
    <>
      {/* ── 1. Floating Launch Trigger Orb (Bottom Right) ── */}
      {!isChatOpen && (
        <button
          type="button"
          id="copilot-floating-trigger"
          title="ClauseGraph AI Copilot (Groq LPU)"
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-50 group flex items-center gap-2.5 rounded-full border border-[var(--brass)]/50 bg-[var(--surface-raised)]/90 px-4 py-3 shadow-[0_0_35px_-5px_rgba(14,164,143,0.5)] backdrop-blur-2xl transition-all duration-300 hover:scale-105 hover:border-[var(--brass)] hover:shadow-[0_0_45px_0_rgba(14,164,143,0.7)] active:scale-95 cursor-pointer"
        >
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brass)] text-black font-bold shadow-[var(--glow-brass)]">
            <Sparkles className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs font-bold text-foreground">ClauseGraph Copilot</span>
              <span className="font-mono text-[9px] font-bold uppercase text-[var(--brass)] bg-[var(--brass)]/15 px-1.5 py-0.2 rounded border border-[var(--brass)]/30">
                Groq LPU
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">Click to ask or press Inspect (🎯)</span>
          </div>
        </button>
      )}

      {/* ── 2. Full Glassmorphic Chat Panel ── */}
      {isChatOpen && (
        <div
          id="global-copilot-panel"
          className="fixed bottom-4 right-4 z-50 flex h-[620px] w-[460px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--shell-bg)]/95 shadow-[var(--shadow-lift)] backdrop-blur-3xl animate-in slide-in-from-bottom-6 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--hairline)] bg-[var(--surface-raised)]/80 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brass)] text-black shadow-[var(--glow-brass)]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-xs font-bold text-foreground">ClauseGraph Copilot</h3>
                  <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-[var(--brass)] bg-[var(--brass)]/10 px-1.5 py-0.5 rounded border border-[var(--brass)]/20">
                    <Zap className="h-2.5 w-2.5" /> Groq LPU
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {groqApiKey ? "Llama 3.3 70B Versatile" : "Built-in Neural Legal Engine"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Inspect Lens Toggle Button */}
              <button
                type="button"
                onClick={toggleInspectMode}
                title="Activate Inspect Lens (Click any card to analyze)"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--hairline)] text-muted-foreground hover:text-[var(--brass)] hover:border-[var(--brass)]/50 transition-colors cursor-pointer"
              >
                <Target className="h-3.5 w-3.5" />
              </button>

              {/* Settings Toggle */}
              <button
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                title="Configure Groq API Key"
                className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors cursor-pointer ${
                  showSettings
                    ? "border-[var(--brass)] text-[var(--brass)] bg-[var(--brass)]/10"
                    : "border-[var(--hairline)] text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sliders className="h-3.5 w-3.5" />
              </button>

              {/* Clear History */}
              <button
                type="button"
                onClick={handleClearHistory}
                title="Reset conversation"
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--hairline)] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--hairline)] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Active Context Banner (If an element was clicked) */}
          {activeContext && (
            <div className="flex items-center justify-between border-b border-[var(--brass)]/30 bg-[var(--brass)]/10 px-4 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <Target className="h-3.5 w-3.5 text-[var(--brass)] shrink-0" />
                <span className="font-mono text-[10px] text-[var(--brass)] font-semibold truncate">
                  Context: {activeContext.title}
                </span>
              </div>
              <button
                type="button"
                onClick={clearContext}
                className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center gap-0.5 shrink-0 ml-2 cursor-pointer"
              >
                Clear <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}

          {/* Settings Tab Modal */}
          {showSettings && (
            <form onSubmit={handleSaveKey} className="border-b border-[var(--hairline)] bg-[var(--surface-raised)] p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Key className="h-4 w-4 text-[var(--brass)]" />
                <span>Custom Groq API Key (Optional)</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Provide your free Groq API key (`gsk_...`) from <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[var(--brass)] underline">console.groq.com</a> for blazing-fast 800+ tokens/sec inference.
              </p>
              <input
                type="password"
                placeholder="gsk_..."
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                className="w-full rounded-lg border border-[var(--hairline)] bg-black/30 px-3 py-1.5 font-mono text-xs text-foreground focus:border-[var(--brass)] focus:outline-none"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="rounded-lg border border-[var(--hairline)] px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--brass)] px-3 py-1 text-xs font-semibold text-black hover:bg-[var(--brass)]/90"
                >
                  Save Key
                </button>
              </div>
            </form>
          )}

          {/* Chat Messages Scrollable Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 premium-scrollbar">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col space-y-1.5 ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                {/* Avatar & Role Tag */}
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                  {m.role === "assistant" ? (
                    <>
                      <Bot className="h-3 w-3 text-[var(--brass)]" />
                      <span className="font-semibold text-[var(--brass)]">Copilot</span>
                      <button
                        type="button"
                        onClick={() => handleSpeakMessage(m.content, idx)}
                        title={isSpeakingId(`msg-${idx}`) ? "Stop reading" : "Read aloud with natural voice"}
                        className="ml-1 p-0.5 rounded text-muted-foreground hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        {isSpeakingId(`msg-${idx}`) ? (
                          <Pause className="h-2.5 w-2.5 text-emerald-400 fill-current animate-pulse" />
                        ) : (
                          <Volume2 className="h-2.5 w-2.5" />
                        )}
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-foreground">You</span>
                      <User className="h-3 w-3 text-muted-foreground" />
                    </>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[92%] rounded-2xl px-4 py-3 text-[12.5px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-[var(--brass)] text-black font-medium rounded-tr-sm"
                      : "border border-[var(--hairline)] bg-[var(--surface-raised)]/70 text-foreground rounded-tl-sm shadow-sm"
                  }`}
                >
                  {/* Collapsible Chain-of-Thought (Reasoning Trace) */}
                  {m.thought_steps && m.thought_steps.length > 0 && (
                    <div className="mb-3 rounded-xl border border-[var(--hairline)] bg-black/40 overflow-hidden text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedThoughtIdx(expandedThoughtIdx === idx ? null : idx)
                        }
                        className="flex w-full items-center justify-between px-3 py-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground bg-white/5 cursor-pointer"
                      >
                        <span className="flex items-center gap-1.5 text-[var(--brass)] font-semibold">
                          <Brain className="h-3 w-3" />
                          <span>Chain-of-Thought Trace ({m.thought_steps.length} steps)</span>
                        </span>
                        {expandedThoughtIdx === idx ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>

                      {expandedThoughtIdx === idx && (
                        <div className="p-2.5 space-y-1.5 font-mono text-[10.5px] border-t border-[var(--hairline)] text-muted-foreground">
                          {m.thought_steps.map((step, sIdx) => (
                            <div key={sIdx} className="flex items-start gap-1.5">
                              <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="leading-tight">{step}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="whitespace-pre-wrap space-y-2 prose-invert text-[12.5px]">
                    {m.content}
                  </div>
                </div>

                {/* Suggested Follow-up Action Chips */}
                {m.suggested_actions && m.suggested_actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 max-w-[95%]">
                    {m.suggested_actions.map((act, aIdx) => (
                      <button
                        key={aIdx}
                        type="button"
                        onClick={() => handleSend(act)}
                        className="rounded-full border border-[var(--hairline)] bg-[var(--surface-glass)] hover:bg-[var(--surface-raised)] hover:border-[var(--brass)]/50 px-2.5 py-1 text-[10.5px] font-mono text-muted-foreground hover:text-foreground transition-all cursor-pointer text-left"
                      >
                        ⚡ {act}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brass)]/20 text-[var(--brass)]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
                <div className="rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)]/40 px-3 py-2 space-y-1">
                  <span className="font-mono text-[10px] text-[var(--brass)] flex items-center gap-1">
                    <Zap className="h-2.5 w-2.5 animate-pulse" /> Groq LPU Reasoning in progress...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="border-t border-[var(--hairline)] bg-[var(--surface-raised)]/90 p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder={
                  activeContext
                    ? `Ask about ${activeContext.title}...`
                    : "Ask Copilot or simulate a shock..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                className="flex-1 rounded-xl border border-[var(--hairline)] bg-black/40 px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--brass)] focus:outline-none transition-all"
              />
              {/* Voice Dictation Button */}
              <button
                type="button"
                onClick={handleMicToggle}
                title={listeningState === "listening" ? "Stop dictating" : "Voice dictation (Speak your query)"}
                className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all shrink-0 cursor-pointer ${
                  listeningState === "listening"
                    ? "border-rose-500 bg-rose-500/25 text-rose-400 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                    : "border-[var(--hairline)] bg-black/40 text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/40"
                }`}
              >
                <Mic className="h-3.5 w-3.5" />
              </button>

              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--brass)] text-black hover:bg-[var(--brass)]/90 disabled:opacity-40 transition-all cursor-pointer shrink-0 shadow-[var(--glow-brass)]"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
