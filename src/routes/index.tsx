import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Zap, Network, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PLANS, type PlanId } from "@/lib/plans";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ClauseGraph — Legal Compliance Blast Radius" },
      {
        name: "description",
        content:
          "Simulate the blast radius of proposed regulations across your contract portfolio. Purpose-built for compliance officers and general counsel.",
      },
      { property: "og:title", content: "ClauseGraph — Legal Compliance Blast Radius" },
      {
        property: "og:description",
        content:
          "Simulate the blast radius of proposed regulations across your contract portfolio. Purpose-built for compliance officers and general counsel.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        setChecking(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (checking) {
    return <div className="min-h-screen bg-background" aria-hidden />;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full opacity-[0.18] blur-[120px] ambient-drift"
             style={{ background: "radial-gradient(circle, var(--brass) 0%, transparent 60%)" }} />
        <div className="absolute top-[30%] -right-40 h-[620px] w-[620px] rounded-full opacity-[0.10] blur-[140px] ambient-drift"
             style={{ background: "radial-gradient(circle, var(--brass) 0%, transparent 65%)", animationDelay: "-14s" }} />
        <div className="absolute inset-0 opacity-[0.035]"
             style={{
               backgroundImage:
                 "linear-gradient(var(--hairline) 1px, transparent 1px), linear-gradient(90deg, var(--hairline) 1px, transparent 1px)",
               backgroundSize: "56px 56px",
               maskImage: "radial-gradient(ellipse at 50% 20%, black 40%, transparent 75%)",
             }} />
      </div>

      <header className="relative z-10 mx-auto flex max-w-[1240px] items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5 animate-fade-up" style={{ animationDelay: "40ms" }}>
          <div className="h-8 w-8 rounded-full border border-[var(--hairline-strong)] grid place-items-center">
            <div className="h-2 w-2 rounded-full bg-brass mint-glow-pulse" />
          </div>
          <span className="font-display text-[19px] tracking-tight text-foreground">
            ClauseGraph
          </span>
        </div>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--hairline-strong)] px-4 py-2 text-[13px] text-foreground transition-ui press hover:border-brass hover:text-brass animate-fade-up"
          style={{ animationDelay: "80ms" }}
        >
          Sign in
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-[1240px] px-6 pt-10 pb-24 lg:pt-16">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
          {/* Left: hero copy */}
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass animate-fade-up inline-flex items-center gap-2">
              <span className="inline-block h-[6px] w-[6px] rounded-full bg-brass mint-glow-pulse" />
              Legal Compliance · Blast Radius Analysis
            </p>
            <h1
              className="mt-5 font-display text-[clamp(40px,6vw,68px)] leading-[1.02] tracking-[-0.02em] text-foreground max-w-[16ch] animate-fade-up"
              style={{ animationDelay: "80ms" }}
            >
              See the blast radius{" "}
              <span className="italic text-brass">before</span> the rule ships.
            </h1>
            <p
              className="mt-6 text-[16px] leading-[1.65] text-muted-foreground max-w-[54ch] animate-fade-up"
              style={{ animationDelay: "140ms" }}
            >
              Paste a proposed regulation. ClauseGraph maps it against your portfolio in
              seconds — which contracts break, which clauses need redrafting, how much
              notional exposure is at stake, and what to change.
            </p>

            <div
              className="mt-10 flex flex-wrap items-center gap-5 animate-fade-up"
              style={{ animationDelay: "200ms" }}
            >
              <Link
                to="/auth"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-[14px] bg-brass px-6 py-3.5 text-[14px] font-medium text-[color:var(--primary-foreground)] shadow-[0_0_32px_-8px_rgba(94,234,212,0.55)] transition-ui press hover:-translate-y-[1px]"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                />
                <Zap className="h-4 w-4" strokeWidth={2.2} />
                Get started
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2.2} />
              </Link>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                3 sample contracts · no credit card
              </span>
            </div>

            {/* Stat row */}
            <dl
              className="mt-14 grid grid-cols-3 gap-6 max-w-[520px] animate-fade-up"
              style={{ animationDelay: "260ms" }}
            >
              {[
                { k: "< 8s", v: "Portfolio scan" },
                { k: "10", v: "Regulations mapped" },
                { k: "3", v: "Jurisdictions" },
              ].map((s) => (
                <div key={s.v} className="border-l border-[var(--hairline-strong)] pl-4">
                  <div className="font-display text-[26px] leading-none tracking-tight text-foreground">{s.k}</div>
                  <div className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">{s.v}</div>
                </div>
              ))}
            </dl>
          </div>

          {/* Right: animated blast-radius seal */}
          <div className="relative min-w-0 animate-fade-up" style={{ animationDelay: "180ms" }}>
            <HeroSeal />
          </div>
        </div>

        <div className="mt-28 grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={Network}
            title="Portfolio topology"
            body="Every contract and every regulation rendered as a live citation graph. Click a node to trace what depends on it."
            i={0}
          />
          <FeatureCard
            icon={Zap}
            title="Simulate Impact"
            body="Paste any proposed rule. See which agreements light up, ranked by exposure, with amendment language for legal review."
            i={1}
          />
          <FeatureCard
            icon={ShieldCheck}
            title="Backtested"
            body="Reconstructed scenarios from Wells Fargo, Goldman, and Credit Suisse enforcement actions — analyzed live, next to the real fine."
            i={2}
          />
        </div>
      </section>


      <section className="mx-auto max-w-[1200px] px-6 pb-24">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">Pricing</p>
            <h2 className="mt-3 font-display text-[36px] tracking-tight text-foreground">
              Simple, transparent tiers.
            </h2>
          </div>
          <p className="font-mono text-[11px] text-muted-foreground max-w-[36ch]">
            30-day money-back guarantee. Billed by Paddle, our merchant of record.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const p = PLANS[id];
            return (
              <div key={id} className="glass-panel p-6 flex flex-col gap-4">
                <div>
                  <h3 className="font-display text-[22px] text-foreground">{p.name}</h3>
                  <p className="mt-1 text-[13px] text-muted-foreground">{p.tagline}</p>
                </div>
                <div>
                  <span className="font-display text-[38px] text-foreground">${p.priceUsd}</span>
                  <span className="ml-1 font-mono text-[12px] text-muted-foreground">/ month</span>
                </div>
                <ul className="flex flex-col gap-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass" strokeWidth={2.2} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/auth"
                  className="mt-auto inline-flex items-center justify-center gap-2 rounded-[12px] border border-[var(--hairline-strong)] px-4 py-2.5 text-[13px] text-foreground hover:border-brass hover:text-brass transition-colors"
                >
                  {p.priceUsd === 0 ? "Start free" : `Get ${p.name}`}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-[var(--hairline)]">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-8 text-[12.5px] text-muted-foreground">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
            © {new Date().getFullYear()} ClauseGraph
          </span>
          <div className="flex gap-5">
            <Link to="/terms" className="hover:text-brass">Terms</Link>
            <Link to="/privacy" className="hover:text-brass">Privacy</Link>
            <Link to="/refund" className="hover:text-brass">Refunds</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  i = 0,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  i?: number;
}) {
  return (
    <div
      className="glass-panel p-6 hover-lift stagger-item"
      style={{ ["--i" as string]: i }}
    >
      <div className="inline-grid h-10 w-10 place-items-center rounded-[10px] border border-[var(--hairline-strong)] bg-[color:var(--surface-glass)]">
        <Icon className="h-[18px] w-[18px] text-brass" strokeWidth={1.6} />
      </div>
      <h3 className="mt-5 font-display text-[19px] leading-[1.2] text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-[13.5px] leading-[1.65] text-muted-foreground">{body}</p>
    </div>
  );
}

