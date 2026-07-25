import { LayoutDashboard, FileText, Rss, Zap, ListChecks } from "lucide-react";
import { useState } from "react";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "contracts", label: "Contracts", icon: FileText },
  { id: "feed", label: "Regulatory Feed", icon: Rss },
  { id: "simulate", label: "Simulate Impact", icon: Zap },
  { id: "actions", label: "Action Plans", icon: ListChecks },
];

export function Sidebar() {
  const [active, setActive] = useState("dashboard");

  return (
    <aside className="glass-panel hidden lg:flex w-[240px] shrink-0 flex-col p-6 gap-8 h-[calc(100vh-48px)] sticky top-6">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full border border-[var(--hairline-strong)] grid place-items-center">
          <div className="h-2 w-2 rounded-full bg-brass" />
        </div>
        <span className="font-display text-[19px] tracking-tight text-foreground">
          ClauseGraph
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-2 px-3">
          Workspace
        </p>
        {NAV.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`group flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13.5px] transition-all duration-150 ease-out ${
                isActive
                  ? "bg-[rgba(201,166,107,0.08)] text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.03)]"
              }`}
            >
              <Icon
                className={`h-4 w-4 transition-colors ${
                  isActive ? "text-brass" : "text-muted-foreground group-hover:text-foreground"
                }`}
                strokeWidth={1.6}
              />
              <span className="flex-1 text-left">{item.label}</span>
              {isActive && <span className="h-1 w-1 rounded-full bg-brass" />}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-[12px] border border-[var(--hairline)] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Jurisdiction
        </p>
        <p className="mt-1.5 font-display text-[15px] text-foreground">United States</p>
        <p className="font-mono text-[11px] text-muted-foreground mt-0.5">SEC · FINRA · CFTC</p>
      </div>
    </aside>
  );
}

export function MobileRail() {
  return (
    <aside className="glass-panel lg:hidden flex w-16 shrink-0 flex-col items-center py-6 gap-4 h-[calc(100vh-48px)] sticky top-6">
      <div className="h-8 w-8 rounded-full border border-[var(--hairline-strong)] grid place-items-center">
        <div className="h-2 w-2 rounded-full bg-brass" />
      </div>
      <div className="flex flex-col gap-2 mt-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className="h-10 w-10 grid place-items-center rounded-[10px] text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.03)] transition-all duration-150"
              aria-label={item.label}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
            </button>
          );
        })}
      </div>
    </aside>
  );
}
