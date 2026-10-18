import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2, ArrowRight } from "lucide-react";
import {
  getToken,
  signInWithPassword,
  signUpWithPassword,
  signInDemo,
} from "@/lib/auth-client";

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
    if (getToken()) {
      navigate({ to: safeRedirect(search.redirect), replace: true });
    }
  }, [navigate, search.redirect]);

  async function handleDemoAccess() {
    setError(null);
    setNotice("Signing in to pre-seeded enterprise evaluation workspace (PostgreSQL 16)...");
    setBusy(true);
    try {
      await signInDemo();
      navigate({ to: safeRedirect(search.redirect), replace: true });
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
        await signUpWithPassword(email, password, fullName || undefined);
        navigate({ to: safeRedirect(search.redirect), replace: true });
      } else if (mode === "signin") {
        await signInWithPassword(email, password);
        navigate({ to: safeRedirect(search.redirect), replace: true });
      } else {
        setNotice("If this workspace exists, an admin can update your password under settings.");
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
            <div className="mt-6 mb-5">
              <button
                type="button"
                onClick={handleDemoAccess}
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-[var(--brass)] to-[#14c6a4] px-4 py-2.5 text-[13.5px] font-semibold text-[color:var(--primary-foreground)] shadow-[0_0_24px_-4px_rgba(14,164,143,0.55)] transition-all duration-150 ease-out hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
              >
                <span>⚡ Instant Hackathon Demo (1-Click Judge Access)</span>
              </button>

              <div className="mt-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--hairline)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  or with email
                </span>
                <div className="h-px flex-1 bg-[var(--hairline)]" />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
