import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sidebar, MobileRail } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PlanStatusBanner } from "./PlanStatusBanner";
import { PlanLimitDialog } from "@/components/PlanLimitDialog";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-[var(--page-bg)] p-2 sm:p-4 lg:p-6">
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[var(--hairline)] bg-[var(--shell-bg)] shadow-[var(--shadow-lift)] sm:rounded-[28px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[240px] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04),transparent_70%)]" />


        <div className="relative flex flex-1 min-h-0">
          <Sidebar />
          <MobileRail />
          <div className="flex-1 min-w-0 flex flex-col">
            <PaymentTestModeBanner />
            <PlanStatusBanner />
            <TopBar />
            <main className="premium-scrollbar flex-1 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-10">
              <div className="mx-auto w-full max-w-[1420px]">{children}</div>
            </main>
            <footer className="hidden h-10 shrink-0 items-center justify-between border-t border-[var(--hairline)] px-6 text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)] sm:flex lg:px-10">
              <span>© {new Date().getFullYear()} ClauseGraph</span>
              <nav className="flex items-center gap-5">
                <Link to="/terms" className="transition-colors duration-200 hover:text-[var(--ink)]">Terms</Link>
                <Link to="/privacy" className="transition-colors duration-200 hover:text-[var(--ink)]">Privacy</Link>
                <Link to="/refund" className="transition-colors duration-200 hover:text-[var(--ink)]">Refunds</Link>
              </nav>
            </footer>
          </div>
        </div>
      </div>
      <PlanLimitDialog />
    </div>
  );
}
