import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
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
  Minimize2,
  MessageSquarePlus,
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
        "Hello! I am your **ClauseGraph Legal Intelligence Copilot**, accelerated by **QUINTESSENCE MINUS INFINITY** inference.\n\nYou can ask me anything about your contract portfolio, simulate regulatory shocks, or click the **Inspect Lens (🎯)** to point at any card or contract on the screen to analyze it in depth.",
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatFn = useServerFn(chatWithCopilotFn);

  // Close on Escape key
  useEffect(() => {
    if (!isChatOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsChatOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isChatOpen, setIsChatOpen]);

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

  const content = (
    <>
      {/* ── 1. Floating Launch Trigger Orb (Bottom Right) ── */}
      {!isChatOpen && (
        <button
          type="button"
          id="copilot-floating-trigger"
          title="ClauseGraph AI Copilot (QUINTESSENCE MINUS INFINITY)"
          onClick={() => setIsChatOpen(true)}
          className="fixed bottom-6 right-6 z-[9999] group flex items-center gap-3 rounded-full border border-[var(--brass)]/40 bg-[var(--shell-bg)]/90 px-4 py-2.5 shadow-[0_12px_40px_-6px_rgba(94,234,212,0.4)] backdrop-blur-2xl transition-all duration-300 hover:scale-[1.05] hover:border-[var(--brass)] hover:shadow-[0_14px_50px_-4px_rgba(94,234,212,0.65)] active:scale-95 cursor-pointer ring-1 ring-white/10"
        >
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[var(--brass)] to-[#14b8a6] text-black font-bold shadow-[var(--glow-brass)]">
            <Sparkles className="h-4 w-4" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-xs font-bold text-foreground">ClauseGraph Copilot</span>
              <span className="font-mono text-[9px] font-bold uppercase text-[var(--brass)] bg-[var(--brass)]/15 px-1.5 py-0.5 rounded-full border border-[var(--brass)]/30">
                QMI
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              Click to chat or press Inspect (🎯)
            </span>
          </div>
        </button>
      )}

      {/* ── 2. Full Glassmorphic Chat Panel ── */}
      {isChatOpen && (
        <>
          {/* Subtle click-outside backdrop to easily exit/close */}
          <div
            onClick={() => setIsChatOpen(false)}
            aria-label="Close Copilot chat"
            className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 animate-in fade-in cursor-pointer sm:bg-black/25"
          />

          <div
            id="global-copilot-panel"
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] flex h-[620px] max-h-[calc(100vh-2.5rem)] w-[460px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[24px] border border-[var(--hairline-strong)] bg-[var(--shell-bg)]/95 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9),0_0_40px_-5px_rgba(94,234,212,0.2)] backdrop-blur-3xl animate-in slide-in-from-bottom-5 fade-in-50 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--hairline)] bg-gradient-to-b from-white/[0.05] via-white/[0.02] to-transparent px-4 py-3 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[var(--brass)] to-[#14b8a6] text-black shadow-[0_0_16px_rgba(94,234,212,0.4)] ring-1 ring-white/20 shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-display text-xs font-bold text-foreground tracking-tight truncate">
                      ClauseGraph Copilot
                    </h3>
                    <span className="inline-flex items-center gap-1 font-mono text-[9px] font-bold text-[var(--brass)] bg-[var(--brass)]/15 px-1.5 py-0.5 rounded-full border border-[var(--brass)]/30 shrink-0">
                      <Zap className="h-2.5 w-2.5 fill-current" /> QUINTESSENCE MINUS INFINITY
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/80 font-mono truncate">
                    {groqApiKey ? "Llama 3.3 70B Versatile" : "Built-in Neural Legal Engine"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-2">
                {/* Inspect Lens Toggle Button */}
                <button
                  type="button"
                  onClick={toggleInspectMode}
                  title="Activate Inspect Lens (Click any card to analyze)"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--hairline)] bg-white/[0.03] text-muted-foreground hover:text-[var(--brass)] hover:border-[var(--brass)]/50 hover:bg-[var(--brass)]/10 transition-all cursor-pointer"
                >
                  <Target className="h-3.5 w-3.5" />
                </button>

                {/* Settings Toggle */}
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  title="Configure Groq API Key"
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                    showSettings
                      ? "border-[var(--brass)] text-[var(--brass)] bg-[var(--brass)]/15 shadow-[0_0_12px_rgba(94,234,212,0.25)]"
                      : "border-[var(--hairline)] bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/[0.06]"
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                </button>

                {/* Clear History */}
                <button
                  type="button"
                  onClick={handleClearHistory}
                  title="Reset conversation"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--hairline)] bg-white/[0.03] text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-all cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>

                {/* Prominent Exit / Close Button */}
                <button
                  type="button"
                  onClick={() => setIsChatOpen(false)}
                  title="Close Copilot (Esc)"
                  aria-label="Close Copilot"
                  className="group/close flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/25 px-2 py-1 text-rose-300 hover:text-rose-100 transition-all cursor-pointer shadow-sm ml-0.5"
                >
                  <X className="h-3.5 w-3.5 group-hover/close:rotate-90 transition-transform duration-200" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider hidden sm:inline">Close</span>
                </button>
              </div>
            </div>

            {/* Active Context Banner (If an element was clicked) */}
            {activeContext && (
              <div className="flex items-center justify-between border-b border-[var(--brass)]/30 bg-gradient-to-r from-[var(--brass)]/15 via-[var(--brass)]/8 to-transparent px-4 py-2 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brass)]/20 text-[var(--brass)] shrink-0 ring-1 ring-[var(--brass)]/40">
                    <Target className="h-3 w-3" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-[var(--brass)] bg-[var(--brass)]/20 px-1 rounded">
                        {activeContext.type}
                      </span>
                      <span className="text-[11px] font-medium text-foreground truncate">
                        {activeContext.title}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearContext}
                  className="text-[10px] font-mono text-muted-foreground hover:text-rose-400 flex items-center gap-1 shrink-0 ml-3 py-0.5 px-1.5 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  Dismiss <X className="h-2.5 w-2.5" />
                </button>
              </div>
            )}

            {/* Settings Tab Modal */}
            {showSettings && (
              <form onSubmit={handleSaveKey} className="border-b border-[var(--hairline)] bg-[var(--shell-secondary)]/95 backdrop-blur-xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                    <div className="p-1 rounded-md bg-[var(--brass)]/15 text-[var(--brass)]">
                      <Key className="h-3.5 w-3.5" />
                    </div>
                    <span>Custom Groq API Key</span>
                  </div>
                  <span className="font-mono text-[9px] text-[var(--brass)] bg-[var(--brass)]/10 px-2 py-0.5 rounded-full border border-[var(--brass)]/20">
                    Fast Inference
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Provide your free Groq API key (`gsk_...`) from <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[var(--brass)] underline underline-offset-2 hover:opacity-80">console.groq.com</a> for ultra-low latency legal inference.
                </p>
                <input
                  type="password"
                  placeholder="gsk_..."
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  className="w-full rounded-xl border border-[var(--hairline)] bg-black/40 px-3.5 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-[var(--brass)] focus:ring-1 focus:ring-[var(--brass)]/40 focus:outline-none transition-all shadow-inner"
                />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    className="rounded-lg border border-[var(--hairline)] px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-[var(--brass)] px-3.5 py-1.5 text-xs font-semibold text-black hover:brightness-110 active:scale-95 transition-all shadow-[var(--glow-brass)] cursor-pointer"
                  >
                    Save Key
                  </button>
                </div>
              </form>
            )}

            {/* Chat Messages Scrollable Area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5 premium-scrollbar bg-gradient-to-b from-transparent via-black/10 to-black/25">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col space-y-2 group ${
                    m.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {/* Header Tag above bubble */}
                  <div className="flex items-center gap-2 px-1 text-[11px] font-mono text-muted-foreground">
                    {m.role === "assistant" ? (
                      <>
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--brass)]/20 text-[var(--brass)] ring-1 ring-[var(--brass)]/40">
                          <Bot className="h-3 w-3" />
                        </div>
                        <span className="font-semibold text-[var(--brass)] tracking-wide">ClauseGraph Copilot</span>
                        <button
                          type="button"
                          onClick={() => handleSpeakMessage(m.content, idx)}
                          title={isSpeakingId(`msg-${idx}`) ? "Stop reading" : "Read aloud with natural voice"}
                          className="ml-1 p-1 rounded-md text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer opacity-80 group-hover:opacity-100"
                        >
                          {isSpeakingId(`msg-${idx}`) ? (
                            <Pause className="h-3 w-3 text-emerald-400 fill-current animate-pulse" />
                          ) : (
                            <Volume2 className="h-3 w-3" />
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-foreground/80">You</span>
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/10 text-foreground ring-1 ring-white/20">
                          <User className="h-3 w-3" />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`relative max-w-[90%] rounded-2xl px-4 py-3.5 text-[13px] leading-relaxed transition-all ${
                      m.role === "user"
                        ? "bg-gradient-to-br from-[var(--brass)] to-[#14b8a6] text-black font-medium shadow-[0_8px_20px_-6px_rgba(94,234,212,0.4)] rounded-tr-sm"
                        : "border border-[var(--hairline-strong)] bg-[var(--surface-raised)]/90 text-foreground rounded-tl-sm shadow-[0_4px_24px_-4px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                    }`}
                  >
                    {/* Collapsible Chain-of-Thought (Reasoning Trace) */}
                    {m.thought_steps && m.thought_steps.length > 0 && (
                      <div className="mb-3.5 rounded-xl border border-[var(--hairline)] bg-black/40 backdrop-blur-md overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedThoughtIdx(expandedThoughtIdx === idx ? null : idx)
                          }
                          className="flex w-full items-center justify-between px-3.5 py-2 font-mono text-[11px] text-muted-foreground hover:text-foreground bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2 text-[var(--brass)] font-semibold">
                            <Brain className="h-3.5 w-3.5 animate-pulse" />
                            <span>Chain-of-Thought Trace ({m.thought_steps.length} steps)</span>
                          </span>
                          {expandedThoughtIdx === idx ? (
                            <ChevronUp className="h-3.5 w-3.5 text-[var(--brass)]" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>

                        {expandedThoughtIdx === idx && (
                          <div className="p-3 space-y-2 font-mono text-[11px] border-t border-[var(--hairline)] text-foreground/80 bg-black/20">
                            {m.thought_steps.map((step, sIdx) => (
                              <div key={sIdx} className="flex items-start gap-2 bg-white/[0.02] p-1.5 rounded-lg border border-white/[0.04]">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                                <span className="leading-snug">{step}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Body Content with formatted rendering */}
                    <div className={`space-y-2.5 text-[13px] ${m.role === "user" ? "text-slate-950 font-normal" : "text-foreground"}`}>
                      {m.content.split("\n\n").map((paragraph, pIdx) => {
                        // Format bold tokens **text** and bullet items
                        const formatted = paragraph.split(/(\*\*.*?\*\*)/g).map((chunk, cIdx) => {
                          if (chunk.startsWith("**") && chunk.endsWith("**")) {
                            return (
                              <strong
                                key={cIdx}
                                className={
                                  m.role === "user"
                                    ? "font-bold text-black"
                                    : "font-semibold text-[var(--brass)] drop-shadow-[0_0_8px_rgba(94,234,212,0.25)]"
                                }
                              >
                                {chunk.slice(2, -2)}
                              </strong>
                            );
                          }
                          return chunk;
                        });

                        if (paragraph.startsWith("- ") || paragraph.startsWith("• ")) {
                          return (
                            <div key={pIdx} className="flex items-start gap-2 pl-1">
                              <span className={`inline-block h-1.5 w-1.5 rounded-full mt-2 shrink-0 ${m.role === "user" ? "bg-black" : "bg-[var(--brass)]"}`} />
                              <div className="leading-relaxed">{formatted}</div>
                            </div>
                          );
                        }

                        return (
                          <p key={pIdx} className="leading-relaxed whitespace-pre-wrap">
                            {formatted}
                          </p>
                        );
                      })}
                    </div>
                  </div>

                  {/* Suggested Follow-up Action Chips */}
                  {m.suggested_actions && m.suggested_actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 max-w-[95%]">
                      {m.suggested_actions.map((act, aIdx) => (
                        <button
                          key={aIdx}
                          type="button"
                          onClick={() => handleSend(act)}
                          className="group flex items-center gap-1.5 rounded-xl border border-[var(--hairline-strong)] bg-white/[0.04] hover:bg-[var(--brass)]/15 hover:border-[var(--brass)]/60 px-3 py-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-all duration-200 cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(94,234,212,0.15)] hover:scale-[1.02] active:scale-98 text-left"
                        >
                          <Zap className="h-3 w-3 text-[var(--brass)] group-hover:scale-110 transition-transform" />
                          <span className="leading-tight">{act}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-start gap-3 text-xs text-muted-foreground animate-in fade-in-50 duration-300">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brass)]/20 text-[var(--brass)] ring-1 ring-[var(--brass)]/40 shadow-[0_0_12px_rgba(94,234,212,0.3)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="rounded-2xl border border-[var(--hairline-strong)] bg-[var(--surface-raised)]/80 px-4 py-2.5 backdrop-blur-xl shadow-lg">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brass)] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--brass)]"></span>
                      </span>
                      <span className="font-mono text-[11px] font-medium text-[var(--brass)]">
                        QUINTESSENCE MINUS INFINITY reasoning across legal graph...
                      </span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Bar */}
            <div className="border-t border-[var(--hairline)] bg-[var(--shell-bg)]/95 backdrop-blur-2xl p-3 sm:p-3.5 shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="relative flex items-center gap-2 rounded-2xl border border-[var(--hairline-strong)] bg-black/40 p-1.5 transition-all focus-within:border-[var(--brass)] focus-within:ring-2 focus-within:ring-[var(--brass)]/20 shadow-inner"
              >
                <input
                  type="text"
                  placeholder={
                    activeContext
                      ? `Ask about ${activeContext.title}...`
                      : "Ask Copilot or simulate regulatory shocks..."
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  className="flex-1 bg-transparent px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all"
                />

                <div className="flex items-center gap-1.5 pr-0.5">
                  {/* Voice Dictation Button */}
                  <button
                    type="button"
                    onClick={handleMicToggle}
                    title={listeningState === "listening" ? "Stop dictating" : "Voice dictation (Speak your query)"}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all shrink-0 cursor-pointer ${
                      listeningState === "listening"
                        ? "border-rose-500 bg-rose-500/25 text-rose-400 animate-pulse shadow-[0_0_14px_rgba(244,63,94,0.5)]"
                        : "border-[var(--hairline)] bg-white/[0.04] text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/10"
                    }`}
                  >
                    <Mic className="h-3.5 w-3.5" />
                  </button>

                  {/* Send Button */}
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brass)] to-[#0d9488] text-black hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer shrink-0 shadow-[0_0_15px_rgba(94,234,212,0.35)]"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-black" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </form>
              <div className="flex items-center justify-between px-2 pt-2 text-[10px] text-muted-foreground/70 font-mono">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                  Groq 800+ tok/s
                </span>
                <span>Press 🎯 to inspect &middot; Esc to close</span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );

  if (!isMounted) return null;
  return createPortal(content, document.body);
}

