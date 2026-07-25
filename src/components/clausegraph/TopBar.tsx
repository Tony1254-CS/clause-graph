import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Zap, ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { profileQuery, contractsQuery } from "@/data/queries";
import { supabase } from "@/integrations/supabase/client";

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
    <header className="glass-panel flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Workspace
          </span>
          <div className="flex items-center gap-2">
            <span className="font-display text-[22px] leading-none tracking-tight text-foreground truncate max-w-[42ch]">
              {orgName}
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 pl-4 ml-2 border-l border-[var(--hairline)]">
          <span className="h-1.5 w-1.5 rounded-full bg-brass shadow-[0_0_8px_var(--brass)]" />
          <span className="font-mono text-[11px] text-muted-foreground">
            <span className="text-foreground">{contractCount}</span>{" "}
            active contract{contractCount === 1 ? "" : "s"} monitored
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/simulate"
          className="group inline-flex items-center gap-2 rounded-[12px] bg-brass px-5 py-2.5 text-[13px] font-medium text-[color:var(--primary-foreground)] transition-all duration-150 ease-out hover:bg-[color:var(--brass-strong)] active:scale-[0.98] shadow-[0_0_24px_-6px_rgba(201,166,107,0.4)]"
        >
          <Zap className="h-3.5 w-3.5" strokeWidth={2.2} />
          Simulate Impact
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-[12px] border border-[var(--hairline)] px-2 py-1.5 hover:border-[var(--hairline-strong)] transition-colors duration-150 ease-out"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[rgba(201,166,107,0.12)] font-mono text-[11px] text-brass">
              {initial}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] w-64 glass-panel p-2 z-20"
            >
              <div className="px-3 py-2 border-b border-[var(--hairline)]">
                <div className="flex items-center gap-2 text-foreground">
                  <UserIcon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
                  <span className="text-[13px] truncate">
                    {profile?.full_name || profile?.email || "Signed in"}
                  </span>
                </div>
                {profile?.email && profile?.full_name && (
                  <p className="mt-0.5 font-mono text-[10.5px] text-muted-foreground truncate">
                    {profile.email}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                role="menuitem"
                className="mt-1 w-full inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] text-foreground hover:bg-[rgba(255,255,255,0.04)] transition-colors duration-150 ease-out"
              >
                <LogOut className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
