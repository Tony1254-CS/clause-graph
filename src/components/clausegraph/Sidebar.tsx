import { useRef, useState, type FocusEvent } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  Rss,
  Zap,
  ListChecks,
  ShieldCheck,
  Users,
  Wallet,
  UserCog,
  Radar,
  FlaskConical,
  Network,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to:
    | "/dashboard"
    | "/contracts"
    | "/feed"
    | "/simulate"
    | "/supply-chain"
    | "/backtest"
    | "/actions"
    | "/predictive"
    | "/what-if"
    | "/settings/team"
    | "/settings/billing"
    | "/settings/account";
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

function RailIcon({ item, expanded }: { item: NavItem; expanded: boolean }) {
  const isActive = useIsActive(item);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-label={item.label}
      title={item.label}
      className={`group relative grid h-9 min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center rounded-[12px] border transition-all duration-200 ease-out ${
        isActive
          ? "border-[var(--hairline-strong)] bg-[var(--surface-glass-strong)] text-[var(--ink)]"
          : "border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-glass)] hover:text-[var(--ink)]"
      }`}
    >
      <span className="grid h-9 w-11 shrink-0 place-items-center">
        <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
      </span>
      <span
        className={`min-w-0 truncate pr-4 text-[13px] font-medium transition-all duration-200 ${
          expanded ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-2 opacity-0"
        }`}
      >
        {item.label}
      </span>
    </Link>
  );
}

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);

  function onBlur(e: FocusEvent<HTMLElement>) {
    const next = e.relatedTarget;
    if (next instanceof Node && asideRef.current?.contains(next)) return;
    setExpanded(false);
  }

  return (
    <div className="relative hidden w-[68px] shrink-0 md:block">
      <aside
        ref={asideRef}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={onBlur}
        className={`absolute inset-y-0 left-0 z-30 flex flex-col border-r border-[var(--hairline)] bg-[var(--sidebar)] px-3 py-4 shadow-[var(--shadow-lift)] transition-[width] duration-200 ease-out ${
          expanded ? "w-[248px]" : "w-[68px]"
        }`}
      >
        <Link
          to="/dashboard"
          aria-label="ClauseGraph home"
          className="mb-3 grid h-10 min-w-0 grid-cols-[44px_minmax(0,1fr)] items-center rounded-[12px] text-[var(--ink)] transition-colors duration-200 hover:bg-[var(--surface-glass)]"
        >
          <span className="grid h-10 w-11 shrink-0 place-items-center">
            <span className="grid h-8 w-8 place-items-center rounded-full border border-[var(--hairline-strong)] bg-[var(--surface-glass-strong)]">
              <span className="h-3 w-3 rotate-45 border-2 border-current" />
            </span>
          </span>
          <span
            className={`min-w-0 truncate pr-3 font-display text-[15px] font-semibold tracking-tight transition-all duration-200 ${
              expanded ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-2 opacity-0"
            }`}
          >
            ClauseGraph
          </span>
        </Link>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden py-1">
          {NAV.map((item) => (
            <RailIcon key={item.to} item={item} expanded={expanded} />
          ))}
        </nav>
      </aside>
    </div>
  );
}

export function MobileRail() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (item: NavItem) => {
    const base = item.match ?? item.to;
    return pathname === base || pathname.startsWith(base + "/");
  };

  return (
    <aside className="flex w-16 shrink-0 flex-col items-center border-r border-[var(--hairline)] bg-[var(--sidebar)]/95 py-4 backdrop-blur-2xl md:hidden">
      <Link
        to="/dashboard"
        className="mb-4 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--hairline-strong)] bg-[color-mix(in_oklab,var(--brass)_14%,transparent)] text-[var(--ink)]"
        aria-label="ClauseGraph home"
      >
        <div className="h-3.5 w-3.5 rotate-45 border-2 border-current" />
      </Link>
      <div className="premium-scrollbar flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-[14px] border transition-all duration-200 ease-out ${
                active
                  ? "border-[var(--hairline-strong)] bg-[color-mix(in_oklab,var(--brass)_12%,transparent)] text-[var(--ink)]"
                  : "border-transparent text-[var(--text-muted)] hover:bg-[var(--surface-glass)] hover:text-[var(--ink)]"
              }`}
              aria-label={item.label}
            >
              <Icon className="h-4 w-4" strokeWidth={1.7} />
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
