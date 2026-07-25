import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap, ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { profileQuery, contractsQuery } from "@/data/queries";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/theme-toggle";

export function TopBar() {
  const { data: profile } = useQuery(profileQuery);
  const { data: contracts } = useQuery(contractsQuery);
  const contractCount = contracts?.length ?? 0;
  const orgName = profile?.org?.name ?? "Workspace";

  const [menuOpen, setMenuOpen] = useState(false);
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

  async function handleSignOut() {
    setMenuOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initial =
    (profile?.full_name?.trim().charAt(0) || profile?.email?.trim().charAt(0) || "?").toUpperCase();

  return (
    <header className="relative z-20 grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--hairline)] px-4 py-3 backdrop-blur-xl sm:px-8 lg:px-10">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <h1 className="truncate font-display text-[20px] font-semibold tracking-tight text-[var(--ink)] sm:text-[22px]">
          ClauseGraph
        </h1>
        <div className="hidden h-4 w-px bg-[var(--hairline-strong)] sm:block" />
        <span className="hidden max-w-[24ch] truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] md:inline lg:max-w-[32ch]">
          {orgName}
        </span>
        {profile?.org?.plan && (
          <Link
            to="/settings/billing"
            className="hidden items-center rounded-full border border-[var(--hairline-strong)] bg-[var(--surface-glass)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink)] transition-colors hover:bg-[var(--surface-glass-strong)] lg:inline-flex"
          >
            {profile.org.plan}
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

        <ThemeToggle />

        <Link
          to="/simulate"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-[var(--ink)] px-3.5 text-[13px] font-semibold text-[var(--paper)] shadow-[var(--glow-brass)] transition-all duration-200 ease-out hover:-translate-y-px active:scale-[0.98] sm:h-11 sm:px-5"
        >
          <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />
          <span className="hidden sm:inline">Simulate Impact</span>
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
  );
}
