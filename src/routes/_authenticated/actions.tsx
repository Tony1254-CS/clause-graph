import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ListChecks,
  ChevronDown,
  Copy,
  Check,
  Terminal,
  Zap,
  Radar,
  FlaskConical,
  Network,
} from "lucide-react";
import { AppShell } from "@/components/clausegraph/AppShell";
import { RouteError } from "@/components/clausegraph/RouteError";
import {
  contractsQuery,
  simulationRunsQuery,
  complianceArtifactsQuery,
  formatUSD,
  type SimulationRunRow,
} from "@/data/queries";

export const Route = createFileRoute("/_authenticated/actions")({
  head: () => ({
    meta: [
      { title: "Action Plans & Audit Trail — ClauseGraph" },
      {
        name: "description",
        content:
          "Every simulation your workspace has run, the exposure it found, and the executable compliance artifacts generated from it.",
      },
      { property: "og:title", content: "Action Plans & Audit Trail — ClauseGraph" },
      {
        property: "og:description",
        content:
          "Every simulation your workspace has run, the exposure it found, and the executable compliance artifacts generated from it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(contractsQuery),
      context.queryClient.ensureQueryData(simulationRunsQuery),
      context.queryClient.ensureQueryData(complianceArtifactsQuery),
    ]),
  component: ActionsPage,
  errorComponent: ({ error, reset }) => (
    <RouteError title="Action plans unavailable" error={error} reset={reset} />
  ),
});

const RUN_META: Record<string, { label: string; icon: typeof Zap; to: string }> = {
  reactive: { label: "Simulate Impact", icon: Zap, to: "/simulate" },
  forecast: { label: "Predictive Forecast", icon: Radar, to: "/predictive" },
  what_if: { label: "What-If Sandbox", icon: FlaskConical, to: "/what-if" },
  supply_chain: { label: "Supply Chain Cascade", icon: Network, to: "/supply-chain" },
};

const SEV_DOT: Record<string, string> = {
  high: "bg-[var(--risk)]",
  medium: "bg-[rgba(225,82,75,0.75)]",
  low: "bg-[rgba(225,82,75,0.45)]",
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "reactive", label: "Reactive" },
  { id: "forecast", label: "Forecast" },
  { id: "what_if", label: "What-if" },
  { id: "supply_chain", label: "Supply chain" },
] as const;

function ts(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().replace("T", " ").slice(0, 16).concat(" UTC");
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
      className="press inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--hairline)] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground transition-ui hover:border-[var(--brass)] hover:text-[var(--brass)]"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function ActionsPage() {
  const { data: contracts } = useSuspenseQuery(contractsQuery);
  const { data: runs } = useSuspenseQuery(simulationRunsQuery);
  const { data: artifacts } = useSuspenseQuery(complianceArtifactsQuery);

  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const contractsById = useMemo(() => {
    const m = new Map<string, (typeof contracts)[number]>();
    contracts.forEach((c) => m.set(c.id, c));
    return m;
  }, [contracts]);

  const exposureOf = (run: SimulationRunRow): number => {
    if (run.run_type === "supply_chain") return run.result.total_indirect_exposure ?? 0;
    return (run.result.impacts ?? []).reduce(
      (s, i) => s + (contractsById.get(i.contract_id)?.value ?? 0),
      0,
    );
  };

  const impactCountOf = (run: SimulationRunRow): number =>
    run.run_type === "supply_chain"
      ? (run.result.hits ?? []).filter((h) => h.hop > 0).length
      : (run.result.impacts ?? []).length;

  const visible = useMemo(
    () => (filter === "all" ? runs : runs.filter((r) => r.run_type === filter)),
    [runs, filter],
  );

  const totals = useMemo(() => {
    const flagged = new Set<string>();
    let exposure = 0;
    runs.forEach((r) => {
      exposure += exposureOf(r);
      (r.result.impacts ?? []).forEach((i) => flagged.add(i.contract_id));
    });
    return { runs: runs.length, flagged: flagged.size, exposure };
  }, [runs, contractsById]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="animate-fade-up">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
            Action plans · audit trail
          </p>
          <h1 className="mt-3 font-display text-[clamp(30px,4.6vw,46px)] leading-[1.04] tracking-tight text-foreground">
            Every run, on the record
          </h1>
          <p className="mt-3 max-w-[62ch] text-[14px] leading-[1.65] text-muted-foreground">
            Simulations, forecasts, sandbox stress tests and supply-chain cascades are all logged
            against your workspace. Re-open any run to see what it flagged, copy the regulation text
            back into the simulator, or pull the executable audit generated from it.
          </p>
        </header>

        {runs.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { k: "Runs logged", v: totals.runs.toLocaleString() },
              { k: "Contracts flagged", v: totals.flagged.toLocaleString() },
              { k: "Exposure surfaced", v: formatUSD(totals.exposure) },
            ].map((s) => (
              <div key={s.k} className="glass-panel p-5">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">
                  {s.k}
                </p>
                <p className="mt-2 font-mono text-[22px] tracking-tight text-foreground">{s.v}</p>
              </div>
            ))}
          </div>
        )}

        {runs.length === 0 ? (
          <div className="glass-panel mx-auto max-w-md p-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[var(--hairline-strong)]">
              <ListChecks className="h-5 w-5 text-brass" strokeWidth={1.6} />
            </div>
            <h2 className="mt-6 font-display text-[22px] leading-[1.15] tracking-tight text-foreground">
              No runs yet
            </h2>
            <p className="mt-3 text-[13.5px] leading-[1.6] text-muted-foreground">
              Run your first impact simulation and it will appear here with its exposure figure,
              flagged contracts and suggested amendments.
            </p>
            <Link
              to="/simulate"
              className="press mt-6 inline-flex items-center gap-2 rounded-[12px] bg-[var(--brass)] px-4 py-2 text-[13px] font-medium text-[var(--ink-base)] transition-ui hover:opacity-90"
            >
              <Zap className="h-3.5 w-3.5" />
              Simulate impact
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => {
                const count =
                  f.id === "all" ? runs.length : runs.filter((r) => r.run_type === f.id).length;
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`press rounded-[12px] border px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] transition-ui ${
                      active
                        ? "border-[var(--brass)] text-[var(--brass)]"
                        : "border-[var(--hairline)] text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label} · {count}
                  </button>
                );
              })}
            </div>

            <ul className="flex flex-col gap-3">
              {visible.map((run) => {
                const meta = RUN_META[run.run_type] ?? RUN_META.reactive;
                const Icon = meta.icon;
                const open = openId === run.id;
                return (
                  <li key={run.id} className="glass-panel overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : run.id)}
                      aria-expanded={open}
                      className="flex w-full items-start gap-4 p-5 text-left transition-ui hover:bg-[color-mix(in_oklab,var(--brass)_5%,transparent)]"
                    >
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--hairline-strong)]">
                        <Icon className="h-3.5 w-3.5 text-brass" strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[var(--brass)]">
                            {meta.label}
                          </span>
                          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
                            {ts(run.created_at)}
                          </span>
                          {run.result.fallback && (
                            <span className="rounded-full border border-[var(--hairline-strong)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                              Demo fallback
                            </span>
                          )}
                        </span>
                        <span className="mt-2 block truncate text-[13.5px] text-foreground">
                          {run.result.summary || run.input_regulation_text.slice(0, 120)}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          <span>{impactCountOf(run)} impacted</span>
                          <span className="text-[var(--risk)]">{formatUSD(exposureOf(run))}</span>
                        </span>
                      </span>
                      <ChevronDown
                        className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                      />
                    </button>

                    {open && (
                      <div className="border-t border-[var(--hairline)] p-5">
                        <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">
                          Regulation text
                        </p>
                        <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-[12.5px] leading-[1.6] text-foreground/85">
                          {run.input_regulation_text || "(none recorded)"}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <CopyButton text={run.input_regulation_text} label="Copy text" />
                          <Link
                            to={meta.to}
                            className="press inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--hairline)] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground transition-ui hover:border-[var(--brass)] hover:text-[var(--brass)]"
                          >
                            Re-run in {meta.label}
                          </Link>
                        </div>

                        {(run.result.impacts ?? []).length > 0 && (
                          <>
                            <p className="mt-6 font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">
                              Flagged contracts & suggested amendments
                            </p>
                            <ul className="mt-3 flex flex-col gap-2">
                              {(run.result.impacts ?? []).map((i, idx) => {
                                const c = contractsById.get(i.contract_id);
                                return (
                                  <li
                                    key={`${i.contract_id}-${idx}`}
                                    className="rounded-[12px] border border-[var(--hairline)] p-3"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[i.severity] ?? SEV_DOT.low}`}
                                      />
                                      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
                                        {i.severity}
                                      </span>
                                      {c ? (
                                        <Link
                                          to="/contracts/$contractId"
                                          params={{ contractId: c.id }}
                                          className="text-[13px] text-foreground underline decoration-[var(--hairline-strong)] underline-offset-4 transition-ui hover:text-[var(--brass)]"
                                        >
                                          {c.name}
                                        </Link>
                                      ) : (
                                        <span className="text-[13px] text-muted-foreground">
                                          Contract {i.contract_id.slice(0, 8)} (no longer in
                                          portfolio)
                                        </span>
                                      )}
                                      {c && (
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                          {formatUSD(c.value)}
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-2 text-[12.5px] leading-[1.6] text-foreground/85">
                                      {i.suggested_amendment}
                                    </p>
                                  </li>
                                );
                              })}
                            </ul>
                          </>
                        )}

                        {(run.result.remediation ?? []).length > 0 && (
                          <>
                            <p className="mt-6 font-mono text-[9.5px] uppercase tracking-[0.2em] text-muted-foreground">
                              Remediation steps
                            </p>
                            <ul className="mt-2 flex flex-col gap-1.5">
                              {(run.result.remediation ?? []).map((r, i) => (
                                <li
                                  key={i}
                                  className="text-[12.5px] leading-[1.6] text-foreground/85"
                                >
                                  <span className="mr-2 font-mono text-[10px] text-[var(--brass)]">
                                    {String(i + 1).padStart(2, "0")}
                                  </span>
                                  {r}
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="glass-panel p-6 text-center text-[13px] text-muted-foreground">
                  No runs of this type yet.
                </li>
              )}
            </ul>
          </>
        )}

        {artifacts.length > 0 && (
          <section className="mt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
              Compliance-as-code
            </p>
            <h2 className="mt-2 font-display text-[24px] leading-[1.1] tracking-tight text-foreground">
              Generated audits
            </h2>
            <ul className="mt-4 flex flex-col gap-3">
              {artifacts.map((a) => (
                <li key={a.id} className="glass-panel p-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Terminal className="h-3.5 w-3.5 text-brass" strokeWidth={1.7} />
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-[var(--brass)]">
                      {a.stack ?? "generic"}
                    </span>
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
                      {ts(a.created_at)}
                    </span>
                    {a.regulation_id && (
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
                        {a.regulation_id}
                      </span>
                    )}
                  </div>
                  {a.gap && (
                    <p className="mt-2 text-[13px] leading-[1.6] text-foreground/90">{a.gap}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {a.audit_script?.code && (
                      <CopyButton
                        text={a.audit_script.code}
                        label={`Copy ${a.audit_script.filename ?? "audit"}`}
                      />
                    )}
                    {a.remediation?.code && (
                      <CopyButton
                        text={a.remediation.code}
                        label={`Copy ${a.remediation.filename ?? "remediation"}`}
                      />
                    )}
                    {a.runbook && <CopyButton text={a.runbook} label="Copy runbook" />}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </AppShell>
  );
}
