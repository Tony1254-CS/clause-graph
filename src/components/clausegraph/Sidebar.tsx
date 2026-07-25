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

function RailIcon({ item }: { item: NavItem }) {
  const isActive = useIsActive(item);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-label={item.label}
      title={item.label}
      className={`group relative grid h-11 w-11 place-items-center rounded-2xl transition-all duration-200 ease-out ${
        isActive
          ? "bg-[var(--surface-glass-strong)] text-[var(--ink)] shadow-sm border border-[var(--hairline)]"
          : "text-[var(--text-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-glass)] border border-transparent"
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={1.6} />
      <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-[var(--ink)] px-2.5 py-1 text-[11px] font-medium text-[var(--paper)] opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 z-50">
        {item.label}
      </span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-20 shrink-0 flex-col items-center py-6 border-r border-[var(--hairline)] bg-[var(--sidebar)] relative z-10">
      <Link
        to="/dashboard"
        aria-label="ClauseGraph home"
        className="mb-8 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-[var(--paper)]"
      >
        <div className="h-4 w-4 rotate-45 border-2 border-current" />
      </Link>

      <nav className="flex-1 min-h-0 w-full flex flex-col items-center gap-2 overflow-y-auto overflow-x-visible no-scrollbar py-1">
        {NAV.map((item) => (
          <RailIcon key={item.to} item={item} />
        ))}
      </nav>

      <div className="mt-auto pt-4 flex flex-col items-center gap-2 shrink-0">
        <Link
          to="/settings/account"
          aria-label="Settings"
          className="grid h-11 w-11 place-items-center rounded-2xl text-[var(--text-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-glass)] transition-all duration-200 ease-out"
        >
          <Settings className="h-5 w-5" strokeWidth={1.6} />
        </Link>
      </div>
    </aside>
  );
}

export function MobileRail() {
  return (
    <aside className="md:hidden flex w-16 shrink-0 flex-col items-center py-4 border-r border-[var(--hairline)] bg-[var(--sidebar)]">
      <Link
        to="/dashboard"
        className="mb-4 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-[var(--paper)]"
        aria-label="ClauseGraph home"
      >
        <div className="h-3.5 w-3.5 rotate-45 border-2 border-current" />
      </Link>
      <div className="flex-1 min-h-0 w-full overflow-y-auto no-scrollbar flex flex-col items-center gap-1.5">
        {NAV.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[var(--text-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-glass)] transition-all duration-200 ease-out"
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
