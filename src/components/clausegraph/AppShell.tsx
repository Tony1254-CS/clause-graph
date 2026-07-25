import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sidebar, MobileRail } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { PlanStatusBanner } from "./PlanStatusBanner";
import { PlanLimitDialog } from "@/components/PlanLimitDialog";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full flex flex-col">
      <PaymentTestModeBanner />
      <PlanStatusBanner />
      <div className="px-4 sm:px-6 py-6 flex-1">
        <div className="flex gap-6 max-w-[1600px] mx-auto">
          <Sidebar />
          <MobileRail />
          <div className="flex-1 min-w-0 flex flex-col gap-6">
            <TopBar />
            <main className="flex-1 flex items-center justify-center py-12">
              {children}
            </main>
          </div>
        </div>
      </div>
      <footer className="mt-auto border-t border-[var(--hairline)] px-4 sm:px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-muted-foreground font-mono">
          <span>© {new Date().getFullYear()} ClauseGraph · Payments by Paddle</span>
          <nav className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/refund" className="hover:text-foreground transition-colors">Refunds</Link>
          </nav>
        </div>
      </footer>
      <PlanLimitDialog />
    </div>
  );
}
