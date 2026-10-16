import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { acceptInvite } from "@/lib/auth-client";
import { validateInviteTokenFn } from "@/lib/auth.functions";

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  loaderDeps: ({ search: { token } }) => ({ token }),
  loader: async ({
    deps: { token },
  }): Promise<{ valid: boolean; email?: string; orgName?: string }> => {
    if (!token) return { valid: false };
    try {
      return await validateInviteTokenFn({ data: { token } });
    } catch {
      return { valid: false };
    }
  },
  head: () => ({
    meta: [
      { title: "Accept Invitation — ClauseGraph" },
      { name: "description", content: "Accept your invitation to join ClauseGraph." },
    ],
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const inviteData = Route.useLoaderData();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!inviteData.valid || !token) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="glass-panel p-8 max-w-md text-center">
          <div className="mx-auto h-12 w-12 rounded-full border border-[var(--hairline-strong)] grid place-items-center mb-4">
            <AlertCircle className="h-6 w-6 text-[var(--risk)]" />
          </div>
          <h1 className="font-display text-[22px] text-foreground">
            Invitation Expired or Invalid
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This invitation link is invalid, has expired, or has already been accepted.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-block rounded-[12px] bg-brass px-5 py-2.5 text-sm text-[color:var(--primary-foreground)] hover:bg-[color:var(--brass-strong)] transition-colors"
          >
            Sign in to ClauseGraph
          </Link>
        </div>
      </main>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await acceptInvite(token, password, fullName || undefined);
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-[440px]">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="h-8 w-8 rounded-full border border-[var(--hairline-strong)] grid place-items-center">
              <div className="h-2 w-2 rounded-full bg-brass" />
            </div>
            <span className="font-display text-[20px] tracking-tight text-foreground group-hover:text-brass transition-colors">
              ClauseGraph
            </span>
          </Link>
        </div>

        <div className="glass-panel p-8">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-brass" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass">
              Team Invitation
            </p>
          </div>
          <h1 className="font-display text-[26px] leading-[1.15] text-foreground">
            Join {inviteData.orgName || "Workspace"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You were invited as <strong className="text-foreground">{inviteData.email}</strong>. Set
            your password to activate your account.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Full name (optional)
              </label>
              <input
                type="text"
                className="w-full glass-input"
                placeholder="Ada Lovelace"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Choose password
              </label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full glass-input"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Confirm password
              </label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full glass-input"
                placeholder="Repeat password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-xs text-[var(--risk)]">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-[12px] bg-brass py-2.5 text-sm font-medium text-[color:var(--primary-foreground)] hover:bg-[color:var(--brass-strong)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Activating account…
                </>
              ) : (
                "Set password & enter workspace"
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
