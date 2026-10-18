import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Play,
  Search,
  XCircle,
  FileText,
  ShieldAlert,
  Loader2,
  Sparkles,
  Database,
  Archive,
  RefreshCw,
  ExternalLink,
  GitCompare,
  FileCheck2,
  AlertTriangle,
  History,
  Lock,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import {
  getLegalSourcesFn,
  getCandidateVersionsFn,
  triggerSourceCheckFn,
  approveCandidateVersionFn,
  rejectCandidateVersionFn,
  getBackupsListFn,
  triggerBackupRunFn,
  runRestoreTestFn,
} from "@/lib/document-update.functions";
import type {
  LegalSourceRecord,
  LegalDocVersionRecord,
  SystemBackupRecord,
} from "@/lib/document-update.types";

export const Route = createFileRoute("/_authenticated/legal-sources")({
  head: () => ({
    meta: [
      { title: "Legal Sources, Document Versions & Backups — ClauseGraph" },
      {
        name: "description",
        content: "Authoritative legal registry, candidate version approval diffs, and ACID system restore verification.",
      },
    ],
  }),
  component: LegalSourcesAndBackupsPage,
});

function LegalSourcesAndBackupsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"sources" | "candidates" | "backups">("sources");
  const [selectedCandidate, setSelectedCandidate] = useState<LegalDocVersionRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Queries
  const { data: sources, isLoading: loadingSources, refetch: refetchSources } = useQuery({
    queryKey: ["legal-sources"],
    queryFn: () => getLegalSourcesFn(),
    refetchInterval: 10000,
  });

  const { data: candidates, isLoading: loadingCandidates, refetch: refetchCandidates } = useQuery({
    queryKey: ["candidate-versions"],
    queryFn: () => getCandidateVersionsFn({ data: {} }),
    refetchInterval: 10000,
  });

  const { data: backups, isLoading: loadingBackups, refetch: refetchBackups } = useQuery({
    queryKey: ["system-backups"],
    queryFn: () => getBackupsListFn(),
    refetchInterval: 10000,
  });

  // Mutations
  const checkSourceMutation = useMutation({
    mutationFn: (sourceId: string) => triggerSourceCheckFn({ data: { sourceId } }),
    onSuccess: () => {
      setFeedbackMsg({ type: "success", text: "Background source check job queued successfully." });
      queryClient.invalidateQueries({ queryKey: ["legal-sources"] });
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: "error", text: err.message || "Failed to trigger source check." });
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ versionId, notes }: { versionId: string; notes: string }) =>
      approveCandidateVersionFn({ data: { versionId, reviewNotes: notes } }),
    onSuccess: () => {
      setFeedbackMsg({ type: "success", text: "Document version verified and active regulation updated." });
      setSelectedCandidate(null);
      setReviewNotes("");
      queryClient.invalidateQueries({ queryKey: ["candidate-versions"] });
      queryClient.invalidateQueries({ queryKey: ["legal-sources"] });
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: "error", text: err.message || "Approval failed." });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ versionId, reason }: { versionId: string; reason: string }) =>
      rejectCandidateVersionFn({ data: { versionId, rejectionReason: reason } }),
    onSuccess: () => {
      setFeedbackMsg({ type: "success", text: "Candidate version rejected." });
      setSelectedCandidate(null);
      setReviewNotes("");
      queryClient.invalidateQueries({ queryKey: ["candidate-versions"] });
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: "error", text: err.message || "Rejection failed." });
    },
  });

  const backupMutation = useMutation({
    mutationFn: () => triggerBackupRunFn({ data: { runRestoreTest: true } }),
    onSuccess: () => {
      setFeedbackMsg({ type: "success", text: "ACID system backup and restore verification job queued." });
      queryClient.invalidateQueries({ queryKey: ["system-backups"] });
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: "error", text: err.message || "Backup trigger failed." });
    },
  });

  const restoreTestMutation = useMutation({
    mutationFn: (backupId: string) => runRestoreTestFn({ data: { backupId } }),
    onSuccess: (res) => {
      if (res.ok) {
        setFeedbackMsg({
          type: "success",
          text: `Restore test verified! Validated ${res.recordsVerified.regulations} regulations in ${res.latencyMs}ms.`,
        });
      } else {
        setFeedbackMsg({ type: "error", text: `Restore test failed: ${res.error}` });
      }
      queryClient.invalidateQueries({ queryKey: ["system-backups"] });
    },
    onError: (err: any) => {
      setFeedbackMsg({ type: "error", text: err.message || "Restore test failed." });
    },
  });

  const pendingCandidates = (candidates || []).filter((c) => c.status === "DISCOVERED" || c.status === "UNVERIFIED");

  return (
    <AppShell>
      <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--hairline)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Integrity & Recoverability Engine
            </span>
            <span className="text-xs text-[var(--text-muted)]">Idempotent SHA-256</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)] mt-1">
            Authoritative Legal Sources & System Backups
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Autonomous discovery of official gazette updates, human-in-the-loop candidate approvals, and ACID backup restoration tests.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 text-emerald-300 rounded-lg text-sm font-medium transition"
          >
            {backupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            Run System Backup
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-lg text-sm flex items-center justify-between border ${
            feedbackMsg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-[var(--hairline)] gap-6">
        <button
          onClick={() => setActiveTab("sources")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === "sources"
              ? "border-[var(--brass)] text-[var(--brass)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--ink)]"
          }`}
        >
          <Database className="w-4 h-4" />
          Authoritative Sources ({sources?.length || 0})
        </button>

        <button
          onClick={() => setActiveTab("candidates")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === "candidates"
              ? "border-[var(--brass)] text-[var(--brass)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--ink)]"
          }`}
        >
          <GitCompare className="w-4 h-4" />
          Candidate Document Updates ({pendingCandidates.length})
        </button>

        <button
          onClick={() => setActiveTab("backups")}
          className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === "backups"
              ? "border-[var(--brass)] text-[var(--brass)]"
              : "border-transparent text-[var(--text-muted)] hover:text-[var(--ink)]"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          ACID Backups & Restore Tests ({backups?.length || 0})
        </button>
      </div>

      {/* TAB 1: AUTHORITATIVE SOURCES */}
      {activeTab === "sources" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(sources || []).map((src) => (
              <div
                key={src.id}
                className="p-4 bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl space-y-3 relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-[var(--text-muted)] font-mono">
                      {src.jurisdiction} • {src.document_category}
                    </span>
                    <h3 className="font-semibold text-sm text-[var(--ink)] mt-1.5">{src.source_name}</h3>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      src.verification_status === "VERIFIED"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : src.verification_status === "RATE_LIMITED"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {src.verification_status}
                  </span>
                </div>

                <div className="text-xs text-[var(--text-muted)] space-y-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    <a
                      href={src.official_url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-[var(--brass)] hover:underline"
                    >
                      {src.official_url}
                    </a>
                  </div>
                  <p>Method: {src.retrieval_method} ({src.update_frequency})</p>
                  <p>Last checked: {src.last_successful_check ? new Date(src.last_successful_check).toLocaleString() : "Never"}</p>
                  {src.last_discovered_version && <p>Latest Tag: {src.last_discovered_version}</p>}
                </div>

                <div className="pt-2 border-t border-[var(--hairline)] flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Failures: {src.consecutive_failures}
                  </span>
                  <button
                    onClick={() => checkSourceMutation.mutate(src.id)}
                    disabled={checkSourceMutation.isPending}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded text-[var(--ink)] font-medium transition"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Check Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CANDIDATE DOCUMENT UPDATES & APPROVAL WORKFLOW */}
      {activeTab === "candidates" && (
        <div className="space-y-4">
          {pendingCandidates.length === 0 ? (
            <div className="p-8 text-center bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl">
              <FileCheck2 className="w-8 h-8 mx-auto text-emerald-400 opacity-80" />
              <h3 className="text-base font-semibold mt-2 text-[var(--ink)]">No Pending Candidate Documents</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                All authoritative legal gazette feeds are synchronized with the active regulatory ontology.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Candidate List */}
              <div className="lg:col-span-1 space-y-3">
                {pendingCandidates.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCandidate(c);
                      setReviewNotes("");
                    }}
                    className={`p-3.5 bg-[var(--surface-1)] border rounded-xl cursor-pointer transition ${
                      selectedCandidate?.id === c.id
                        ? "border-[var(--brass)] bg-[var(--brass)]/5"
                        : "border-[var(--hairline)] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/5 text-[var(--brass)]">
                        {c.regulation_id}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-medium">
                        {c.status}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-[var(--ink)] mt-2 line-clamp-1">{c.title}</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Tag: {c.version_tag}</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">
                      Discovered: {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Version Diff & Approval Panel */}
              <div className="lg:col-span-2 bg-[var(--surface-1)] border border-[var(--hairline)] rounded-xl p-5 space-y-5">
                {selectedCandidate ? (
                  <>
                    <div className="flex items-start justify-between border-b border-[var(--hairline)] pb-4">
                      <div>
                        <span className="text-xs font-mono text-[var(--brass)]">
                          {selectedCandidate.regulation_id} • {selectedCandidate.version_tag}
                        </span>
                        <h3 className="text-lg font-bold text-[var(--ink)] mt-1">{selectedCandidate.title}</h3>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                          Publication: {selectedCandidate.publication_date || "N/A"} | Effective: {selectedCandidate.effective_date || "Immediate"}
                        </p>
                      </div>
                      <span className="text-xs font-mono px-2 py-1 bg-white/5 rounded text-[var(--text-muted)]">
                        SHA-256: {selectedCandidate.content_hash.slice(0, 10)}...
                      </span>
                    </div>

                    {/* Diff Inspection */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Structured Version Diff
                      </h4>
                      <div className="p-3 bg-black/30 rounded-lg text-xs space-y-2 border border-[var(--hairline)]">
                        <p className="text-[var(--ink)]">
                          <strong className="text-[var(--brass)]">Summary Changes:</strong>{" "}
                          {selectedCandidate.diff_summary?.summaryChanges || "Executive summary updated."}
                        </p>
                        <p className="text-[var(--ink)]">
                          <strong className="text-[var(--brass)]">Amendment Relationship:</strong>{" "}
                          {selectedCandidate.amendment_relationship || "Statutory clarification"}
                        </p>
                        {selectedCandidate.diff_summary?.addedObligations?.length > 0 && (
                          <div>
                            <span className="text-emerald-400 font-semibold">+ Added Obligations:</span>
                            <ul className="list-disc list-inside text-emerald-300/90 pl-2 mt-1">
                              {selectedCandidate.diff_summary.addedObligations.map((o: string, idx: number) => (
                                <li key={idx}>{o}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {selectedCandidate.diff_summary?.removedObligations?.length > 0 && (
                          <div>
                            <span className="text-red-400 font-semibold">- Removed Obligations:</span>
                            <ul className="list-disc list-inside text-red-300/90 pl-2 mt-1">
                              {selectedCandidate.diff_summary.removedObligations.map((o: string, idx: number) => (
                                <li key={idx}>{o}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Provenance Evidence */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Official Provenance & Verification Evidence
                      </h4>
                      <div className="p-3 bg-white/5 rounded-lg text-xs font-mono text-[var(--text-muted)] space-y-1">
                        <p>Source URL: {selectedCandidate.provenance_evidence?.sourceUrl || selectedCandidate.raw_document_url}</p>
                        <p>Retrieved At: {selectedCandidate.provenance_evidence?.retrievedAt || selectedCandidate.created_at}</p>
                        <p>Content-Length: {selectedCandidate.provenance_evidence?.contentLength || 0} bytes</p>
                        <p>Cryptographic Hash: {selectedCandidate.content_hash}</p>
                      </div>
                    </div>

                    {/* Approval Form */}
                    <div className="space-y-3 pt-3 border-t border-[var(--hairline)]">
                      <label className="block text-xs font-semibold text-[var(--ink)]">
                        Review Notes / Counsel Approval Rationale
                      </label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="State why this version is approved or rejected (required for counsel audit trail)..."
                        className="w-full h-20 p-2.5 bg-black/20 border border-[var(--hairline)] rounded-lg text-xs text-[var(--ink)] focus:outline-none focus:border-[var(--brass)]"
                      />

                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() =>
                            rejectMutation.mutate({
                              versionId: selectedCandidate.id,
                              reason: reviewNotes || "Rejected due to statutory discrepancy",
                            })
                          }
                          disabled={rejectMutation.isPending || approveMutation.isPending}
                          className="px-3.5 py-1.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded-lg text-xs font-medium transition"
                        >
                          Reject Candidate
                        </button>

                        <button
                          onClick={() =>
                            approveMutation.mutate({
                              versionId: selectedCandidate.id,
                              notes: reviewNotes || "Verified against official gazette publication",
                            })
                          }
                          disabled={approveMutation.isPending || rejectMutation.isPending}
                          className="px-4 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-semibold transition flex items-center gap-2"
                        >
                          {approveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Approve & Synchronize Ontology
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-center text-[var(--text-muted)]">
                    <FileText className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">Select a candidate update on the left to inspect version diff and provenance.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SYSTEM BACKUPS & RESTORE VERIFICATION */}
      {activeTab === "backups" && (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-[var(--hairline)] rounded-xl bg-[var(--surface-1)]">
            <table className="w-full text-left text-xs">
              <thead className="bg-white/5 text-[var(--text-muted)] border-b border-[var(--hairline)]">
                <tr>
                  <th className="p-3">Created At</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Records In Manifest</th>
                  <th className="p-3">SHA-256 Checksum</th>
                  <th className="p-3">Restore Test</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--hairline)]">
                {(backups || []).map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-3 font-mono text-[var(--ink)]">
                      {new Date(b.created_at).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-white/5 font-mono text-[var(--text-muted)]">
                        {b.backup_type}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-medium ${
                          b.status === "RESTORE_VERIFIED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : b.status === "COMPLETED"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3 text-[var(--text-muted)]">
                      {b.manifest?.recordCounts?.regulations || 0} regs • {b.manifest?.recordCounts?.amendments || 0} ams • {b.manifest?.recordCounts?.contracts || 0} contracts
                    </td>
                    <td className="p-3 font-mono text-[var(--text-muted)] truncate max-w-[140px]" title={b.sha256_checksum}>
                      {b.sha256_checksum.slice(0, 14)}...
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                          b.restore_test_status === "SUCCESS"
                            ? "text-emerald-400"
                            : b.restore_test_status === "FAILED"
                            ? "text-red-400"
                            : "text-[var(--text-muted)]"
                        }`}
                      >
                        {b.restore_test_status || "NOT_TESTED"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => restoreTestMutation.mutate(b.id)}
                        disabled={restoreTestMutation.isPending}
                        className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded text-[var(--ink)] font-medium transition"
                      >
                        Verify Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </AppShell>
  );
}
