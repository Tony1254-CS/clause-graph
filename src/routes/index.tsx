import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Zap, Network } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
          "Simulate the blast radius of proposed regulations across your contract portfolio.",
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
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full border border-[var(--hairline-strong)] grid place-items-center">
            <div className="h-2 w-2 rounded-full bg-brass" />
          </div>
          <span className="font-display text-[19px] tracking-tight text-foreground">
            ClauseGraph
          </span>
        </div>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--hairline-strong)] px-4 py-2 text-[13px] text-foreground transition-all duration-150 ease-out hover:border-brass hover:text-brass"
        >
          Sign in
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </header>

      <section className="mx-auto max-w-[1200px] px-6 pt-16 pb-24">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
          Legal Compliance · Blast Radius Analysis
        </p>
        <h1 className="mt-4 font-display text-[56px] leading-[1.02] tracking-tight text-foreground max-w-[18ch]">
          See the blast radius before the rule ships.
        </h1>
        <p className="mt-6 text-[16px] leading-[1.6] text-muted-foreground max-w-[58ch]">
          Paste a proposed regulation. ClauseGraph maps it against your portfolio in seconds
          — which contracts break, which clauses need redrafting, how much notional exposure
          is at stake, and what to change.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-[12px] bg-brass px-6 py-3 text-[14px] font-medium text-[color:var(--primary-foreground)] shadow-[0_0_24px_-6px_rgba(201,166,107,0.4)] transition-all duration-150 ease-out hover:bg-[color:var(--brass-strong)] active:scale-[0.98]"
          >
            <Zap className="h-4 w-4" strokeWidth={2.2} />
            Get started
          </Link>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            New workspaces come with 3 sample contracts
          </span>
        </div>

        <div className="mt-24 grid gap-6 md:grid-cols-3">
          <FeatureCard
            icon={Network}
            title="Portfolio topology"
            body="Every contract and every regulation rendered as a live citation graph. Click a node to trace what depends on it."
          />
          <FeatureCard
            icon={Zap}
            title="Simulate Impact"
            body="Paste any proposed rule. See which agreements light up, ranked by exposure, with amendment language for legal review."
          />
          <FeatureCard
            icon={ShieldCheck}
            title="Backtested"
            body="Reconstructed scenarios from Wells Fargo, Goldman, and Credit Suisse enforcement actions — analyzed live, next to the real fine."
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
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="glass-panel p-6">
      <Icon className="h-5 w-5 text-brass" strokeWidth={1.6} />
      <h3 className="mt-4 font-display text-[18px] leading-[1.2] text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-[13.5px] leading-[1.6] text-muted-foreground">{body}</p>
    </div>
  );
}
