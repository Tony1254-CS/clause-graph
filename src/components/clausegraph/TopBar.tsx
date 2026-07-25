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
    <header className="h-20 flex items-center justify-between gap-4 px-6 sm:px-10 border-b border-[var(--hairline)] relative z-10">
      <div className="flex min-w-0 items-center gap-4">
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-[var(--ink)]">
          ClauseGraph
        </h1>
        <div className="hidden sm:block h-4 w-px bg-[var(--hairline-strong)]" />
        <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] truncate max-w-[32ch]">
          {orgName}
        </span>
        {profile?.org?.plan && (
          <Link
            to="/settings/billing"
            className="hidden md:inline-flex items-center rounded-full border border-[var(--hairline-strong)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink)] hover:bg-[var(--surface-glass)] transition-colors"
          >
            {profile.org.plan}
          </Link>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden lg:flex glass-pill items-center gap-2 px-3 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-[var(--ink)]">
            {contractCount} monitored
          </span>
        </div>

        <ThemeToggle />

        <Link
          to="/simulate"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-[13px] font-semibold text-[var(--paper)] transition-all duration-200 ease-out hover:opacity-90 active:scale-[0.98]"
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
            className="flex items-center gap-2 rounded-full border border-[var(--hairline)] pl-1 pr-2 py-1 hover:border-[var(--hairline-strong)] transition-colors duration-200"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--ink)] text-[var(--paper)] text-[11px] font-semibold">
              {initial}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.6} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-lift)] z-20"
            >
              <div className="px-3 py-2 border-b border-[var(--hairline)]">
                <div className="flex items-center gap-2 text-[var(--ink)]">
                  <UserIcon className="h-3.5 w-3.5 text-[var(--text-muted)]" strokeWidth={1.6} />
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
                className="mt-1 w-full inline-flex items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] text-[var(--ink)] hover:bg-[var(--paper-soft)] transition-colors duration-200"
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
