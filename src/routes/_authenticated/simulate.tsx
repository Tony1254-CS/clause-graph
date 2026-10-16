import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Zap,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  Edit3,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  FileText,
  Sparkles,
  Info,
  Check,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { GraphMedallion } from "@/components/clausegraph/GraphMedallion";
import { contractsQuery, regulationsQuery, formatUSD } from "@/data/queries";
import { simulateImpact } from "@/lib/simulate.functions";
import { reviewImpactAssessment, getStaleCitationsFn } from "@/lib/impact/review.functions";
import type {
  ImpactEntry,
  Severity,
  SimulationResult,
  EvidenceCard,
  ReviewStatus,
  StaleCitationAlert,
} from "@/lib/simulate-types";
import { ActionPlanPanel } from "@/components/clausegraph/ActionPlanPanel";
import { handlePlanLimitError } from "@/components/PlanLimitDialog";
import { RouteError } from "@/components/clausegraph/RouteError";
import { ProvenanceBadge } from "@/components/clausegraph/ProvenanceBadge";

export const Route = createFileRoute("/_authenticated/simulate")({
  validateSearch: (search: Record<string, unknown>): { text?: string; eventId?: string } => ({
    text: typeof search.text === "string" ? search.text : undefined,
    eventId: typeof search.eventId === "string" ? search.eventId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Simulate Impact — ClauseGraph" },
      {
        name: "description",
        content:
          "Evidence-backed regulatory impact simulator with verbatim clause grounding, quote verification, and audit-logged review.",
      },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(contractsQuery),
      context.queryClient.ensureQueryData(regulationsQuery),
    ]),
  component: SimulatePage,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Simulator unavailable" error={error} reset={reset} />
  ),
});

const SEV_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };
const SEV_BADGE: Record<Severity, string> = {
  high: "border-red-500/40 bg-red-500/10 text-red-400",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  low: "border-blue-500/40 bg-blue-500/10 text-blue-400",
};

const VERDICT_LABEL: Record<string, string> = {
  conflict: "Conflict with Statute",
  gap: "Missing Statutory Safeguard",
  needs_update: "Statute Reference Update",
  compliant: "Fully Compliant",
  insufficient_evidence: "Insufficient Evidence (Abstained)",
};

const DEMO_BD_TEXT = `Under the Cyber Security Ordinance 2025 (Ordinance No. 25 of 2025, repealing the Cyber Security Act 2023), all critical digital service operators must enforce multi-factor authentication, report security incidents to the National Cyber Security Agency within 6 hours, and ensure identity data safeguards under Section 26. All contracts citing repealed provisions of the Digital Security Act 2018 or CSA 2023 must be updated immediately.`;

function HighlightedClause({ text, quote }: { text: string; quote?: string }) {
  if (!quote || !quote.trim()) {
    return <span className="text-muted-foreground">{text}</span>;
  }
  const cleanQuote = quote.trim();
  const idx = text.indexOf(cleanQuote);
  if (idx === -1) {
    return <span className="text-muted-foreground">{text}</span>;
  }
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + cleanQuote.length);
  const after = text.slice(idx + cleanQuote.length);

  return (
    <span className="text-muted-foreground leading-relaxed">
      {before}
      <mark className="bg-amber-400/25 text-amber-200 border-b-2 border-amber-400 px-1 py-0.5 rounded-sm font-medium">
        {match}
      </mark>
      {after}
    </span>
  );
}

