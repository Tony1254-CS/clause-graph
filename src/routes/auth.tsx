import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ClauseGraph" },
      {
        name: "description",
        content: "Sign in or create a ClauseGraph workspace.",
      },
      { property: "og:title", content: "Sign in — ClauseGraph" },
      {
        property: "og:description",
        content: "Sign in or create a ClauseGraph workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search) => searchSchema.parse(search),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function safeRedirect(raw?: string): string {
  if (!raw) return "/dashboard";
  try {
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return "/dashboard";
    return u.pathname + u.search;
  } catch {
    return "/dashboard";
  }
}

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: safeRedirect(search.redirect), replace: true });
      }
    });
  }, [navigate, search.redirect]);

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth?redirect=${encodeURIComponent(safeRedirect(search.redirect))}`,
        },
      });
      if (error) {
        setError(error.message ?? "Google sign-in failed");
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setBusy(false);
    }
  }

  async function handleDemoAccess() {
    setError(null);
    setNotice("Signing in to pre-seeded enterprise evaluation workspace...");
    setBusy(true);
    try {
      const demoEmail = "judge@clausegraph.ai";
      const demoPassword = "DemoPassword2026!";

      // Try sign-in first
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: demoPassword,
      });

      if (!signInErr && signInData.session) {
        navigate({ to: safeRedirect(search.redirect), replace: true });
        return;
      }

      // Auto-provision if not existing
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: demoEmail,
        password: demoPassword,
        options: {
          data: { full_name: "Hackathon Evaluation Lead" },
        },
      });

      if (signUpErr) {
        setError(signUpErr.message);
        setBusy(false);
        return;
      }

      if (signUpData.session) {
        navigate({ to: safeRedirect(search.redirect), replace: true });
      } else {
        const { error: retryErr } = await supabase.auth.signInWithPassword({
          email: demoEmail,
          password: demoPassword,
        });
        if (retryErr) {
          setError(retryErr.message);
          setBusy(false);
        } else {
          navigate({ to: safeRedirect(search.redirect), replace: true });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo access failed");
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { full_name: fullName || undefined },
          },
        });
        if (err) throw err;
        setNotice(
          "Account created. If email confirmation is required, check your inbox to continue.",
        );
        // If auto-confirm is on, session is live now.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          navigate({ to: safeRedirect(search.redirect), replace: true });
        }
      } else if (mode === "signin") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        navigate({ to: safeRedirect(search.redirect), replace: true });
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (err) throw err;
        setNotice("Password reset link sent. Check your inbox.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[440px] px-6 pt-16 pb-24">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 mb-12 group"
        >
          <div className="h-8 w-8 rounded-full border border-[var(--hairline-strong)] grid place-items-center">
            <div className="h-2 w-2 rounded-full bg-brass" />
          </div>
          <span className="font-display text-[19px] tracking-tight text-foreground group-hover:text-brass transition-colors">
            ClauseGraph
          </span>
        </Link>

        <div className="glass-panel p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
            {mode === "signup" ? "Create workspace" : mode === "forgot" ? "Reset password" : "Sign in"}
          </p>
          <h1 className="mt-3 font-display text-[26px] leading-[1.15] tracking-tight text-foreground">
            {mode === "signup"
              ? "Start a new workspace"
              : mode === "forgot"
                ? "Recover your account"
                : "Welcome back"}
          </h1>

          {mode !== "forgot" && (
            <>
              <button
                type="button"
                onClick={handleDemoAccess}
                disabled={busy}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-[var(--brass)] to-[#14c6a4] px-4 py-2.5 text-[13.5px] font-semibold text-[color:var(--primary-foreground)] shadow-[0_0_24px_-4px_rgba(14,164,143,0.55)] transition-all duration-150 ease-out hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                <span>⚡ Instant Hackathon Demo (1-Click Judge Access)</span>
              </button>

              <button
                type="button"
                onClick={handleGoogle}
                disabled={busy}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-[12px] border border-[var(--hairline-strong)] px-4 py-2.5 text-[13.5px] text-foreground transition-all duration-150 ease-out hover:border-brass hover:text-brass disabled:opacity-50"
              >
                <GoogleGlyph />
                Continue with Google
              </button>
              <div className="mt-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--hairline)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  or
                </span>
                <div className="h-px flex-1 bg-[var(--hairline)]" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3">
            {mode === "signup" && (
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Full name
                </span>
                <input
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="rounded-[12px] border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] px-3.5 py-2.5 text-[13.5px] text-foreground focus:border-[var(--hairline-strong)] transition-colors"
                />
              </label>
            )}
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-[12px] border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] px-3.5 py-2.5 text-[13.5px] text-foreground focus:border-[var(--hairline-strong)] transition-colors"
              />
            </label>
            {mode !== "forgot" && (
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Password
                </span>
                <input
                  type="password"
                  required
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  className="rounded-[12px] border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] px-3.5 py-2.5 text-[13.5px] text-foreground focus:border-[var(--hairline-strong)] transition-colors"
                />
              </label>
            )}

            {error && (
              <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk)]" />
                {error}
              </p>
            )}
            {notice && (
              <p className="text-[12.5px] text-muted-foreground">{notice}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-[12px] bg-brass px-5 py-2.5 text-[13px] font-medium text-[color:var(--primary-foreground)] shadow-[0_0_24px_-6px_rgba(201,166,107,0.4)] transition-all duration-150 ease-out hover:bg-[color:var(--brass-strong)] active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                  Working…
                </>
              ) : (
                <>
                  {mode === "signup"
                    ? "Create workspace"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Sign in"}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-[12px] text-muted-foreground">
            {mode === "signin" && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setNotice(null);
                  }}
                  className="hover:text-brass transition-colors"
                >
                  Create a workspace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                    setNotice(null);
                  }}
                  className="hover:text-brass transition-colors"
                >
                  Forgot password?
                </button>
              </>
            )}
            {mode === "signup" && (
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setNotice(null);
                }}
                className="hover:text-brass transition-colors"
              >
                Have an account? Sign in
              </button>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setNotice(null);
                }}
                className="hover:text-brass transition-colors"
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4.1-5.4 4.1-3.3 0-5.9-2.7-5.9-6.1s2.7-6.1 5.9-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.6 14.7 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-2H12z"
      />
    </svg>
  );
}
