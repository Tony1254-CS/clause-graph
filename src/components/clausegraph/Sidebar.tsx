import { useState, useCallback } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileText, Rss, Zap, ListChecks, ShieldCheck, Users, Wallet, UserCog, Radar, FlaskConical, Network } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to: "/dashboard" | "/contracts" | "/feed" | "/simulate" | "/supply-chain" | "/backtest" | "/actions" | "/predictive" | "/what-if" | "/settings/team" | "/settings/billing" | "/settings/account";
  match?: string;
};

const NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Contracts", icon: FileText, to: "/contracts", match: "/contracts" },
  { label: "Regulatory Feed", icon: Rss, to: "/feed" },
  { label: "Simulate Impact", icon: Zap, to: "/simulate" },
  { label: "Supply Chain", icon: Network, to: "/supply-chain" },
  { label: "Predictive Radar", icon: Radar, to: "/predictive", match: "/predictive" },
  { label: "What-If Sandbox", icon: FlaskConical, to: "/what-if" },
  { label: "Backtest", icon: ShieldCheck, to: "/backtest" },
  { label: "Action Plans", icon: ListChecks, to: "/actions" },
  { label: "Team", icon: Users, to: "/settings/team", match: "/settings/team" },
  { label: "Billing", icon: Wallet, to: "/settings/billing", match: "/settings/billing" },
  { label: "Account", icon: UserCog, to: "/settings/account", match: "/settings/account" },
];

function useIsActive(item: NavItem) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = item.match ?? item.to;
  return pathname === base || pathname.startsWith(base + "/");
}

function NavRow({ item, expanded }: { item: NavItem; expanded: boolean }) {
  const isActive = useIsActive(item);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-label={item.label}
      className={`group relative flex items-center gap-3 rounded-[12px] h-10 px-3 text-[13.5px] outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-brass/60 ${
        isActive
          ? "bg-[rgba(201,166,107,0.08)] text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.03)]"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 transition-colors ${
          isActive ? "text-brass" : "text-muted-foreground group-hover:text-foreground"
        }`}
        strokeWidth={1.6}
      />
      <span
        className={`flex-1 whitespace-nowrap text-left transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
          expanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1 pointer-events-none"
        }`}
      >
        {item.label}
      </span>
      {isActive && expanded && <span className="h-1 w-1 rounded-full bg-brass" />}
      {isActive && !expanded && (
        <span className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-brass" />
      )}
    </Link>
  );
}

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);

  const open = useCallback(() => setExpanded(true), []);
  const close = useCallback(() => setExpanded(false), []);
  const handleBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setExpanded(false);
  }, []);

  return (
    <>
      {/* Rail spacer — reserves 64px, keeps layout stable */}
      <div className="hidden md:block w-16 shrink-0" aria-hidden />

      {/* Floating rail — expands on hover/focus */}
      <aside
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={handleBlur}
        data-expanded={expanded}
        className={`glass-panel hidden md:flex fixed left-4 sm:left-6 top-6 bottom-6 z-30 flex-col py-6 gap-6 overflow-hidden transition-[width] duration-200 ease-out motion-reduce:transition-none ${
          expanded ? "w-[240px] px-4" : "w-16 px-3"
        }`}
      >
        <Link
          to="/dashboard"
          className="flex items-center gap-2.5 h-8 outline-none rounded-md focus-visible:ring-2 focus-visible:ring-brass/60"
        >
          <div className="h-8 w-8 shrink-0 rounded-full border border-[var(--hairline-strong)] grid place-items-center">
            <div className="h-2 w-2 rounded-full bg-brass" />
          </div>
          <span
            className={`font-display text-[19px] tracking-tight text-foreground whitespace-nowrap transition-opacity duration-200 motion-reduce:transition-none ${
              expanded ? "opacity-100" : "opacity-0"
            }`}
          >
            ClauseGraph
          </span>
        </Link>

        <nav className="flex flex-col gap-1">
          <p
            className={`font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-2 px-3 whitespace-nowrap transition-opacity duration-200 motion-reduce:transition-none ${
              expanded ? "opacity-100" : "opacity-0"
            }`}
          >
            Workspace
          </p>
          {NAV.map((item) => (
            <NavRow key={item.to} item={item} expanded={expanded} />
          ))}
        </nav>

        <div
          className={`mt-auto rounded-[12px] border border-[var(--hairline)] p-4 transition-opacity duration-200 motion-reduce:transition-none ${
            expanded ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground whitespace-nowrap">
            Jurisdiction
          </p>
          <p className="mt-1.5 font-display text-[15px] text-foreground whitespace-nowrap">United States</p>
          <p className="font-mono text-[11px] text-muted-foreground mt-0.5 whitespace-nowrap">SEC · FINRA · CFTC</p>
        </div>
      </aside>
    </>
  );
}

export function MobileRail() {
  return (
    <aside className="glass-panel md:hidden flex w-14 shrink-0 flex-col items-center py-4 gap-3 h-[calc(100dvh-48px)] sticky top-6">
      <Link
        to="/dashboard"
        className="h-8 w-8 rounded-full border border-[var(--hairline-strong)] grid place-items-center"
        aria-label="ClauseGraph home"
      >
        <div className="h-2 w-2 rounded-full bg-brass" />
      </Link>
      <div className="flex flex-col gap-1.5 mt-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="h-10 w-10 grid place-items-center rounded-[12px] text-muted-foreground hover:text-foreground hover:bg-[rgba(255,255,255,0.03)] outline-none focus-visible:ring-2 focus-visible:ring-brass/60 duration-150 ease-out transition-all"
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
