import type { ReactNode } from "react";
import { Sidebar, MobileRail } from "./Sidebar";
import { TopBar } from "./TopBar";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full">
      <PaymentTestModeBanner />
      <div className="px-4 sm:px-6 py-6">
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
    </div>
  );
}
