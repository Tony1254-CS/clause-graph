import { useEffect } from "react";
import { useCopilot } from "./CopilotContext";
import { Target, X, Sparkles } from "lucide-react";

export function InspectLensOverlay() {
  const { isInspectModeActive, setInspectModeActive, openWithContext } = useCopilot();

  useEffect(() => {
    if (!isInspectModeActive) return;

    function handleGlobalClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Don't intercept clicks inside the lens overlay itself
      if (target.closest("#copilot-lens-banner") || target.closest("#global-copilot-panel")) {
        return;
      }

      // Check if target or any ancestor has data-copilot-context
      const element = target.closest("[data-copilot-context]") as HTMLElement | null;
      if (element) {
        e.preventDefault();
        e.stopPropagation();

        const raw = element.getAttribute("data-copilot-context");
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            openWithContext(parsed);
          } catch (err) {
            console.error("Failed to parse copilot context:", err);
          }
        }
      } else {
        // Fallback: check if clicking on common card classes
        const card = target.closest(".glass-panel, .glass-card, [role='region'], article, section") as HTMLElement | null;
        if (card) {
          const heading = card.querySelector("h1, h2, h3, h4, [class*='title']")?.textContent?.trim() || "Inspected Component";
          openWithContext({
            type: "general",
            title: heading,
            data: { textSnippet: card.innerText.slice(0, 300) },
          });
        }
      }
    }

    document.addEventListener("click", handleGlobalClick, { capture: true });
    return () => document.removeEventListener("click", handleGlobalClick, { capture: true });
  }, [isInspectModeActive, openWithContext]);

  if (!isInspectModeActive) return null;

  return (
    <>
      {/* Top Floating Banner */}
      <div
        id="copilot-lens-banner"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-full border border-[var(--brass)] bg-[var(--surface-raised)]/90 px-5 py-2.5 shadow-[0_10px_35px_-5px_rgba(14,164,143,0.5)] backdrop-blur-2xl animate-in slide-in-from-top duration-200"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brass)]/20 text-[var(--brass)] shadow-[var(--glow-brass)]">
          <Target className="h-4 w-4 animate-spin" style={{ animationDuration: "6s" }} />
        </div>
        <div>
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--brass)] flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> AI Context Lens Active
          </span>
          <p className="text-[11px] text-foreground font-medium">
            Click any card, contract, or badge to analyze with Groq AI
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInspectModeActive(false)}
          className="ml-2 inline-flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-white/5 hover:bg-white/10 px-2.5 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="h-3 w-3" />
          <span>Exit (Esc)</span>
        </button>
      </div>

      {/* Global CSS for inspect highlights */}
      <style>{`
        body {
          cursor: crosshair !important;
        }
        [data-copilot-context], .glass-panel, .glass-card {
          transition: outline 0.15s ease, box-shadow 0.15s ease !important;
        }
        [data-copilot-context]:hover, .glass-panel:hover, .glass-card:hover {
          outline: 2px solid var(--brass) !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 20px -2px rgba(14, 164, 143, 0.4) !important;
          position: relative;
        }
      `}</style>
    </>
  );
}
