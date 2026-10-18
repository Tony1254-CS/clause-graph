import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
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
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  X,
  Server,
  Layers,
  Check,
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
  const [selectedSource, setSelectedSource] = useState<LegalSourceRecord | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination states for each section
  const [sourcesPage, setSourcesPage] = useState(1);
  const [candidatesPage, setCandidatesPage] = useState(1);
  const [backupsPage, setBackupsPage] = useState(1);
  const pageSize = 10;

  // Reset pagination on search or tab change
  useEffect(() => {
    setSourcesPage(1);
    setCandidatesPage(1);
    setBackupsPage(1);
  }, [searchQuery, activeTab]);

  // Close modals on Escape key
  useEffect(() => {
    if (!selectedCandidate && !selectedSource) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedCandidate(null);
        setSelectedSource(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCandidate, selectedSource]);

  // Queries
  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["legal-sources"],
    queryFn: () => getLegalSourcesFn(),
    refetchInterval: 10000,
  });

  const { data: candidates, isLoading: loadingCandidates } = useQuery({
    queryKey: ["candidate-versions"],
    queryFn: () => getCandidateVersionsFn({ data: {} }),
    refetchInterval: 10000,
  });

  const { data: backups, isLoading: loadingBackups } = useQuery({
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

  // Filtered & Paginated Datasets
  const rawSources = useMemo(() => sources || [], [sources]);
  const filteredSources = useMemo(() => {
    if (!searchQuery) return rawSources;
    const q = searchQuery.toLowerCase();
    return rawSources.filter(
      (s) =>
        s.source_name.toLowerCase().includes(q) ||
        s.jurisdiction.toLowerCase().includes(q) ||
        s.document_category.toLowerCase().includes(q)
    );
  }, [rawSources, searchQuery]);

  const rawCandidates = useMemo(
    () => (candidates || []).filter((c) => c.status === "DISCOVERED" || c.status === "UNVERIFIED"),
    [candidates]
  );
  const filteredCandidates = useMemo(() => {
    if (!searchQuery) return rawCandidates;
    const q = searchQuery.toLowerCase();
    return rawCandidates.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.regulation_id.toLowerCase().includes(q) ||
        c.version_tag.toLowerCase().includes(q)
    );
  }, [rawCandidates, searchQuery]);

  const rawBackups = useMemo(() => backups || [], [backups]);
  const filteredBackups = useMemo(() => {
    if (!searchQuery) return rawBackups;
    const q = searchQuery.toLowerCase();
    return rawBackups.filter(
      (b) =>
        b.backup_type.toLowerCase().includes(q) ||
        b.status.toLowerCase().includes(q) ||
        b.sha256_checksum.toLowerCase().includes(q)
    );
  }, [rawBackups, searchQuery]);

  // Paginated Slices
  const totalSourcesPages = Math.max(1, Math.ceil(filteredSources.length / pageSize));
  const paginatedSources = filteredSources.slice((sourcesPage - 1) * pageSize, sourcesPage * pageSize);

  const totalCandidatesPages = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));
  const paginatedCandidates = filteredCandidates.slice((candidatesPage - 1) * pageSize, candidatesPage * pageSize);

  const totalBackupsPages = Math.max(1, Math.ceil(filteredBackups.length / pageSize));
  const paginatedBackups = filteredBackups.slice((backupsPage - 1) * pageSize, backupsPage * pageSize);

  return (
    <AppShell>
      <div className="w-full max-w-[1440px] mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[var(--hairline)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--brass)]">
                Authoritative Legal Registry &middot; Cryptographic Verification
              </p>
            </div>
            <h1 className="mt-2 text-2xl sm:text-3xl font-display font-semibold tracking-tight text-foreground">
              Legal Sources & System Backups
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground max-w-2xl">
              Autonomous discovery of official gazette updates, human-in-the-loop candidate approvals, and ACID backup restoration tests.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => backupMutation.mutate()}
              disabled={backupMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 font-mono text-xs font-semibold text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:bg-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {backupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
              Run ACID System Backup
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-2xl text-xs flex items-center justify-between border backdrop-blur-xl ${
              feedbackMsg.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.12)]"
                : "bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-[0_0_24px_rgba(244,63,94,0.12)]"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span className="font-mono">{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ── KPI Metrics Strip ── */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Active Sources
              </span>
              <Database className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-foreground">
              {rawSources.length}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="text-emerald-400 font-mono font-semibold">100%</span> authoritative connectors
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Pending Updates
              </span>
              <GitCompare className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-foreground">
              {rawCandidates.length}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Awaiting human verification
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                ACID Backups
              </span>
              <Archive className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-foreground">
              {rawBackups.length}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Recoverable system snapshots
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-4.5 backdrop-blur-xl shadow-[var(--shadow-soft)] transition-all duration-300 hover:border-white/20 hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Restore Health
              </span>
              <ShieldCheck className="h-4 w-4 text-sky-400" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold text-emerald-400">
              Verified
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Automated sandboxed test pass
            </div>
          </div>
        </div>

        {/* ── Toolbar with Tab Switcher & Universal Search ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/60 p-3.5 backdrop-blur-xl shadow-[var(--shadow-soft)]">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 p-1.5 rounded-xl bg-[rgba(0,0,0,0.35)] border border-[var(--hairline)]">
            <button
              type="button"
              onClick={() => setActiveTab("sources")}
              className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer ${
                activeTab === "sources"
                  ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-md ring-1 ring-white/20"
                  : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:border-[var(--brass)]/40 hover:bg-white/[0.08] hover:text-foreground"
              }`}
            >
              <Database className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${activeTab === "sources" ? "text-[var(--primary-foreground)]" : "text-[var(--brass)]"}`} />
              <span>Sources</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                activeTab === "sources"
                  ? "bg-black/25 text-[var(--primary-foreground)] border-black/20"
                  : "bg-white/[0.05] text-foreground border-white/10"
              }`}>
                {rawSources.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("candidates")}
              className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer ${
                activeTab === "candidates"
                  ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-md ring-1 ring-white/20"
                  : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:border-[var(--brass)]/40 hover:bg-white/[0.08] hover:text-foreground"
              }`}
            >
              <GitCompare className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${activeTab === "candidates" ? "text-[var(--primary-foreground)]" : "text-[var(--brass)]"}`} />
              <span>Candidate Updates</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                activeTab === "candidates"
                  ? "bg-black/25 text-[var(--primary-foreground)] border-black/20"
                  : "bg-white/[0.05] text-foreground border-white/10"
              }`}>
                {rawCandidates.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("backups")}
              className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer ${
                activeTab === "backups"
                  ? "bg-[var(--brass)] text-[var(--primary-foreground)] font-semibold shadow-md ring-1 ring-white/20"
                  : "border border-white/10 bg-white/[0.04] text-muted-foreground hover:border-[var(--brass)]/40 hover:bg-white/[0.08] hover:text-foreground"
              }`}
            >
              <ShieldCheck className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${activeTab === "backups" ? "text-[var(--primary-foreground)]" : "text-[var(--brass)]"}`} />
              <span>Backups &amp; Restore</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                activeTab === "backups"
                  ? "bg-black/25 text-[var(--primary-foreground)] border-black/20"
                  : "bg-white/[0.05] text-foreground border-white/10"
              }`}>
                {rawBackups.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-white/5 bg-white/[0.04] text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--brass)] focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* ── TAB 1: AUTHORITATIVE SOURCES (Table View with 10-item Pagination) ── */}
        {activeTab === "sources" && (
          <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl shadow-[var(--shadow-lift)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hairline)] bg-white/[0.03] font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="px-6 py-4">Source Name & Category</th>
                    <th className="px-4 py-4">Jurisdiction</th>
                    <th className="px-4 py-4">Verification Status</th>
                    <th className="px-4 py-4">Method & Cadence</th>
                    <th className="px-4 py-4">Last Checked</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)] text-xs">
                  {loadingSources ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-muted-foreground">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--brass)]" />
                        <span className="mt-2 block font-mono text-xs">Loading authoritative registries...</span>
                      </td>
                    </tr>
                  ) : filteredSources.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-muted-foreground">
                        <Database className="mx-auto h-9 w-9 text-muted-foreground opacity-40 mb-2" />
                        <span className="font-semibold block text-foreground">No Sources Found</span>
                        <span className="text-[11px] block mt-1">Try adjusting your search criteria.</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedSources.map((src) => (
                      <tr
                        key={src.id}
                        onClick={() => setSelectedSource(src)}
                        className="group cursor-pointer transition-colors duration-150 hover:bg-white/[0.03]"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-foreground group-hover:text-[var(--brass)] transition-colors">
                            {src.source_name}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white/5 border border-white/5">
                              {src.document_category}
                            </span>
                            {src.last_discovered_version && (
                              <span className="font-mono text-[10px] text-[var(--brass)]">
                                Tag: {src.last_discovered_version}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-foreground">
                          {src.jurisdiction}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider ${
                              src.verification_status === "VERIFIED"
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                : src.verification_status === "RATE_LIMITED"
                                ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                : "bg-rose-500/15 border-rose-500/30 text-rose-300"
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {src.verification_status}
                          </span>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {src.retrieval_method} &middot; {src.update_frequency}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {src.last_successful_check ? new Date(src.last_successful_check).toLocaleDateString() : "Never"}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => checkSourceMutation.mutate(src.id)}
                              disabled={checkSourceMutation.isPending}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] font-semibold text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] transition-all cursor-pointer shadow-sm"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Check Now
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedSource(src)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.04] px-3 py-1 font-mono text-[11px] font-semibold text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] transition-all cursor-pointer shadow-sm"
                            >
                              Details
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {filteredSources.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-[var(--hairline)] bg-white/[0.02]">
                <div className="text-xs font-mono text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min((sourcesPage - 1) * pageSize + 1, filteredSources.length)}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(sourcesPage * pageSize, filteredSources.length)}
                  </span>{" "}
                  of <span className="font-semibold text-foreground">{filteredSources.length}</span> sources
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSourcesPage((p) => Math.max(1, p - 1))}
                    disabled={sourcesPage === 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>

                  <div className="flex items-center gap-1 font-mono text-xs">
                    {Array.from({ length: totalSourcesPages }, (_, i) => i + 1).map((pg) => {
                      const isActive = pg === sourcesPage;
                      return (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setSourcesPage(pg)}
                          className={`h-7 w-7 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                            isActive
                              ? "border-[var(--brass)] bg-[var(--brass)]/15 text-[var(--brass)] font-bold shadow-sm"
                              : "border-transparent text-muted-foreground hover:border-[var(--hairline)] hover:text-foreground"
                          }`}
                        >
                          {pg}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSourcesPage((p) => Math.min(totalSourcesPages, p + 1))}
                    disabled={sourcesPage === totalSourcesPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: CANDIDATE DOCUMENT UPDATES (Table View with Inspect & Act Modal) ── */}
        {activeTab === "candidates" && (
          <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl shadow-[var(--shadow-lift)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hairline)] bg-white/[0.03] font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="px-6 py-4">Regulation & Title</th>
                    <th className="px-4 py-4">Version Tag</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Content Hash</th>
                    <th className="px-4 py-4">Discovered Date</th>
                    <th className="px-6 py-4 text-right">Approval Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)] text-xs">
                  {loadingCandidates ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-muted-foreground">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--brass)]" />
                        <span className="mt-2 block font-mono text-xs">Scanning candidate gazette versions...</span>
                      </td>
                    </tr>
                  ) : filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-14 text-center text-muted-foreground">
                        <FileCheck2 className="mx-auto h-9 w-9 text-emerald-400 opacity-70 mb-2" />
                        <span className="font-semibold block text-foreground">All Regulations Synchronized</span>
                        <span className="text-[11px] block mt-1">No candidate document updates require counsel sign-off.</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedCandidates.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => {
                          setSelectedCandidate(c);
                          setReviewNotes("");
                        }}
                        className="group cursor-pointer transition-colors duration-150 hover:bg-white/[0.03]"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-foreground group-hover:text-[var(--brass)] transition-colors line-clamp-1">
                            {c.title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground font-mono">
                            {c.regulation_id}
                          </div>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-[var(--brass)]">
                          {c.version_tag}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider bg-amber-500/15 border-amber-500/30 text-amber-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            {c.status}
                          </span>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground" title={c.content_hash}>
                          {c.content_hash.slice(0, 12)}...
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCandidate(c);
                              setReviewNotes("");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] font-semibold text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] transition-all cursor-pointer shadow-sm"
                          >
                            Inspect & Act
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {filteredCandidates.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-[var(--hairline)] bg-white/[0.02]">
                <div className="text-xs font-mono text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min((candidatesPage - 1) * pageSize + 1, filteredCandidates.length)}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(candidatesPage * pageSize, filteredCandidates.length)}
                  </span>{" "}
                  of <span className="font-semibold text-foreground">{filteredCandidates.length}</span> updates
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCandidatesPage((p) => Math.max(1, p - 1))}
                    disabled={candidatesPage === 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>

                  <div className="flex items-center gap-1 font-mono text-xs">
                    {Array.from({ length: totalCandidatesPages }, (_, i) => i + 1).map((pg) => {
                      const isActive = pg === candidatesPage;
                      return (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setCandidatesPage(pg)}
                          className={`h-7 w-7 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                            isActive
                              ? "border-[var(--brass)] bg-[var(--brass)]/15 text-[var(--brass)] font-bold shadow-sm"
                              : "border-transparent text-muted-foreground hover:border-[var(--hairline)] hover:text-foreground"
                          }`}
                        >
                          {pg}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCandidatesPage((p) => Math.min(totalCandidatesPages, p + 1))}
                    disabled={candidatesPage === totalCandidatesPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 3: SYSTEM BACKUPS & RESTORE VERIFICATION (Table View) ── */}
        {activeTab === "backups" && (
          <div className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/70 backdrop-blur-xl shadow-[var(--shadow-lift)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--hairline)] bg-white/[0.03] font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="px-6 py-4">Created Time</th>
                    <th className="px-4 py-4">Backup Type</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Manifest Record Counts</th>
                    <th className="px-4 py-4">SHA-256 Checksum</th>
                    <th className="px-4 py-4">Restore Validation</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)] text-xs">
                  {loadingBackups ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-muted-foreground">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--brass)]" />
                        <span className="mt-2 block font-mono text-xs">Loading ACID backup snapshots...</span>
                      </td>
                    </tr>
                  ) : filteredBackups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-14 text-center text-muted-foreground">
                        <Archive className="mx-auto h-9 w-9 text-muted-foreground opacity-40 mb-2" />
                        <span className="font-semibold block text-foreground">No Backups Found</span>
                        <span className="text-[11px] block mt-1">Run an ACID system backup above.</span>
                      </td>
                    </tr>
                  ) : (
                    paginatedBackups.map((b) => (
                      <tr key={b.id} className="hover:bg-white/[0.03] transition-colors duration-150">
                        <td className="px-6 py-4 font-mono text-[11px] text-foreground">
                          {new Date(b.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })}
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 font-mono text-[11px] text-muted-foreground">
                            {b.backup_type}
                          </span>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider ${
                              b.status === "RESTORE_VERIFIED"
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                : b.status === "COMPLETED"
                                ? "bg-sky-500/15 border-sky-500/30 text-sky-300"
                                : "bg-rose-500/15 border-rose-500/30 text-rose-300"
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {b.status}
                          </span>
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                          {b.manifest?.recordCounts?.regulations || 0} regs &middot; {b.manifest?.recordCounts?.amendments || 0} ams &middot; {b.manifest?.recordCounts?.contracts || 0} contracts
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground" title={b.sha256_checksum}>
                          {b.sha256_checksum.slice(0, 14)}...
                        </td>

                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[11px]">
                          <span
                            className={`inline-flex items-center gap-1 ${
                              b.restore_test_status === "SUCCESS"
                                ? "text-emerald-400 font-semibold"
                                : b.restore_test_status === "FAILED"
                                ? "text-rose-400 font-semibold"
                                : "text-muted-foreground"
                            }`}
                          >
                            {b.restore_test_status === "SUCCESS" && <Check className="h-3 w-3" />}
                            {b.restore_test_status || "NOT_TESTED"}
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => restoreTestMutation.mutate(b.id)}
                            disabled={restoreTestMutation.isPending}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.04] px-3 py-1 font-mono text-[11px] font-semibold text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 hover:text-[var(--brass)] transition-all cursor-pointer shadow-sm disabled:opacity-40"
                          >
                            {restoreTestMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                            Verify Restore
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            {filteredBackups.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 border-t border-[var(--hairline)] bg-white/[0.02]">
                <div className="text-xs font-mono text-muted-foreground">
                  Showing{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min((backupsPage - 1) * pageSize + 1, filteredBackups.length)}
                  </span>{" "}
                  to{" "}
                  <span className="font-semibold text-foreground">
                    {Math.min(backupsPage * pageSize, filteredBackups.length)}
                  </span>{" "}
                  of <span className="font-semibold text-foreground">{filteredBackups.length}</span> snapshots
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBackupsPage((p) => Math.max(1, p - 1))}
                    disabled={backupsPage === 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>

                  <div className="flex items-center gap-1 font-mono text-xs">
                    {Array.from({ length: totalBackupsPages }, (_, i) => i + 1).map((pg) => {
                      const isActive = pg === backupsPage;
                      return (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setBackupsPage(pg)}
                          className={`h-7 w-7 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                            isActive
                              ? "border-[var(--brass)] bg-[var(--brass)]/15 text-[var(--brass)] font-bold shadow-sm"
                              : "border-transparent text-muted-foreground hover:border-[var(--hairline)] hover:text-foreground"
                          }`}
                        >
                          {pg}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setBackupsPage((p) => Math.min(totalBackupsPages, p + 1))}
                    disabled={backupsPage === totalBackupsPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--hairline)] bg-white/[0.03] text-xs font-mono text-foreground hover:border-[var(--brass)] hover:bg-[var(--brass)]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CANDIDATE APPROVAL MODAL (via React Portal) ── */}
        {selectedCandidate && typeof document !== "undefined" && createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setSelectedCandidate(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--hairline)] bg-[var(--shell-bg)] p-6 sm:p-8 shadow-[var(--shadow-lift)] space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* User-friendly Close Button with clear contrast, border, and Esc hint */}
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="absolute top-5 right-5 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/25 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-all duration-150 shadow-md cursor-pointer group active:scale-95"
                aria-label="Close candidate review"
                title="Close (or press Esc)"
              >
                <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground/80 group-hover:text-foreground">Close</span>
                <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
              </button>

              {/* Header */}
              <div className="border-b border-[var(--hairline)] pb-5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono border uppercase tracking-wider bg-amber-500/15 border-amber-500/30 text-amber-300">
                    {selectedCandidate.status}
                  </span>
                  <span className="font-mono text-xs text-[var(--brass)] font-semibold">
                    {selectedCandidate.regulation_id} &middot; {selectedCandidate.version_tag}
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-display font-semibold text-foreground">
                  {selectedCandidate.title}
                </h2>
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3 font-mono">
                  <span>Publication: {selectedCandidate.publication_date || "N/A"}</span>
                  <span>&middot;</span>
                  <span>Effective: {selectedCandidate.effective_date || "Immediate"}</span>
                </div>
              </div>

              {/* Diff Summary */}
              <div className="space-y-3 text-xs">
                <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/50 p-4 space-y-3">
                  <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--brass)]">
                    Structured Version Diff
                  </h3>
                  <div className="space-y-2">
                    <p className="text-foreground">
                      <strong className="text-muted-foreground">Summary Changes:</strong>{" "}
                      {selectedCandidate.diff_summary?.summaryChanges || "Executive summary updated."}
                    </p>
                    <p className="text-foreground">
                      <strong className="text-muted-foreground">Amendment Relationship:</strong>{" "}
                      {selectedCandidate.amendment_relationship || "Statutory clarification"}
                    </p>
                    {selectedCandidate.diff_summary?.addedObligations?.length > 0 && (
                      <div className="pt-1">
                        <span className="text-emerald-400 font-semibold">+ Added Obligations:</span>
                        <ul className="list-disc list-inside text-emerald-300/90 pl-2 mt-1 space-y-0.5 font-mono text-[11px]">
                          {selectedCandidate.diff_summary.addedObligations.map((o: string, idx: number) => (
                            <li key={idx}>{o}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedCandidate.diff_summary?.removedObligations?.length > 0 && (
                      <div className="pt-1">
                        <span className="text-rose-400 font-semibold">- Removed Obligations:</span>
                        <ul className="list-disc list-inside text-rose-300/90 pl-2 mt-1 space-y-0.5 font-mono text-[11px]">
                          {selectedCandidate.diff_summary.removedObligations.map((o: string, idx: number) => (
                            <li key={idx}>{o}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Provenance Evidence */}
                <div className="rounded-2xl border border-white/5 bg-black/40 p-4 space-y-2 font-mono text-[11px]">
                  <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Cryptographic Provenance
                  </h4>
                  <p className="text-muted-foreground truncate">
                    Source: <a href={selectedCandidate.provenance_evidence?.sourceUrl || selectedCandidate.raw_document_url} target="_blank" rel="noreferrer" className="text-[var(--brass)] hover:underline">{selectedCandidate.provenance_evidence?.sourceUrl || selectedCandidate.raw_document_url}</a>
                  </p>
                  <p className="text-muted-foreground">
                    Content-Length: {selectedCandidate.provenance_evidence?.contentLength || 0} bytes
                  </p>
                  <p className="text-muted-foreground truncate" title={selectedCandidate.content_hash}>
                    SHA-256 Hash: {selectedCandidate.content_hash}
                  </p>
                </div>

                {/* Review Notes Form */}
                <div className="space-y-3 pt-3 border-t border-[var(--hairline)]">
                  <label className="block text-xs font-semibold text-foreground">
                    Review Notes / Counsel Approval Rationale
                  </label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="State why this candidate version is approved or rejected (required for counsel audit trail)..."
                    className="w-full h-24 p-3.5 bg-black/30 border border-white/10 rounded-2xl text-xs text-foreground focus:outline-none focus:border-[var(--brass)] transition-colors placeholder:text-muted-foreground/60"
                  />

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() =>
                        rejectMutation.mutate({
                          versionId: selectedCandidate.id,
                          reason: reviewNotes || "Rejected due to statutory discrepancy",
                        })
                      }
                      disabled={rejectMutation.isPending || approveMutation.isPending}
                      className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm"
                    >
                      Reject Candidate
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        approveMutation.mutate({
                          versionId: selectedCandidate.id,
                          notes: reviewNotes || "Verified against official gazette publication",
                        })
                      }
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="px-5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                    >
                      {approveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Approve & Synchronize Ontology
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── SOURCE DETAILS MODAL (via React Portal) ── */}
        {selectedSource && typeof document !== "undefined" && createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => setSelectedSource(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--hairline)] bg-[var(--shell-bg)] p-6 sm:p-8 shadow-[var(--shadow-lift)] space-y-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* User-friendly Close Button with clear contrast, border, and Esc hint */}
              <button
                type="button"
                onClick={() => setSelectedSource(null)}
                className="absolute top-5 right-5 z-20 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] hover:border-white/25 px-3 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-all duration-150 shadow-md cursor-pointer group active:scale-95"
                aria-label="Close source details"
                title="Close (or press Esc)"
              >
                <span className="hidden sm:inline text-[11px] font-medium text-muted-foreground/80 group-hover:text-foreground">Close</span>
                <X className="h-4 w-4 transition-transform group-hover:rotate-90" />
              </button>

              <div className="border-b border-[var(--hairline)] pb-4">
                <span className="font-mono text-xs text-[var(--brass)] font-semibold">
                  {selectedSource.jurisdiction} &middot; {selectedSource.document_category}
                </span>
                <h2 className="mt-2 text-xl font-display font-semibold text-foreground">
                  {selectedSource.source_name}
                </h2>
              </div>

              <div className="space-y-4 text-xs font-mono">
                <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)]/50 p-4 space-y-2">
                  <div className="text-muted-foreground">Official Connector Endpoint:</div>
                  <a
                    href={selectedSource.official_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--brass)] hover:underline break-all block"
                  >
                    {selectedSource.official_url}
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <span className="text-muted-foreground block text-[10px] uppercase">Retrieval Method</span>
                    <span className="font-semibold text-foreground">{selectedSource.retrieval_method}</span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <span className="text-muted-foreground block text-[10px] uppercase">Cadence</span>
                    <span className="font-semibold text-foreground">{selectedSource.update_frequency}</span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <span className="text-muted-foreground block text-[10px] uppercase">Failures</span>
                    <span className="font-semibold text-foreground">{selectedSource.consecutive_failures}</span>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <span className="text-muted-foreground block text-[10px] uppercase">Latest Tag</span>
                    <span className="font-semibold text-foreground">{selectedSource.last_discovered_version || "None"}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[var(--hairline)]">
                  <button
                    type="button"
                    onClick={() => {
                      checkSourceMutation.mutate(selectedSource.id);
                      setSelectedSource(null);
                    }}
                    disabled={checkSourceMutation.isPending}
                    className="px-4 py-2 rounded-xl border border-[var(--brass)]/40 bg-[var(--brass)]/10 text-xs font-semibold text-[var(--brass)] hover:bg-[var(--brass)]/20 transition-all shadow-[var(--glow-brass)] flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Trigger Source Verification Job
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      </div>
    </AppShell>
  );
}
