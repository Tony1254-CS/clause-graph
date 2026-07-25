import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Sidebar, MobileRail } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PlanLimitDialog } from "@/components/PlanLimitDialog";
import { PlanStatusBanner } from "./PlanStatusBanner";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoading = useRouterState({ select: (s) => s.isLoading || s.isTransitioning });

  return (
    <div className="h-dvh w-full overflow-hidden bg-[var(--page-bg)] p-2 sm:p-4 lg:p-6">
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--shell-bg)] shadow-[var(--shadow-lift)] sm:rounded-[28px]">
        {/* Ambient drifting mint aura — very subtle */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] ambient-drift bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--brass)_10%,transparent),transparent_70%)]" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-[420px] w-[420px] ambient-drift bg-[radial-gradient(circle,color-mix(in_oklab,var(--brass)_8%,transparent),transparent_65%)]" style={{ animationDelay: "-14s" }} />

        {/* Route pending progress hairline */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 z-40 h-[2px] overflow-hidden transition-opacity duration-200 ${
            isLoading ? "opacity-100" : "opacity-0"
          }`}
        >
          <div
            className="h-full w-1/3 bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent"
            style={{ animation: "nav-progress 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite" }}
          />
        </div>

        <div className="relative flex flex-1 min-h-0">
          <Sidebar />
          <MobileRail />
          <div className="flex-1 min-w-0 flex flex-col">
            <TopBar />
            <PlanStatusBanner />
            <main className="premium-scrollbar flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
              <div key={pathname} className="route-transition mx-auto w-full max-w-[1420px]">
                {children}
              </div>
            </main>
            <footer className="hidden h-10 shrink-0 items-center justify-between border-t border-[var(--hairline)] px-6 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)] sm:flex lg:px-10">
              <span>© {new Date().getFullYear()} ClauseGraph</span>
              <nav className="flex items-center gap-5">
                <Link to="/terms" className="transition-ui hover:text-[var(--ink)]">Terms</Link>
                <Link to="/privacy" className="transition-ui hover:text-[var(--ink)]">Privacy</Link>
                <Link to="/refund" className="transition-ui hover:text-[var(--ink)]">Refunds</Link>
              </nav>
            </footer>
          </div>
        </div>
      </div>
      <PlanLimitDialog />
    </div>
  );
}