function HeroSeal() {
  // Static-but-alive radar: concentric rings, orbiting nodes, one "hit" node in brass.
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]">
      {/* outer glow */}
      <div
        aria-hidden
        className="absolute inset-6 rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, var(--brass) 0%, transparent 60%)" }}
      />
      {/* seal */}
      <div className="absolute inset-0 rounded-full border border-[var(--hairline-strong)] bg-[color:var(--surface-glass)] backdrop-blur-xl overflow-hidden">
        {/* rim tick marks */}
        <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full">
          <defs>
            <radialGradient id="seal-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--brass)" stopOpacity="0.22" />
              <stop offset="60%" stopColor="var(--brass)" stopOpacity="0.02" />
              <stop offset="100%" stopColor="var(--brass)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="196" fill="url(#seal-core)" />
          {/* concentric rings */}
          {[80, 130, 175].map((r, idx) => (
            <circle
              key={r}
              cx="200"
              cy="200"
              r={r}
              fill="none"
              stroke="var(--hairline-strong)"
              strokeWidth={idx === 2 ? 0.5 : 0.75}
              strokeDasharray={idx === 1 ? "2 4" : undefined}
            />
          ))}
          {/* sweeping arc */}
          <g style={{ transformOrigin: "200px 200px", animation: "spin 14s linear infinite" }}>
            <path
              d="M 200 25 A 175 175 0 0 1 360 155"
              fill="none"
              stroke="var(--brass)"
              strokeWidth="1.2"
              strokeLinecap="round"
              opacity="0.65"
            />
          </g>
          {/* tick marks around rim */}
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i / 60) * Math.PI * 2;
            const x1 = 200 + Math.cos(a) * 190;
            const y1 = 200 + Math.sin(a) * 190;
            const x2 = 200 + Math.cos(a) * (i % 5 === 0 ? 180 : 185);
            const y2 = 200 + Math.sin(a) * (i % 5 === 0 ? 180 : 185);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="var(--brass)"
                strokeOpacity={i % 5 === 0 ? 0.55 : 0.22}
                strokeWidth="0.8"
              />
            );
          })}
          {/* contract nodes */}
          {[
            { x: 200, y: 200, r: 5, hit: true, label: "Rule" },
            { x: 268, y: 148, r: 3.5, hit: true },
            { x: 138, y: 172, r: 3.2 },
            { x: 292, y: 232, r: 3.8, hit: true },
            { x: 156, y: 268, r: 3.2 },
            { x: 232, y: 296, r: 3.2 },
            { x: 108, y: 230, r: 2.8 },
            { x: 300, y: 108, r: 2.8 },
            { x: 88, y: 148, r: 2.6 },
            { x: 328, y: 288, r: 2.6 },
          ].map((n, idx) => (
            <g key={idx}>
              {n.hit && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r + 5}
                  fill="var(--brass)"
                  opacity="0.18"
                />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={n.hit ? "var(--brass)" : "var(--foreground)"}
                opacity={n.hit ? 1 : 0.55}
              />
              {/* connection to center for hits */}
              {n.hit && idx !== 0 && (
                <line
                  x1="200"
                  y1="200"
                  x2={n.x}
                  y2={n.y}
                  stroke="var(--brass)"
                  strokeOpacity="0.35"
                  strokeWidth="0.8"
                  strokeDasharray="2 3"
                />
              )}
            </g>
          ))}
        </svg>
        {/* center label */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-brass">Impact</div>
            <div className="mt-1 font-display text-[36px] leading-none tracking-tight text-foreground">
              $4.2M
            </div>
            <div className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
              exposure · 3 contracts
            </div>
          </div>
        </div>
      </div>

      {/* corner readouts */}
      <div className="absolute -top-2 left-4 rounded-[10px] border border-[var(--hairline-strong)] bg-[color:var(--surface-glass)] backdrop-blur-md px-3 py-1.5">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Rule</div>
        <div className="font-mono text-[11px] text-foreground">GDPR Art. 22</div>
      </div>
      <div className="absolute -bottom-2 right-4 rounded-[10px] border border-[var(--hairline-strong)] bg-[color:var(--surface-glass)] backdrop-blur-md px-3 py-1.5">
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Severity</div>
        <div className="font-mono text-[11px] text-brass">HIGH · 3 hits</div>
      </div>
    </div>
  );
}

