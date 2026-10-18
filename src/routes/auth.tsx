import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2, ArrowRight } from "lucide-react";
import {
  getToken,
  signInWithPassword,
  signUpWithPassword,
  signInWithOAuth,
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

  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

  useEffect(() => {
    if (getToken()) {
      navigate({ to: safeRedirect(search.redirect), replace: true });
    }
  }, [navigate, search.redirect]);

  async function handleOAuth(provider: "google" | "github") {
    setError(null);
    setNotice(null);
    setOauthLoading(provider);
    setBusy(true);
    try {
      await signInWithOAuth(provider, email || undefined, fullName || undefined);
      navigate({ to: safeRedirect(search.redirect), replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `${provider === "google" ? "Google" : "GitHub"} sign-in failed`
      );
      setBusy(false);
      setOauthLoading(null);
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
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => handleOAuth("google")}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-[12px] border border-[var(--hairline-strong)] bg-[var(--surface-glass)] px-4 py-2.5 text-[13.5px] font-medium text-foreground transition-all duration-150 ease-out hover:border-brass hover:text-brass hover:bg-[var(--surface-raised)] active:scale-[0.98] disabled:opacity-50"
                >
                  {oauthLoading === "google" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brass" />
                  ) : (
                    <GoogleGlyph />
                  )}
                  <span>Continue with Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOAuth("github")}
                  disabled={busy}
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-[12px] border border-[var(--hairline-strong)] bg-[var(--surface-glass)] px-4 py-2.5 text-[13.5px] font-medium text-foreground transition-all duration-150 ease-out hover:border-brass hover:text-brass hover:bg-[var(--surface-raised)] active:scale-[0.98] disabled:opacity-50"
                >
                  {oauthLoading === "github" ? (
                    <Loader2 className="h-4 w-4 animate-spin text-brass" />
                  ) : (
                    <GitHubGlyph />
                  )}
                  <span>Continue with GitHub</span>
                </button>
              </div>

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

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function GitHubGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}
