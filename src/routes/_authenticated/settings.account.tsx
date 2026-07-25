import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/clausegraph/AppShell";
import { profileQuery, myRoleQuery } from "@/data/queries";
import { getOrgUsage } from "@/lib/billing.functions";
import {
  requestWorkspaceDeletion,
  cancelWorkspaceDeletion,
} from "@/lib/account.functions";

export const Route = createFileRoute("/_authenticated/settings/account")({
  head: () => ({
    meta: [
      { title: "Account — ClauseGraph" },
      { name: "description", content: "Manage your ClauseGraph account and workspace." },
      { property: "og:title", content: "Account — ClauseGraph" },
      { property: "og:description", content: "Manage your account and workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function AccountPage() {
  const qc = useQueryClient();
  const profile = useQuery(profileQuery);
  const role = useQuery(myRoleQuery);
  const getUsage = useServerFn(getOrgUsage);
  const usage = useQuery({ queryKey: ["org-usage"], queryFn: () => getUsage() });

  // Query deletion_scheduled_at directly (not exposed via getOrgUsage yet)
  const { data: orgMeta } = useQuery({
    queryKey: ["org-meta"],
    queryFn: async () => {
      if (!profile.data?.org?.id) return null;
      const { data } = await supabase
        .from("organizations")
        .select("deletion_scheduled_at")
        .eq("id", profile.data.org.id)
        .maybeSingle();
      return data as { deletion_scheduled_at: string | null } | null;
    },
    enabled: !!profile.data?.org?.id,
  });

  const requestDelete = useServerFn(requestWorkspaceDeletion);
  const cancelDelete = useServerFn(cancelWorkspaceDeletion);

  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<"delete" | "cancel" | "signout" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role.data === "admin";
  const scheduledAt = orgMeta?.deletion_scheduled_at ?? null;
  const orgName = profile.data?.org?.name ?? "workspace";
  const canConfirm = confirm.trim().toLowerCase() === orgName.trim().toLowerCase();

  async function handleDelete() {
    setError(null);
    setBusy("delete");
    try {
      await requestDelete();
      await qc.invalidateQueries({ queryKey: ["org-meta"] });
      setConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deletion failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    setError(null);
    setBusy("cancel");
    try {
      await cancelDelete();
      await qc.invalidateQueries({ queryKey: ["org-meta"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleSignOut() {
    setBusy("signout");
    await supabase.auth.signOut();
    window.location.assign("/auth");
  }

  return (
    <AppShell>
      <div className="w-full max-w-[900px] flex flex-col gap-8">
        <header>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">Account</p>
          <h1 className="mt-2 font-display text-[36px] leading-tight text-foreground">
            Account & workspace
          </h1>
          <p className="mt-2 text-[13.5px] text-muted-foreground max-w-[62ch]">
            Your profile, sign-out, and workspace controls. Only admins can delete a workspace.
          </p>
        </header>

        <section className="glass-panel p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Profile
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Name" value={profile.data?.full_name ?? "—"} />
            <Field label="Email" value={profile.data?.email ?? "—"} />
            <Field label="Workspace" value={profile.data?.org?.name ?? "—"} />
            <Field label="Plan" value={(usage.data?.plan ?? "free").toUpperCase()} mono />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={busy === "signout"}
              className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--hairline-strong)] px-4 py-2 text-[13px] text-foreground hover:border-brass hover:text-brass transition-colors disabled:opacity-60"
            >
              {busy === "signout" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Sign out
            </button>
          </div>
        </section>

        {isAdmin ? (
          <section className="glass-panel border-[rgba(225,82,75,0.3)] p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-[var(--risk)] mt-0.5 shrink-0" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--risk)]">
                  Danger zone
                </p>
                <h2 className="mt-2 font-display text-[22px] text-foreground">Delete workspace</h2>
                <p className="mt-2 text-[13px] text-muted-foreground max-w-[62ch]">
                  This permanently removes the {orgName} workspace, all contracts, simulation
                  results, action plans, and teammates. Any active subscription will be canceled at
                  the end of the current billing period. Deletion is scheduled for 30 days from
                  now — you can cancel it any time before then from this page.
                </p>
              </div>
            </div>

            {scheduledAt ? (
              <div className="mt-5 rounded-[12px] border border-[rgba(225,82,75,0.35)] bg-[rgba(225,82,75,0.06)] p-4">
                <p className="text-[13px] text-foreground">
                  Deletion is scheduled for{" "}
                  <span className="font-mono">{fmtDate(scheduledAt)}</span>.
                </p>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={busy === "cancel"}
                  className="mt-3 inline-flex items-center gap-2 rounded-[12px] bg-brass px-4 py-2 text-[13px] text-[color:var(--primary-foreground)] hover:bg-[color:var(--brass-strong)] transition-colors disabled:opacity-60"
                >
                  {busy === "cancel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Cancel deletion
                </button>
              </div>
            ) : (
              <div className="mt-5">
                <label className="block text-[12.5px] text-muted-foreground">
                  Type{" "}
                  <span className="font-mono text-foreground">{orgName}</span> to confirm
                </label>
                <input
                  className="mt-2 w-full glass-input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={orgName}
                />
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canConfirm || busy === "delete"}
                  className="mt-3 inline-flex items-center gap-2 rounded-[12px] border border-[rgba(225,82,75,0.4)] bg-[rgba(225,82,75,0.08)] px-4 py-2 text-[13px] text-[var(--risk)] hover:bg-[rgba(225,82,75,0.14)] transition-colors disabled:opacity-40"
                >
                  {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Delete workspace
                </button>
              </div>
            )}

            {error ? (
              <p className="mt-3 text-[13px] text-[var(--risk)]">{error}</p>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1.5 text-[15px] text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
