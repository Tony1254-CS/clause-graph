import { useState, useMemo } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Zap,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Search,
  Scale,
  Calendar,
  Layers,
  Sparkles,
  Inbox,
  BookmarkCheck,
  Trash2,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { JurisdictionChip } from "@/components/clausegraph/JurisdictionChip";
import {
  FederalRegisterFeed,
  FederalRegisterFeedSkeleton,
} from "@/components/clausegraph/FederalRegisterFeed";
import {
  regulationsQuery,
  regulatoryEventsQuery,
  federalRegisterQuery,
  type RegulatoryEventItem,
} from "@/data/queries";
import { updateEventTriageStatusFn, triggerIngestionSyncFn } from "@/lib/events.functions";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({
    meta: [
      { title: "Regulatory Events Inbox & Feed — ClauseGraph" },
      {
        name: "description",
        content:
          "Durable regulatory events inbox across US Federal Register, eCFR, EUR-Lex, and Bangladesh Gazette with source verification and triage.",
      },
      { property: "og:title", content: "Regulatory Events Inbox — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Durable regulatory events inbox across US Federal Register, eCFR, EUR-Lex, and Bangladesh Gazette with source verification and triage.",
      },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(regulationsQuery);
    context.queryClient.ensureQueryData(regulatoryEventsQuery());
    context.queryClient.prefetchQuery(federalRegisterQuery);
  },
  component: FeedPage,
  errorComponent: FeedError,
});

type Tab = "inbox" | "ontology" | "live_fr";

const EVENT_TYPE_COLORS: Record<string, string> = {
  amended: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  repealed: "border-red-500/30 bg-red-500/10 text-red-300",
  proposed: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  adopted: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  effective: "border-teal-500/30 bg-teal-500/10 text-teal-300",
  guidance: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  enforcement: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  published: "border-sky-500/30 bg-sky-500/10 text-sky-300",
};

function FeedPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: regs } = useSuspenseQuery(regulationsQuery);
  const { data: events } = useSuspenseQuery(regulatoryEventsQuery());

  const updateTriage = useServerFn(updateEventTriageStatusFn);
  const triggerSync = useServerFn(triggerIngestionSyncFn);

  const [activeTab, setActiveTab] = useState<Tab>("inbox");
  const [jurisdiction, setJurisdiction] = useState<string>("all");
  const [eventType, setEventType] = useState<string>("all");
  const [triageFilter, setTriageFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Local optimistic triage state
  const [localTriage, setLocalTriage] = useState<Record<string, string>>({});

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const currentTriage = localTriage[ev.id] || ev.triage_status;
      if (triageFilter !== "all" && currentTriage !== triageFilter) return false;

      if (jurisdiction !== "all") {
        const evJur = (ev.instrument_jurisdiction || ev.source_jurisdiction || "").toUpperCase();
        if (evJur !== jurisdiction.toUpperCase()) return false;
      }

      if (eventType !== "all" && ev.event_type !== eventType) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = ev.title.toLowerCase().includes(q);
        const matchesInstrument = (ev.instrument_short_name || "").toLowerCase().includes(q);
        const matchesSource = (ev.source_name || "").toLowerCase().includes(q);
        if (!matchesTitle && !matchesInstrument && !matchesSource) return false;
      }

      return true;
    });
  }, [events, localTriage, triageFilter, jurisdiction, eventType, searchQuery]);

  // Counts
  const stats = useMemo(() => {
    let newCount = 0;
    let relevantCount = 0;
    let verifiedCount = 0;

    for (const ev of events) {
      const st = localTriage[ev.id] || ev.triage_status;
      if (st === "new") newCount++;
      if (st === "relevant") relevantCount++;
      if (ev.verification === "verified") verifiedCount++;
    }

    return { total: events.length, newCount, relevantCount, verifiedCount };
  }, [events, localTriage]);

  async function handleTriageChange(
    eventId: string,
    newStatus: "new" | "relevant" | "not_relevant",
  ) {
    setLocalTriage((prev) => ({ ...prev, [eventId]: newStatus }));
    try {
      await updateTriage({ data: { eventId, triageStatus: newStatus } });
      await queryClient.invalidateQueries({ queryKey: ["regulatory-events"] });
    } catch (err) {
      console.error("Failed to update triage status", err);
    }
  }

  async function handleSyncAll() {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      await triggerSync({ data: { source: "all" } });
      await queryClient.invalidateQueries({ queryKey: ["regulatory-events"] });
      setSyncMessage("All ingestion sources synchronized successfully.");
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync error");
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncMessage(null), 5000);
    }
  }

  return (
    <AppShell>
      <div className="w-full max-w-[1100px]">
        {/* Header */}
        <header className="mb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
              Regulatory Intake &amp; Monitoring
            </p>
            <h1 className="mt-1 font-display text-[36px] leading-[1.05] tracking-tight text-foreground">
              Events Inbox
            </h1>
            <p className="mt-2 text-[13.5px] text-muted-foreground max-w-[65ch]">
              Multi-source statutory change detection across the U.S. Federal Register, eCFR,
              EUR-Lex, and the Bangladesh Gazette. Every event is provenance-verified and
              actionable.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] px-3.5 py-2 text-xs font-medium text-foreground hover:border-brass/50 hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-brass ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync Sources"}
            </button>
          </div>
        </header>

        {syncMessage && (
          <div className="mb-6 rounded-lg border border-brass/30 bg-brass/10 px-4 py-2.5 text-xs text-brass flex items-center justify-between">
            <span>{syncMessage}</span>
            <button
              onClick={() => setSyncMessage(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Bar */}
        <div className="mb-6 flex border-b border-[var(--hairline)] text-sm">
          <button
            onClick={() => setActiveTab("inbox")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "inbox"
                ? "border-brass text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Inbox className="h-4 w-4" />
            Events Inbox
            <span className="ml-1 rounded-full bg-brass/20 text-brass px-1.5 py-0.2 text-[10px] font-mono">
              {stats.newCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("ontology")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "ontology"
                ? "border-brass text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-4 w-4" />
            Curated Ontology
            <span className="ml-1 rounded-full bg-[var(--surface-raised)] text-muted-foreground px-1.5 py-0.2 text-[10px] font-mono">
              {regs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("live_fr")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === "live_fr"
                ? "border-brass text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="h-4 w-4 text-brass" />
            Live Federal Register
          </button>
        </div>

        {/* TAB 1: EVENTS INBOX */}
        {activeTab === "inbox" && (
          <div>
            {/* Filter Controls Bar */}
            <div className="mb-6 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {/* Triage filter pills */}
                <div className="flex rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-0.5 text-xs">
                  <button
                    onClick={() => setTriageFilter("all")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      triageFilter === "all"
                        ? "bg-brass text-black font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    All ({stats.total})
                  </button>
                  <button
                    onClick={() => setTriageFilter("new")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      triageFilter === "new"
                        ? "bg-brass text-black font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Inbox ({stats.newCount})
                  </button>
                  <button
                    onClick={() => setTriageFilter("relevant")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      triageFilter === "relevant"
                        ? "bg-brass text-black font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Relevant ({stats.relevantCount})
                  </button>
                  <button
                    onClick={() => setTriageFilter("not_relevant")}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      triageFilter === "not_relevant"
                        ? "bg-brass text-black font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Dismissed
                  </button>
                </div>

                {/* Jurisdiction Select */}
                <select
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  className="rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-brass"
                >
                  <option value="all">All Jurisdictions</option>
                  <option value="US">US (Federal &amp; eCFR)</option>
                  <option value="EU">EU (EUR-Lex)</option>
                  <option value="BD">BD (Bangladesh)</option>
                </select>

                {/* Event Type Select */}
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:border-brass"
                >
                  <option value="all">All Event Types</option>
                  <option value="amended">Amended</option>
                  <option value="repealed">Repealed</option>
                  <option value="proposed">Proposed</option>
                  <option value="adopted">Adopted</option>
                  <option value="effective">Effective</option>
                  <option value="guidance">Guidance</option>
                  <option value="enforcement">Enforcement</option>
                </select>
              </div>

              {/* Search box */}
              <div className="relative min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter events or statutes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brass"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Event List */}
            {filteredEvents.length === 0 ? (
              <div className="glass-panel p-10 text-center">
                <Inbox className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="font-display text-base text-foreground">No regulatory events found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  No events match the selected filters. Try clearing filters or click &ldquo;Sync
                  Sources&rdquo; to fetch new rulemaking activity.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredEvents.map((ev) => {
                  const currentTriage = localTriage[ev.id] || ev.triage_status;
                  const typeColor =
                    EVENT_TYPE_COLORS[ev.event_type] ||
                    "border-gray-500/30 bg-gray-500/10 text-gray-300";

                  return (
                    <article
                      key={ev.id}
                      className="glass-panel p-5 transition-all duration-150 hover:border-[var(--hairline-strong)]"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        {/* Event Details */}
                        <div className="space-y-2 min-w-0 flex-1">
                          {/* Top Badges Row */}
                          <div className="flex flex-wrap items-center gap-2">
                            {ev.instrument_jurisdiction && (
                              <JurisdictionChip jurisdiction={ev.instrument_jurisdiction} />
                            )}
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${typeColor}`}
                            >
                              {ev.event_type}
                            </span>

                            {ev.verification === "verified" ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                                <ShieldCheck className="h-3 w-3" />
                                Verified Source
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                                <AlertTriangle className="h-3 w-3" />
                                Verification Pending
                              </span>
                            )}

                            {ev.is_synthetic && (
                              <span className="rounded-md border border-neutral-700 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
                                Synthetic Sample
                              </span>
                            )}

                            {/* Dates */}
                            {ev.published_on && (
                              <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1 ml-auto">
                                <Calendar className="h-3 w-3" />
                                {ev.published_on}
                              </span>
                            )}
                          </div>

                          {/* Event Title with Link */}
                          <h2 className="font-display text-[16px] leading-[1.3] text-foreground">
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-baseline gap-1.5 hover:text-brass transition-colors"
                            >
                              <span>{ev.title}</span>
                              <ExternalLink className="h-3 w-3 opacity-60 flex-shrink-0" />
                            </a>
                          </h2>

                          {/* Instrument / Source details */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {ev.instrument_short_name && (
                              <span className="flex items-center gap-1 font-mono text-[11px] text-brass">
                                <Scale className="h-3 w-3" />
                                {ev.instrument_short_name}
                              </span>
                            )}
                            <span>Source: {ev.source_name || ev.source_id}</span>
                            {ev.provisions_count > 0 && (
                              <span className="font-mono text-[10px] text-muted-foreground/80">
                                {ev.provisions_count} indexed obligations
                              </span>
                            )}
                            {ev.effective_on && (
                              <span className="font-mono text-[11px]">
                                Effective: {ev.effective_on}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions Column */}
                        <div className="flex md:flex-col items-center md:items-end justify-between gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--hairline)]">
                          {/* Analyze Impact CTA */}
                          <button
                            onClick={() => {
                              navigate({
                                to: "/simulate",
                                search: {
                                  text: ev.title,
                                  eventId: ev.id,
                                },
                              });
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-brass px-3 py-1.5 text-xs font-semibold text-black hover:bg-brass-strong transition-all shadow-sm"
                          >
                            <Zap className="h-3.5 w-3.5 fill-black" />
                            Analyze Impact
                          </button>

                          {/* Triage Status & Actions */}
                          <div className="flex items-center gap-1">
                            {currentTriage !== "relevant" ? (
                              <button
                                onClick={() => handleTriageChange(ev.id, "relevant")}
                                title="Mark as Relevant"
                                className="rounded-md border border-[var(--hairline)] bg-[var(--surface-raised)] p-1.5 text-muted-foreground hover:text-emerald-400 hover:border-emerald-500/40 transition-colors"
                              >
                                <BookmarkCheck className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 mr-1">
                                <CheckCircle2 className="h-3 w-3" /> Relevant
                              </span>
                            )}

                            {currentTriage !== "not_relevant" ? (
                              <button
                                onClick={() => handleTriageChange(ev.id, "not_relevant")}
                                title="Dismiss as Not Relevant"
                                className="rounded-md border border-[var(--hairline)] bg-[var(--surface-raised)] p-1.5 text-muted-foreground hover:text-red-400 hover:border-red-500/40 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <span className="text-[10px] font-mono text-red-400/80 mr-1">
                                Dismissed
                              </span>
                            )}

                            {currentTriage !== "new" && (
                              <button
                                onClick={() => handleTriageChange(ev.id, "new")}
                                title="Restore to Inbox"
                                className="rounded-md border border-[var(--hairline)] bg-[var(--surface-raised)] px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CURATED ONTOLOGY */}
        {activeTab === "ontology" && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-brass" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
                  CURATED · ClauseGraph ontology
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {regs.length} entries
              </span>
            </div>

            <ul className="flex flex-col gap-3">
              {regs.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/regulations/$regId"
                    params={{ regId: r.id }}
                    className="glass-panel group grid grid-cols-1 md:grid-cols-[130px_1fr_auto] items-start gap-3 md:gap-6 p-5 duration-150 ease-out transition-all hover:border-[var(--hairline-strong)]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <JurisdictionChip jurisdiction={r.jurisdiction} />
                      <span className="font-mono text-[10px] text-muted-foreground">{r.id}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-[17px] leading-[1.25] tracking-tight text-foreground group-hover:text-brass duration-150 ease-out transition-colors">
                        {r.title}
                      </h3>
                      <p className="mt-1.5 text-[13px] leading-[1.55] text-muted-foreground line-clamp-2 max-w-[60ch]">
                        {r.summary}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground md:pt-1">
                      {r.obligations.length} ob.
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* TAB 3: LIVE FEDERAL REGISTER */}
        {activeTab === "live_fr" && (
          <div className="space-y-6">
            <FederalRegisterFeed />
          </div>
        )}
      </div>
    </AppShell>
  );
}

function FeedError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <AppShell>
      <div className="glass-panel p-8 max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Couldn&apos;t load the feed
        </p>
        <p className="mt-2 font-display text-[20px] leading-[1.2] text-foreground">
          The regulatory intake stream isn&apos;t responding.
        </p>
        <p className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--risk)] mr-2 align-middle" />
          {error.message}
        </p>
        <button
          onClick={() => reset()}
          className="mt-4 rounded-[12px] bg-brass px-4 py-2 text-sm text-[color:var(--primary-foreground)] duration-150 ease-out transition-all hover:bg-[color:var(--brass-strong)]"
        >
          Retry
        </button>
      </div>
    </AppShell>
  );
}
