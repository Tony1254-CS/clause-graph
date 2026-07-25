import { Zap, ChevronDown } from "lucide-react";

export function TopBar() {
  return (
    <header className="glass-panel flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Client Portfolio
          </span>
          <button className="flex items-center gap-2 text-left group">
            <span className="font-display text-[22px] leading-none tracking-tight text-foreground truncate">
              Meridian Capital Partners
            </span>
            <ChevronDown
              className="h-4 w-4 text-muted-foreground group-hover:text-brass transition-colors"
              strokeWidth={1.6}
            />
          </button>
        </div>

        <div className="hidden md:flex items-center gap-2 pl-4 ml-2 border-l border-[var(--hairline)]">
          <span className="h-1.5 w-1.5 rounded-full bg-brass shadow-[0_0_8px_var(--brass)]" />
          <span className="font-mono text-[11px] text-muted-foreground">
            <span className="text-foreground">247</span> active contracts monitored
          </span>
        </div>
      </div>

      <button
        className="group inline-flex items-center gap-2 rounded-[12px] bg-brass px-5 py-2.5 text-[13px] font-medium text-[color:var(--primary-foreground)] transition-all duration-150 ease-out hover:bg-[color:var(--brass-strong)] active:scale-[0.98] shadow-[0_0_24px_-6px_rgba(201,166,107,0.4)]"
      >
        <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />
        Simulate Impact
      </button>
    </header>
  );
}