function SimulatePage() {
  const search = Route.useSearch();
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: regulations } = useSuspenseQuery(regulationsQuery);
  const runSimulate = useServerFn(simulateImpact);
  const runReview = useServerFn(reviewImpactAssessment);
  const loadStaleCitations = useServerFn(getStaleCitationsFn);

  const [text, setText] = useState(search.text || "");
  const [eventId, setEventId] = useState(search.eventId || "");

  useEffect(() => {
    if (search.text) setText(search.text);
    if (search.eventId) setEventId(search.eventId);
  }, [search.text, search.eventId]);

  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [staleAlerts, setStaleAlerts] = useState<StaleCitationAlert[]>([]);
  const [dismissStaleAlert, setDismissStaleAlert] = useState(false);

  // Per-card review overrides
  const [cardReviews, setCardReviews] = useState<
    Record<
      string,
      {
        status: ReviewStatus;
        suggested_amendment?: string;
        isSubmitting?: boolean;
        isEditing?: boolean;
        draftAmendment?: string;
      }
    >
  >({});

  // Check for stale citations on page mount
  useEffect(() => {
    loadStaleCitations()
      .then((alerts) => setStaleAlerts(alerts || []))
      .catch((err) => console.error("Error loading stale citations", err));
  }, [loadStaleCitations]);

  const contractsById = useMemo(() => {
    const m = new Map<string, (typeof contracts)[number]>();
    contracts.forEach((c) => m.set(c.id, c));
    return m;
  }, [contracts]);

  // Merge server evidence cards with local review status
  const liveCards = useMemo(() => {
    if (!result?.cards) return [];
    return result.cards.map((card) => {
      const review = cardReviews[card.id];
      return {
        ...card,
        review_status: review ? review.status : card.review_status,
        suggested_amendment:
          review?.suggested_amendment !== undefined
            ? review.suggested_amendment
            : card.suggested_amendment,
      };
    });
  }, [result?.cards, cardReviews]);

  // Recalculate deterministic exposure dynamically based on live reviews
  const liveExposure = useMemo(() => {
    const activeImpacts = liveCards.filter(
      (c) =>
        c.review_status !== "rejected" &&
        (c.verdict === "conflict" || c.verdict === "gap" || c.verdict === "needs_update"),
    );

    const contractMap = new Map<string, { value: number; isApproved: boolean }>();
    for (const card of activeImpacts) {
      const val = card.contract_value || contractsById.get(card.contract_id)?.value || 0;
      const isApproved = card.review_status === "approved" || card.review_status === "edited";
      const existing = contractMap.get(card.contract_id);
      if (!existing) {
        contractMap.set(card.contract_id, { value: val, isApproved });
      } else if (isApproved) {
        existing.isApproved = true;
      }
    }

    let total = 0;
    let approved = 0;
    let pending = 0;

    for (const c of contractMap.values()) {
      total += c.value;
      if (c.isApproved) approved += c.value;
      else pending += c.value;
    }

    return {
      totalExposure: total,
      approvedExposure: approved,
      pendingExposure: pending,
      impactedContractsCount: contractMap.size,
    };
  }, [liveCards, contractsById]);

  // Map for Medallion display
  const impactMap = useMemo(() => {
    const m = new Map<string, Severity>();
    liveCards.forEach((c) => {
      if (c.review_status !== "rejected" && c.severity) {
        m.set(c.contract_id, c.severity);
      }
    });
    return m;
  }, [liveCards]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || status === "loading") return;
    setStatus("loading");
    setError(null);
    setResult(null);
    setCardReviews({});

    const startedAt = Date.now();
    try {
      const res = await runSimulate({
        data: {
          regulationText: trimmed,
          eventId: eventId || undefined,
        },
      });
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1200) await new Promise((r) => setTimeout(r, 1200 - elapsed));
      setResult(res);
      setStatus("done");
    } catch (err) {
      if (handlePlanLimitError(err, "simulations")) {
        setStatus("idle");
        return;
      }
      setError(err instanceof Error ? err.message : "Simulation failed");
      setStatus("error");
    }
  }

  async function handleReviewAction(cardId: string, newStatus: ReviewStatus, amendment?: string) {
    setCardReviews((prev) => ({
      ...prev,
      [cardId]: {
        ...prev[cardId],
        isSubmitting: true,
      },
    }));

    try {
      await runReview({
        data: {
          assessmentId: cardId,
          status: newStatus === "pending_review" ? "approved" : newStatus,
          suggestedAmendment: amendment,
        },
      });

      setCardReviews((prev) => ({
        ...prev,
        [cardId]: {
          status: newStatus,
          suggested_amendment: amendment,
          isSubmitting: false,
          isEditing: false,
        },
      }));
    } catch (err) {
      console.error("Failed to submit review action", err);
      setCardReviews((prev) => ({
        ...prev,
        [cardId]: {
          ...prev[cardId],
          isSubmitting: false,
        },
      }));
    }
  }

  return (
    <AppShell>
      <div className="w-full max-w-[1280px] mx-auto space-y-8">
        {/* Stale Citation Alert Banner (Phase 3 T3.5) */}
        {staleAlerts.length > 0 && !dismissStaleAlert && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-200 text-[14px]">
                    Stale-Citation Alert: {staleAlerts.length} Contract Clause(s) Reference Repealed
                    Legislation
                  </h4>
                  <p className="mt-1 text-[13px] text-amber-300/80 leading-relaxed">
                    Clauses in your active contracts cite repealed statutory provisions (such as §26
                    of the Digital Security Act 2018). ClauseGraph detected the statutory repeal
                    chain:
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {staleAlerts[0].repealChain.map((node, i) => (
                      <div key={node.instrumentId} className="flex items-center gap-2">
                        <span
                          className={`font-mono text-[11px] px-2.5 py-1 rounded-md border ${
                            node.status === "in_force"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold"
                              : "bg-red-500/10 text-red-300 border-red-500/30 line-through"
                          }`}
                        >
                          {node.title} ({node.status})
                        </span>
                        {i < staleAlerts[0].repealChain.length - 1 && (
                          <span className="text-amber-400 font-bold">→</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-[12px] text-amber-300/70">
                    Affected contracts:{" "}
                    {staleAlerts.map((a) => `${a.contractName} (${a.matchedCitation})`).join(", ")}.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setDismissStaleAlert(true)}
                className="text-amber-400 hover:text-amber-200 font-mono text-[11px] uppercase tracking-wider"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
          <div className="flex flex-col items-center gap-8 min-w-0">
            <form onSubmit={onSubmit} className="glass-panel w-full p-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-brass" strokeWidth={1.6} />
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
                    Evidence-Backed Regulatory Simulator
                  </p>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground border border-[var(--hairline)] rounded px-2 py-0.5">
                  Phase 3 Pipeline
                </span>
              </div>

              <h2 className="mt-3 font-display text-[22px] leading-[1.15] tracking-tight text-foreground">
                Paste a proposed regulation or statutory text
              </h2>
              <p className="mt-2 text-[13px] leading-[1.6] text-muted-foreground">
                ClauseGraph performs deterministic candidate retrieval, quote-verifying
                classification, and computes un-double-counted portfolio exposure with full
                auditability.
              </p>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste statutory or regulatory text here (e.g. Bangladesh Cyber Security Ordinance 2025, EU AI Act amendments, or GDPR provisions)…"
                rows={7}
                disabled={status === "loading"}
                className="mt-4 w-full resize-y rounded-[12px] border border-[var(--hairline)] bg-[rgba(255,255,255,0.02)] p-4 text-[13.5px] leading-[1.6] text-foreground placeholder:text-muted-foreground/60 focus:border-[var(--hairline-strong)] duration-150 ease-out transition-colors font-sans"
              />

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setText(DEMO_BD_TEXT)}
                    disabled={status === "loading"}
                    className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass hover:text-brass-strong duration-150 ease-out transition-colors"
                  >
                    Load BD CSO 2025 Demo →
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!text.trim() || status === "loading"}
                  className="inline-flex items-center gap-2 rounded-[12px] bg-[var(--brass)] px-5 py-2.5 text-[13px] font-medium text-[var(--primary-foreground)] shadow-[var(--glow-brass)] hover:bg-[var(--brass-strong)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed duration-150 ease-out transition-all"
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                      Analyzing Evidence…
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5" strokeWidth={2} />
                      Simulate Impact
                    </>
                  )}
                </button>
              </div>

              {error && (
                <p className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk)]" />
                  <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
                  {error}
                </p>
              )}
            </form>

            <GraphMedallion
              contracts={contracts}
              regulations={regulations}
              impacts={impactMap.size > 0 ? impactMap : undefined}
              pulsing={status === "loading"}
            />
          </div>

          {/* Exposure & Overview Sidebar */}
          <aside
            className={`glass-panel p-6 lg:sticky lg:top-6 transition-opacity duration-500 ${
              result ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-hidden={!result}
          >
            {result && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
                    Blast Radius Exposure
                  </p>
                  {result.mode === "deterministic" || result.fallback ? (
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-brass border border-brass/30 bg-brass/10 rounded-full px-2.5 py-0.5">
                      Deterministic baseline
                    </span>
                  ) : (
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5" /> Quote Verified AI
                    </span>
                  )}
                </div>

                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Total Active Portfolio Exposure
                </p>
                <p className="mt-1 font-display text-[40px] leading-[1] tracking-tight text-[var(--risk)] tabular-nums">
                  {formatUSD(liveExposure.totalExposure)}
                </p>

                {/* Approved vs Pending breakdown */}
                <div className="mt-3 grid grid-cols-2 gap-2 border-y border-[var(--hairline)] py-3">
                  <div>
                    <p className="font-mono text-[9.5px] uppercase tracking-wider text-emerald-400">
                      Approved by Counsel
                    </p>
                    <p className="text-[15px] font-semibold text-foreground tabular-nums">
                      {formatUSD(liveExposure.approvedExposure)}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[9.5px] uppercase tracking-wider text-amber-400">
                      Pending Review
                    </p>
                    <p className="text-[15px] font-semibold text-foreground tabular-nums">
                      {formatUSD(liveExposure.pendingExposure)}
                    </p>
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-muted-foreground font-mono">
                  Formula: sum(distinct contract.value) across {liveExposure.impactedContractsCount}{" "}
                  affected contract(s)
                </p>

                {result.summary && (
                  <p className="mt-4 text-[12.5px] leading-[1.6] text-muted-foreground border-t border-[var(--hairline)] pt-3">
                    {result.summary}
                  </p>
                )}

                {/* Audit Log Note */}
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-[rgba(255,255,255,0.02)] p-2.5 border border-[var(--hairline)]">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <p className="text-[11px] text-muted-foreground">
                    All assessments are logged to PostgreSQL append-only audit trail with run ID:{" "}
                    <span className="font-mono text-[10px] text-foreground">
                      {result.runId ? result.runId.slice(0, 8) : "local"}
                    </span>
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>

        {/* Per-Clause Evidence Cards (Phase 3 T3.4) */}
        {status === "done" && liveCards.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--hairline)] pb-3">
              <div>
                <h3 className="font-display text-[20px] text-foreground">
                  Per-Clause Evidence Cards ({liveCards.length})
                </h3>
                <p className="text-[12.5px] text-muted-foreground">
                  Every impact is grounded by exact verbatim quotes from both the contract and the
                  authoritative statute.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              {liveCards.map((card) => {
                const reviewState = cardReviews[card.id];
                const isEditing = reviewState?.isEditing;
                const draftText = reviewState?.draftAmendment ?? card.suggested_amendment ?? "";

                return (
                  <div
                    key={card.id}
                    className={`glass-panel p-5 space-y-4 transition-all border ${
                      card.review_status === "approved"
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : card.review_status === "rejected"
                          ? "border-red-500/30 bg-red-500/5 opacity-60"
                          : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]"
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/contracts/$contractId"
                          params={{ contractId: card.contract_id }}
                          className="font-mono text-[12px] font-semibold text-brass hover:underline"
                        >
                          {card.contract_name}
                        </Link>
                        <span className="text-muted-foreground font-mono text-[11px]">
                          ({formatUSD(card.contract_value)})
                        </span>
                        <span
                          className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            card.severity
                              ? SEV_BADGE[card.severity]
                              : "border-gray-500 text-gray-400"
                          }`}
                        >
                          {card.severity ? SEV_LABEL[card.severity] : "None"} Severity
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-brass/30 bg-brass/10 text-brass">
                          {VERDICT_LABEL[card.verdict] || card.verdict}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {Math.round(card.confidence * 100)}% confidence
                        </span>
                        {card.review_status === "approved" ? (
                          <ProvenanceBadge kind="human_approved" />
                        ) : card.origin === "ai" ? (
                          <ProvenanceBadge kind="ai_interpretation" />
                        ) : (
                          <ProvenanceBadge kind="heuristic" />
                        )}
                      </div>
                    </div>

                    {/* Verbatim Grounding Quotes */}
                    <div className="grid gap-3 md:grid-cols-2 bg-[rgba(255,255,255,0.015)] p-4 rounded-xl border border-[var(--hairline)]">
                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1.5">
                          <FileText className="h-3 w-3" /> Grounded Clause Text (Verbatim Quote
                          Highlighted)
                        </p>
                        <div className="text-[12.5px] bg-black/20 p-3 rounded-lg border border-[var(--hairline)]">
                          <HighlightedClause text={card.clause_text} quote={card.clause_quote} />
                        </div>
                      </div>

                      <div>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-brass mb-1 flex items-center gap-1.5">
                          <ShieldCheck className="h-3 w-3" /> Statutory Obligation (
                          {card.instrument_id})
                        </p>
                        <div className="text-[12.5px] bg-black/20 p-3 rounded-lg border border-[var(--hairline)] space-y-1.5">
                          <p className="text-foreground font-medium">"{card.rule_quote}"</p>
                          {card.official_url && (
                            <a
                              href={card.official_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-brass hover:underline mt-1"
                            >
                              <span>Official Instrument Source</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Rationale & Suggested Amendment */}
                    <div className="space-y-2">
                      <p className="text-[13px] text-muted-foreground leading-relaxed">
                        <span className="font-semibold text-foreground">Analysis: </span>
                        {card.rationale}
                      </p>

                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={draftText}
                            onChange={(e) =>
                              setCardReviews((prev) => ({
                                ...prev,
                                [card.id]: {
                                  ...prev[card.id],
                                  draftAmendment: e.target.value,
                                },
                              }))
                            }
                            rows={3}
                            className="w-full rounded-lg border border-[var(--hairline)] bg-black/40 p-3 text-[13px] text-foreground font-sans focus:border-brass"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReviewAction(card.id, "edited", draftText)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-brass text-black text-[12px] font-medium"
                            >
                              <Check className="h-3.5 w-3.5" /> Save & Approve
                            </button>
                            <button
                              onClick={() =>
                                setCardReviews((prev) => ({
                                  ...prev,
                                  [card.id]: { ...prev[card.id], isEditing: false },
                                }))
                              }
                              className="text-[12px] text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        card.suggested_amendment && (
                          <div className="rounded-lg border border-brass/30 bg-brass/5 p-3">
                            <p className="font-mono text-[10px] uppercase tracking-wider text-brass mb-1">
                              Suggested Contract Amendment
                            </p>
                            <p className="text-[13px] text-foreground font-medium">
                              {card.suggested_amendment}
                            </p>
                          </div>
                        )
                      )}
                    </div>

                    {/* Review Actions Footer */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--hairline)]">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-muted-foreground">Status:</span>
                        <span
                          className={`font-mono text-[11px] font-semibold uppercase tracking-wider ${
                            card.review_status === "approved"
                              ? "text-emerald-400"
                              : card.review_status === "rejected"
                                ? "text-red-400"
                                : card.review_status === "edited"
                                  ? "text-blue-400"
                                  : "text-amber-400"
                          }`}
                        >
                          {card.review_status.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleReviewAction(card.id, "approved")}
                          disabled={reviewState?.isSubmitting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 text-[12px] font-medium hover:bg-emerald-500/20 transition-colors"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          onClick={() =>
                            setCardReviews((prev) => ({
                              ...prev,
                              [card.id]: {
                                ...prev[card.id],
                                isEditing: true,
                                draftAmendment: card.suggested_amendment ?? "",
                              },
                            }))
                          }
                          disabled={reviewState?.isSubmitting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--hairline)] text-foreground text-[12px] font-medium hover:bg-[var(--surface-muted)] transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleReviewAction(card.id, "rejected")}
                          disabled={reviewState?.isSubmitting}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-[12px] font-medium hover:bg-red-500/20 transition-colors"
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Insufficient Evidence Bucket (Phase 3 T3.4 / §11.1) */}
        {status === "done" &&
          result?.insufficientEvidence &&
          result.insufficientEvidence.length > 0 && (
            <div className="glass-panel p-6 border border-gray-500/20 space-y-4">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-400" />
                <h3 className="font-display text-[17px] text-foreground">
                  Insufficient Evidence Bucket ({result.insufficientEvidence.length})
                </h3>
              </div>
              <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                In accordance with legal engineering best practices, ClauseGraph abstains from
                claiming non-compliance when verbatim quotes cannot be verified or statutory
                applicability is ambiguous:
              </p>

              <div className="grid gap-3">
                {result.insufficientEvidence.map((card, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[var(--hairline)] p-4 bg-black/20 text-[12.5px]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-foreground">{card.contract_name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {card.instrument_id}
                      </span>
                    </div>
                    <p className="text-muted-foreground italic mb-1">
                      "{card.clause_text.slice(0, 180)}..."
                    </p>
                    <p className="text-blue-300/80 text-[11.5px]">
                      Abstention reason: {card.rationale}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        {/* Action Plan Integration (Phase 3 T3.6) */}
        {status === "done" && result && (
          <ActionPlanPanel
            regulationText={text}
            summary={result.summary}
            impacts={liveCards
              .filter((c) => c.review_status !== "rejected")
              .map((c) => ({
                contract_id: c.contract_id,
                contract_name: c.contract_name,
                severity: (c.severity || "medium") as "low" | "medium" | "high",
                suggested_amendment: c.suggested_amendment || c.rationale,
                assessment_id: c.id,
                clause_quote: c.clause_quote,
                rule_quote: c.rule_quote,
                instrument_id: c.instrument_id,
                official_url: c.official_url,
              }))}
            sources={liveCards
              .filter((c) => c.official_url)
              .map((c) => ({
                instrument_id: c.instrument_id,
                title: c.instrument_title || c.instrument_id,
                official_url: c.official_url,
                quote: c.rule_quote,
              }))}
          />
        )}
      </div>
    </AppShell>
  );
}
