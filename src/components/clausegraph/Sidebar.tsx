import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Rss, Zap, ListChecks, ShieldCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: "/dashboard" | "/contracts" | "/feed" | "/simulate" | "/backtest" | "/actions" | "/settings/team";
  match?: string;
};

const NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Contracts", icon: FileText, to: "/contracts", match: "/contracts" },
  { label: "Regulatory Feed", icon: Rss, to: "/feed" },
  { label: "Simulate Impact", icon: Zap, to: "/simulate" },
  { label: "Backtest", icon: ShieldCheck, to: "/backtest" },
  { label: "Action Plans", icon: ListChecks, to: "/actions" },
  { label: "Team", icon: Users, to: "/settings/team", match: "/settings" },
];


function useIsActive(item: NavItem) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = item.match ?? item.to;
  return pathname === base || pathname.startsWith(base + "/");
}

function NavRow({ item }: { item: NavItem }) {
  const isActive = useIsActive(item);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
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
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="glass-panel hidden lg:flex w-[240px] shrink-0 flex-col p-6 gap-8 h-[calc(100vh-48px)] sticky top-6">
      <Link to="/dashboard" className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full border border-[var(--hairline-strong)] grid place-items-center">
          <div className="h-2 w-2 rounded-full bg-brass" />
        </div>
        <span className="font-display text-[19px] tracking-tight text-foreground">
          ClauseGraph
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-2 px-3">
          Workspace
        </p>
        {NAV.map((item) => (
          <NavRow key={item.to} item={item} />
        ))}
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
      <Link
        to="/dashboard"
        className="h-8 w-8 rounded-full border border-[var(--hairline-strong)] grid place-items-center"
      >
        <div className="h-2 w-2 rounded-full bg-brass" />
      </Link>
      <div className="flex flex-col gap-2 mt-4">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="h-10 w-10 grid place-items-center rounded-[12px] text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.03)] duration-150 ease-out transition-all"
              aria-label={item.label}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
