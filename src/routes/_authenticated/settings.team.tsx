import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserMinus, Mail, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { teamMembersQuery, myRoleQuery, profileQuery } from "@/data/queries";
import { inviteTeammate, removeTeammate } from "@/lib/team.functions";
import { handlePlanLimitError } from "@/components/PlanLimitDialog";
import { RouteError } from "@/components/clausegraph/RouteError";

export const Route = createFileRoute("/_authenticated/settings/team")({
  head: () => ({
    meta: [
      { title: "Team — ClauseGraph" },
      { name: "description", content: "Manage teammates and roles for your ClauseGraph organization." },
      { property: "og:title", content: "Team — ClauseGraph" },
      { property: "og:description", content: "Manage teammates and roles for your ClauseGraph organization." },
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
      setNotice("Invitation sent.");
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

  return (
    <AppShell>
      <div className="w-full max-w-[900px]">
        <header className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
            {profile?.org?.name ?? "Workspace"}
          </p>
          <h1 className="mt-2 font-display text-[38px] leading-[1.05] tracking-tight text-foreground">
            Team
          </h1>
          <p className="mt-2 text-[13.5px] text-muted-foreground max-w-[62ch]">
            Members of your organization can view contracts, run simulations, and generate action
            plans. Admins can invite and remove teammates.
          </p>
        </header>

        {isAdmin ? (
          <div className="glass-panel p-6 mb-8">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass mb-3">
              Invite a teammate
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Email
                </span>
                <input
                  type="email"
                  className="mt-1 w-full glass-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Full name (optional)
                </span>
                <input
                  className="mt-1 w-full glass-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
              <button
                className="rounded-[12px] bg-brass px-5 py-2 text-sm text-[color:var(--primary-foreground)] transition-all duration-150 ease-out hover:bg-[color:var(--brass-strong)] disabled:opacity-50"
                onClick={() => inviteMut.mutate()}
                disabled={inviteMut.isPending || !email}
              >
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" strokeWidth={1.8} />
                  {inviteMut.isPending ? "Sending…" : "Send invite"}
                </span>
              </button>
            </div>
            {error ? <p className="mt-3 text-sm text-[var(--risk)]">{error}</p> : null}
            {notice ? <p className="mt-3 text-sm text-brass">{notice}</p> : null}
          </div>
        ) : null}

        <div className="glass-panel divide-y divide-[var(--hairline)]">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="font-display text-[16px] text-foreground truncate">
                  {m.full_name || m.email || "Unnamed"}
                  {m.is_self ? (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-brass">
                      you
                    </span>
                  ) : null}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground truncate">{m.email}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
                    m.role === "admin"
                      ? "border-[var(--hairline-strong)] text-brass"
                      : "border-[var(--hairline)] text-muted-foreground"
                  }`}
                >
                  {m.role === "admin" ? <ShieldCheck className="h-3 w-3" strokeWidth={2} /> : null}
                  {m.role ?? "—"}
                </span>
                {isAdmin && !m.is_self ? (
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${m.email} from the workspace?`)) {
                        removeMut.mutate(m.id);
                      }
                    }}
                    className="text-muted-foreground hover:text-[var(--risk)] transition-colors duration-150 ease-out"
                    aria-label="Remove teammate"
                  >
                    <UserMinus className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
