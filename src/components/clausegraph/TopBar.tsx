import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getOrgUsage } from "@/lib/billing.functions";
import { BILLING_ENABLED } from "@/lib/plans";
import { Zap, ChevronDown, LogOut, User as UserIcon, Crosshair, FileText, GitCompare } from "lucide-react";
import { profileQuery, contractsQuery } from "@/data/queries";
import { signOut } from "@/lib/auth-client";
import { ThemeToggle } from "@/components/theme-toggle";
import { useCopilot } from "./CopilotContext";
import { NotificationBell } from "./NotificationBell";
import { LiveShockSimulatorModal } from "./LiveShockSimulatorModal";
import { RedlineDiffModal } from "./RedlineDiffModal";
import { generateExecutiveComplianceDossier } from "@/lib/pdf-dossier";
import { toast } from "sonner";

export function TopBar() {
  const { data: profile } = useQuery(profileQuery);
  const { data: contracts } = useQuery(contractsQuery);
  const getUsage = useServerFn(getOrgUsage);
  // Same server-resolved entitlement the billing page uses, so the badge can
  // never disagree with what the workspace is actually allowed to do.
  const { data: usage } = useQuery({
    queryKey: ["org-usage"],
    queryFn: () => getUsage(),
    staleTime: 30_000,
  });
  // While billing is parked every workspace is Pro — never let a failed query
  // make the badge disagree with what the app actually allows.
  const effectivePlan = BILLING_ENABLED
    ? (usage?.plan ?? profile?.org?.plan)
    : "pro";
  const contractCount = contracts?.length ?? 0;
  const orgName = profile?.org?.name ?? "Workspace";

  const [menuOpen, setMenuOpen] = useState(false);
  const [shockModalOpen, setShockModalOpen] = useState(false);
  const [redlineModalOpen, setRedlineModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    function handleOpenShock() {
      setShockModalOpen(true);
    }
    function handleOpenRedline() {
      setRedlineModalOpen(true);
    }
    function handleExportDossier() {
      toast.info("Generating Board Compliance Dossier...");
      generateExecutiveComplianceDossier({
        orgName,
        contractCount,
      });
    }

    window.addEventListener("clausegraph:open_shock_modal", handleOpenShock);
    window.addEventListener("clausegraph:open_redline_modal", handleOpenRedline);
    window.addEventListener("clausegraph:export_dossier", handleExportDossier);

    return () => {
      window.removeEventListener("clausegraph:open_shock_modal", handleOpenShock);
      window.removeEventListener("clausegraph:open_redline_modal", handleOpenRedline);
      window.removeEventListener("clausegraph:export_dossier", handleExportDossier);
    };
  }, [orgName, contractCount]);

  async function handleSignOut() {
    setMenuOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const { isInspectModeActive, toggleInspectMode } = useCopilot();

  const initial =
    (profile?.full_name?.trim().charAt(0) || profile?.email?.trim().charAt(0) || "?").toUpperCase();

  return (
    <>
      <header className="relative z-20 grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--hairline)] px-4 py-3 backdrop-blur-xl sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <h1 className="truncate font-display text-[20px] font-semibold tracking-tight text-[var(--ink)] sm:text-[22px]">
            ClauseGraph
          </h1>
          <div className="hidden h-4 w-px bg-[var(--hairline-strong)] sm:block" />
          <span className="hidden max-w-[24ch] truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] md:inline lg:max-w-[32ch]">
            {orgName}
          </span>
          {effectivePlan && (
            <Link
              to="/settings/billing"
              className="hidden items-center rounded-full border border-[var(--hairline-strong)] bg-[var(--surface-glass)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink)] transition-colors hover:bg-[var(--surface-glass-strong)] lg:inline-flex"
            >
              {effectivePlan}
            </Link>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface-glass)] px-3 py-2 backdrop-blur-xl xl:flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brass)] opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brass)]" />
            </span>
            <span className="text-[11px] font-medium text-[var(--ink)] tabular-nums">
              {contractCount} monitored
            </span>
          </div>

          {/* Simulate Live Shock Interactive Injector */}
          <button
            type="button"
            onClick={() => setShockModalOpen(true)}
            title="Simulate Live Statutory Shock (Interactive Scenario Injector)"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 hover:border-amber-400 transition-all shadow-[0_0_12px_rgba(245,158,11,0.2)] cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5 text-amber-400 fill-amber-400/40" />
            <span>Live Shock</span>
          </button>

          {/* Board Dossier PDF Export */}
          <button
            type="button"
            onClick={() => {
              toast.info("Generating Board Compliance Dossier...");
              generateExecutiveComplianceDossier({
                orgName,
                contractCount,
              });
            }}
            title="Generate Board-Ready Compliance Dossier (PDF)"
            className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-glass)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ink)] hover:border-emerald-400 hover:text-emerald-300 transition-all cursor-pointer"
          >
            <FileText className="h-3.5 w-3.5 text-emerald-400" />
            <span>Board Dossier</span>
          </button>

          {/* Inspect Lens Toggle Button */}
          <button
            type="button"
            onClick={toggleInspectMode}
            title={isInspectModeActive ? "Exit Inspect Mode (Esc)" : "Inspect & Ask AI Lens (Click any card to analyze)"}
            className={`group relative inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 sm:px-3 text-[11px] font-semibold tracking-wide transition-all ${
              isInspectModeActive
                ? "border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.35)] animate-pulse"
                : "border-[var(--hairline-strong)] bg-[var(--surface-glass)] text-[var(--ink)] hover:border-emerald-400/60 hover:text-emerald-400 hover:bg-[var(--surface-glass-strong)]"
            }`}
          >
            <Crosshair className={`h-3.5 w-3.5 ${isInspectModeActive ? "rotate-90 text-emerald-400" : "text-[var(--brass)]"} transition-transform duration-300`} />
          </button>

          {/* Enterprise Compliance Notification Bell */}
          <NotificationBell />

          <ThemeToggle />

          <Link
            to="/simulate"
            className="group relative inline-flex h-9 shrink-0 items-center gap-1.5 overflow-hidden rounded-full bg-[var(--brass)] px-3 text-[12px] font-semibold text-[color:var(--primary-foreground)] shadow-[var(--glow-brass)] transition-ui press hover:-translate-y-[1px] hover:bg-[var(--brass-strong)] hover:shadow-[0_0_32px_-6px_color-mix(in_oklab,var(--brass)_85%,transparent)] sm:h-11 sm:px-5 sm:text-[13px] sm:gap-2"
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
            <Zap className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-[-8deg]" strokeWidth={2.2} />
            <span className="hidden sm:inline">Simulate Impact</span>
            <span className="sm:hidden text-[11px]">Simulate</span>
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex h-10 items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--surface-glass)] pl-1 pr-2 transition-colors duration-200 hover:border-[var(--hairline-strong)] sm:h-11"
            >
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[color-mix(in_oklab,var(--brass)_14%,transparent)] text-[var(--ink)] text-[12px] font-semibold">
                {initial}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.6} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-[calc(100%+8px)] z-30 w-64 rounded-[20px] border border-[var(--hairline)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-lift)] backdrop-blur-2xl"
              >
                <div className="px-3 py-2 border-b border-[var(--hairline)]">
                  <div className="flex items-center gap-2 text-[var(--ink)]">
                    <UserIcon className="h-3.5 w-3.5 text-[var(--brass)]" strokeWidth={1.6} />
                    <span className="text-[13px] truncate font-medium">
                      {profile?.full_name || profile?.email || "Signed in"}
                    </span>
                  </div>
                  {profile?.email && profile?.full_name && (
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)] truncate">
                      {profile.email}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  role="menuitem"
                  className="mt-1 inline-flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left text-[13px] text-[var(--ink)] transition-colors duration-200 hover:bg-[var(--surface-glass)]"
                >
                  <LogOut className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.6} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Modals */}
      <LiveShockSimulatorModal open={shockModalOpen} onOpenChange={setShockModalOpen} />
      <RedlineDiffModal open={redlineModalOpen} onOpenChange={setRedlineModalOpen} />
    </>
  );
}
