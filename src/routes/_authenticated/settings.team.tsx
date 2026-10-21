import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  UserMinus, 
  Mail, 
  ShieldCheck, 
  Users, 
  UserPlus, 
  CheckCircle2, 
  AlertCircle,
  Shield,
  Clock,
  Sparkles
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { teamMembersQuery, myRoleQuery, profileQuery } from "@/data/queries";
import { inviteTeammate, removeTeammate } from "@/lib/team.functions";
import { handlePlanLimitError } from "@/components/PlanLimitDialog";
import { RouteError } from "@/components/clausegraph/RouteError";

export const Route = createFileRoute("/_authenticated/settings/team")({
  head: () => ({
    meta: [
      { title: "Team & Access Governance — ClauseGraph" },
      { name: "description", content: "Manage teammates, roles, and administrative seats for your organization." },
      { property: "og:title", content: "Team & Access Governance — ClauseGraph" },
      { property: "og:description", content: "Manage teammates, roles, and administrative seats for your organization." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(teamMembersQuery),
      context.queryClient.ensureQueryData(myRoleQuery),
      context.queryClient.ensureQueryData(profileQuery),
    ]),
  component: TeamPage,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Team settings unavailable" error={error} reset={reset} />
  ),
});

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "CG";
}

function TeamPage() {
  const { data: members } = useSuspenseQuery(teamMembersQuery);
  const { data: myRole } = useSuspenseQuery(myRoleQuery);
  const { data: profile } = useSuspenseQuery(profileQuery);
  const isAdmin = myRole === "admin";

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const qc = useQueryClient();
  const invite = useServerFn(inviteTeammate);
  const remove = useServerFn(removeTeammate);

  const inviteMut = useMutation({
    mutationFn: () => invite({ data: { email, fullName } }),
    onSuccess: () => {
      setEmail("");
      setFullName("");
      setError(null);
      setNotice("Invitation dispatched successfully.");
      setTimeout(() => setNotice(null), 4000);
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (err) => {
      setNotice(null);
      if (handlePlanLimitError(err, "seats")) {
        setError(null);
        return;
      }
      setError(err instanceof Error ? err.message : "Invite failed");
    },
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => remove({ data: { userId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-members"] }),
  });

  const adminCount = members.filter((m) => m.role === "admin").length;
  const standardCount = members.length - adminCount;

  return (
    <AppShell>
      <div className="w-full max-w-[1200px] mx-auto space-y-8 pb-16">
        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[var(--brass)] animate-pulse" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                {profile?.org?.name ?? "Enterprise Workspace"} · Governance
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Team &amp; Access Controls
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Collaborative workspace seats for legal counsel, compliance engineers, and risk officers. 
              Manage roles, dispatch cryptographically verified invites, and maintain audit-trail permissions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 font-mono text-[11px] text-muted-foreground">
              Total Seats: <strong className="text-foreground">{members.length}</strong>
            </span>
            <span className="rounded-full border border-[var(--brass)]/30 bg-[var(--brass)]/10 px-3.5 py-1.5 font-mono text-[11px] font-semibold text-[var(--brass)]">
              {isAdmin ? "Admin Authority" : "Member View"}
            </span>
          </div>
        </div>

        {/* ── KPI Stats Banner ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Active Teammates
              </span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {members.length}
              </span>
              <span className="text-[10.5px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                Early Access Unlimited
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Organization Admins
              </span>
              <ShieldCheck className="h-4 w-4 text-[var(--brass)]" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-[var(--brass)] font-mono">
                {adminCount}
              </span>
              <span className="text-[10.5px] font-mono text-muted-foreground">
                Full Write &amp; Billing
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Standard Analysts
              </span>
              <Shield className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                {standardCount}
              </span>
              <span className="text-[10.5px] font-mono text-cyan-400 border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 rounded-full">
                Simulate &amp; Review
              </span>
            </div>
          </div>
        </div>

        {/* ── Invite Teammate Card (Admin Only) ── */}
        {isAdmin && (
          <div className="rounded-2xl border border-[var(--brass)]/30 bg-gradient-to-br from-[var(--surface-raised)]/80 to-[var(--brass)]/[0.04] p-6 backdrop-blur-xl shadow-lg shadow-black/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[var(--brass)]/15 border border-[var(--brass)]/30 grid place-items-center text-[var(--brass)]">
                  <UserPlus className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Invite New Teammate
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Invited members receive instant access to execute simulations and view compliance artifacts.
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--brass)] border border-[var(--brass)]/20 bg-[var(--brass)]/10 px-2.5 py-1 rounded-full">
                <Sparkles className="h-3 w-3" /> Zero-friction onboarding
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1.2fr_1fr_auto] gap-3 items-end pt-2">
              <label className="block space-y-1.5">
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  Work Email Address <span className="text-[var(--risk)]">*</span>
                </span>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="colleague@organization.com"
                    className="w-full rounded-xl border search-input-theme pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--brass)]"
                  />
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  Full Name (Optional)
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Elena Rostova"
                  className="w-full rounded-xl border search-input-theme px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--brass)]"
                />
              </label>

              <button
                type="button"
                onClick={() => inviteMut.mutate()}
                disabled={inviteMut.isPending || !email}
                className="h-[38px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brass)] to-[#c59a3f] px-5 text-xs font-semibold text-[var(--ink-base)] shadow-md shadow-[var(--brass)]/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Mail className="h-3.5 w-3.5" />
                {inviteMut.isPending ? "Sending Invite..." : "Send Invitation"}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-[var(--risk)]/10 border border-[var(--risk)]/30 p-3 text-xs text-[var(--risk)]">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {notice && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Members List ── */}
        <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 overflow-hidden backdrop-blur-xl">
          <div className="flex items-center justify-between p-5 border-b border-white/5 bg-white/[0.02]">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Organization Roster ({members.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Current users with authenticated access to this workspace.
              </p>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              Role Permission Model
            </span>
          </div>

          <div className="divide-y divide-white/5">
            {members.map((m) => {
              const initials = getInitials(m.full_name ?? undefined, m.email);
              const isLeadAdmin = m.role === "admin";

              return (
                <div
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="h-10 w-10 shrink-0 rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] grid place-items-center font-mono text-xs font-bold text-foreground">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {m.full_name || m.email || "Unnamed Teammate"}
                        </span>
                        {m.is_self && (
                          <span className="rounded-full bg-[var(--brass)]/15 border border-[var(--brass)]/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--brass)] font-semibold">
                            You
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground truncate mt-0.5">
                        {m.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider font-semibold ${
                        isLeadAdmin
                          ? "border-[var(--brass)]/40 bg-[var(--brass)]/10 text-[var(--brass)]"
                          : "border-white/10 bg-white/[0.02] text-muted-foreground"
                      }`}
                    >
                      {isLeadAdmin ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-[var(--brass)]" strokeWidth={2} />
                      ) : (
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
                      )}
                      {m.role ?? "Member"}
                    </span>

                    {isAdmin && !m.is_self && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Revoke workspace access for ${m.email}?`)) {
                            removeMut.mutate(m.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.02] p-2 text-muted-foreground transition-all hover:border-[var(--risk)]/40 hover:bg-[var(--risk)]/10 hover:text-[var(--risk)] active:scale-95"
                        aria-label={`Remove ${m.email}`}
                        title="Remove Teammate"
                      >
                        <UserMinus className="h-4 w-4" strokeWidth={1.8} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

