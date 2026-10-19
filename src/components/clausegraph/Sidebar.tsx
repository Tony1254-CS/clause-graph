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
  UserCheck,
  Activity,
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
    | "/backtest"
    | "/actions"
    | "/predictive"
    | "/what-if"
    | "/review-queue"
    | "/jobs"
    | "/legal-sources"
    | "/settings/team"
    | "/settings/billing"
    | "/settings/account";
  match?: string;
};

const NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Contracts", icon: FileText, to: "/contracts", match: "/contracts" },
  { label: "Regulatory Feed", icon: Rss, to: "/feed" },
  { label: "Simulate & Cascades", icon: Zap, to: "/simulate" },
  { label: "Predictive Radar", icon: Radar, to: "/predictive", match: "/predictive" },
  { label: "Review Queue", icon: UserCheck, to: "/review-queue", match: "/review-queue" },
  { label: "Background Jobs", icon: Activity, to: "/jobs" as any, match: "/jobs" },
  { label: "Sources & Backups", icon: ShieldCheck, to: "/legal-sources" as any, match: "/legal-sources" },
  { label: "Backtest", icon: ShieldCheck, to: "/backtest" },
  { label: "Action Plans", icon: ListChecks, to: "/actions" },
  { label: "Team", icon: Users, to: "/settings/team", match: "/settings/team" },
  { label: "Billing", icon: Wallet, to: "/settings/billing", match: "/settings/billing" },
  { label: "Account", icon: UserCog, to: "/settings/account", match: "/settings/account" },
];

function useIsActive(item: NavItem) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cleanPath = pathname.replace(/\/+$/, "") || "/";
  const base = (item.match ?? item.to).replace(/\/+$/, "");
  if (
    item.to === "/feed" &&
    (cleanPath === "/feed" || cleanPath.startsWith("/feed/") || cleanPath.startsWith("/regulations"))
  ) {
    return true;
  }
  return cleanPath === base || cleanPath.startsWith(base + "/");
}

function RailIcon({ item, expanded, index }: { item: NavItem; expanded: boolean; index: number }) {
  const isActive = useIsActive(item);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-label={item.label}
      title={item.label}
      className={`group relative grid h-10 min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center rounded-[10px] border transition-all duration-200 ease-out will-change-transform ${
        isActive
          ? "border-[color-mix(in_oklab,var(--brass)_32%,transparent)] bg-[color-mix(in_oklab,var(--brass)_14%,transparent)] text-[var(--ink)] shadow-[0_2px_14px_-4px_rgba(94,234,212,0.22)]"
          : "border-transparent text-[var(--text-muted)] hover:border-[var(--hairline)] hover:bg-white/[0.05] hover:text-[var(--ink)] hover:translate-x-[2px]"
      }`}
    >
      <span
        aria-hidden
        className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--brass)] shadow-[0_0_10px_var(--brass)] origin-left transition-all duration-300 ${
          isActive ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      />
      <span className="grid h-10 w-10 shrink-0 place-items-center">
        <Icon
          className={`h-[18px] w-[18px] transition-all duration-200 ${
            isActive
              ? "text-[var(--brass)] scale-110 drop-shadow-[0_0_8px_rgba(94,234,212,0.45)]"
              : "text-[var(--text-muted)] group-hover:text-[var(--ink)] group-hover:scale-110"
          }`}
          strokeWidth={isActive ? 2 : 1.5}
        />
      </span>
      <span
        className={`min-w-0 truncate pr-4 text-[13px] transition-all duration-300 ease-out ${
          isActive ? "font-semibold text-[var(--ink)]" : "font-medium"
        } ${
          expanded ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-2 opacity-0"
        }`}
        style={{ transitionDelay: expanded ? `${index * 22}ms` : "0ms" }}
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
    <div className="relative hidden w-[64px] shrink-0 md:block">
      <aside
        ref={asideRef}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={onBlur}
        className={`absolute inset-y-0 left-0 z-30 flex flex-col border-r border-[var(--hairline)] bg-[var(--sidebar)] px-3 py-4 transition-[width] duration-200 ease-out ${
          expanded ? "w-[232px]" : "w-[64px]"
        }`}
      >
        <Link
          to="/dashboard"
          aria-label="ClauseGraph home"
          className="mb-4 grid h-10 min-w-0 grid-cols-[40px_minmax(0,1fr)] items-center rounded-[10px] text-[var(--ink)]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center">
            <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-[var(--brass)] text-[color:var(--primary-foreground)]">
              <span className="h-2.5 w-2.5 rotate-45 border-[1.5px] border-current" />
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

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto no-scrollbar py-1">
          {NAV.map((item, i) => (
            <RailIcon key={item.to} item={item} expanded={expanded} index={i} />
          ))}
        </nav>
      </aside>
    </div>
  );
}

export function MobileRail() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (item: NavItem) => {
    const cleanPath = pathname.replace(/\/+$/, "") || "/";
    const base = (item.match ?? item.to).replace(/\/+$/, "");
    if (
      item.to === "/feed" &&
      (cleanPath === "/feed" || cleanPath.startsWith("/feed/") || cleanPath.startsWith("/regulations"))
    ) {
      return true;
    }
    return cleanPath === base || cleanPath.startsWith(base + "/");
  };

  return (
    <aside className="order-last flex h-14 w-full shrink-0 flex-row items-center justify-around border-t border-[var(--hairline)] bg-[var(--sidebar)]/95 px-2 backdrop-blur-2xl md:hidden overflow-x-auto no-scrollbar z-30">
      <Link
        to="/dashboard"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--hairline-strong)] bg-[color-mix(in_oklab,var(--brass)_14%,transparent)] text-[var(--ink)]"
        aria-label="ClauseGraph home"
      >
        <div className="h-3 w-3 rotate-45 border-2 border-current" />
      </Link>
      <div className="flex h-full items-center gap-1 overflow-x-auto no-scrollbar px-1">
        {NAV.slice(0, 7).map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border transition-all duration-200 ease-out ${
                active
                  ? "border-[color-mix(in_oklab,var(--brass)_32%,transparent)] bg-[color-mix(in_oklab,var(--brass)_14%,transparent)] text-[var(--brass)] shadow-[0_2px_14px_-4px_rgba(94,234,212,0.22)]"
                  : "border-transparent text-[var(--text-muted)] hover:border-[var(--hairline)] hover:bg-white/[0.05] hover:text-[var(--ink)]"
              }`}
              aria-label={item.label}
              title={item.label}
            >
              <Icon className="h-4 w-4" strokeWidth={active ? 2 : 1.7} />
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
