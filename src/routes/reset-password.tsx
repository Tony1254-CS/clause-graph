import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — ClauseGraph" },
      { name: "description", content: "Set a new password for your ClauseGraph account." },
      { property: "og:title", content: "Reset password — ClauseGraph" },
      {
        property: "og:description",
        content: "Set a new password for your ClauseGraph account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase recovery link sets a session automatically once the page loads.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[440px] px-6 pt-16 pb-24">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-12 group">
          <div className="h-8 w-8 rounded-full border border-[var(--hairline-strong)] grid place-items-center">
            <div className="h-2 w-2 rounded-full bg-brass" />
          </div>
          <span className="font-display text-[19px] tracking-tight text-foreground group-hover:text-brass transition-colors">
            ClauseGraph
          </span>
        </Link>
        <div className="glass-panel p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
            New password
          </p>
          <h1 className="mt-3 font-display text-[26px] leading-[1.15] tracking-tight text-foreground">
            Set a new password
          </h1>
          {!ready ? (
            <p className="mt-6 text-[13px] text-muted-foreground">
              Waiting for the recovery session to open. If nothing happens, request a new reset
              link from the sign-in screen.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  New password
                </span>
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-[12px] border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] px-3.5 py-2.5 text-[13.5px] text-foreground focus:border-[var(--hairline-strong)] transition-colors"
                />
              </label>
              {error && (
                <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk)]" />
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-[12px] bg-brass px-5 py-2.5 text-[13px] font-medium text-[color:var(--primary-foreground)] transition-all duration-150 ease-out hover:bg-[color:var(--brass-strong)] disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
                Update password
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
