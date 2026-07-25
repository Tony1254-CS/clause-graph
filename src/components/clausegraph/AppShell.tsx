import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sidebar, MobileRail } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PlanStatusBanner } from "./PlanStatusBanner";
import { PlanLimitDialog } from "@/components/PlanLimitDialog";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full flex flex-col bg-[var(--page-bg)] px-3 sm:px-6 py-4 sm:py-6">
      <div className="relative flex-1 flex flex-col rounded-[28px] sm:rounded-[32px] bg-[var(--shell-bg)] border border-[var(--hairline)] shadow-[var(--shadow-lift)] overflow-hidden">
        {/* Ambient background orbs */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-[var(--paper-soft)] opacity-70 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 w-[380px] h-[380px] rounded-full bg-[var(--paper-soft)] opacity-60 blur-[100px]" />

        <div className="relative flex flex-1 min-h-0">
          <Sidebar />
          <MobileRail />
          <div className="flex-1 min-w-0 flex flex-col">
            <PaymentTestModeBanner />
            <PlanStatusBanner />
            <TopBar />
            <main className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-10 py-8 sm:py-10">
              <div className="max-w-[1400px] mx-auto w-full">{children}</div>
            </main>
            <footer className="border-t border-[var(--hairline)] px-6 sm:px-10 h-12 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] font-medium">
              <span>© {new Date().getFullYear()} ClauseGraph · Payments by Paddle</span>
              <nav className="flex items-center gap-6">
                <Link to="/terms" className="hover:text-[var(--ink)] transition-colors duration-200">Terms</Link>
                <Link to="/privacy" className="hover:text-[var(--ink)] transition-colors duration-200">Privacy</Link>
                <Link to="/refund" className="hover:text-[var(--ink)] transition-colors duration-200">Refunds</Link>
              </nav>
            </footer>
          </div>
        </div>
      </div>
      <PlanLimitDialog />
    </div>
  );
}
