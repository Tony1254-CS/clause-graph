import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — ClauseGraph" },
      { name: "description", content: "How ClauseGraph collects, uses, and protects your data." },
      { property: "og:title", content: "Privacy Notice — ClauseGraph" },
      { property: "og:description", content: "How ClauseGraph collects, uses, and protects your data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[820px] px-6 py-16">
        <Link to="/" className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass hover:underline">
          ← ClauseGraph
        </Link>
        <h1 className="mt-6 font-display text-[44px] leading-tight text-foreground">Privacy Notice</h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Last updated: 25 July 2026
        </p>

        <div className="prose prose-invert mt-10 space-y-6 text-[14.5px] leading-[1.7] text-foreground/90">
          <p>
            ClauseGraph ("we", "us") is the data controller for the personal data we collect when
            you use the Service. This notice explains what we collect, why, and your rights.
          </p>

          <h2 className="font-display text-[22px] text-foreground">1. Data we collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account data:</strong> name, email, login credentials.</li>
            <li><strong>Workspace content:</strong> contracts and clauses you upload for analysis.</li>
            <li><strong>Usage &amp; telemetry:</strong> feature usage, timestamps, device identifiers, IP address.</li>
            <li><strong>Support messages:</strong> when you contact us for help.</li>
            <li>
              <strong>Payment data</strong> is collected by our merchant of record, Paddle. We
              receive only a customer identifier and subscription status, never card details.
            </li>
          </ul>

          <h2 className="font-display text-[22px] text-foreground">2. Why we use it</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide the Service (contract performance).</li>
            <li>To secure the Service and prevent fraud (legitimate interests).</li>
            <li>To improve the Service and diagnose issues (legitimate interests).</li>
            <li>To respond to support requests (contract performance).</li>
            <li>To comply with legal obligations (accounting, tax, response to authorities).</li>
          </ul>

          <h2 className="font-display text-[22px] text-foreground">3. Who we share it with</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Hosting and infrastructure providers (subprocessors).</li>
            <li>
              <strong>Paddle</strong>, our merchant of record, for sale of subscriptions, payment
              processing, subscription management, tax compliance, and invoicing.
            </li>
            <li>AI model providers (e.g. OpenAI, Google) that process prompts to generate output.</li>
            <li>Professional advisers (legal, accounting) where necessary.</li>
            <li>Authorities where required by law.</li>
          </ul>

          <h2 className="font-display text-[22px] text-foreground">4. Retention</h2>
          <p>
            We keep account and workspace data for as long as your account is active and for a
            reasonable period after closure to comply with legal obligations. After that we delete
            or anonymize the data.
          </p>

          <h2 className="font-display text-[22px] text-foreground">5. International transfers</h2>
          <p>
            We may transfer data outside your country to our subprocessors. Where required we use
            standard contractual clauses or rely on adequacy decisions to protect it.
          </p>

          <h2 className="font-display text-[22px] text-foreground">6. Your rights</h2>
          <p>
            Depending on your jurisdiction you may have the right to access, correct, delete,
            restrict, port, or object to processing of your personal data, and to withdraw
            consent. To exercise these rights email{" "}
            <a href="mailto:privacy@clausegraph.app" className="text-brass underline">privacy@clausegraph.app</a>.
            We respond within one month. You may also lodge a complaint with your supervisory
            authority.
          </p>

          <h2 className="font-display text-[22px] text-foreground">7. Security</h2>
          <p>
            We use appropriate technical and organisational measures — encryption in transit,
            access controls, and audit logging — to protect your data.
          </p>

          <h2 className="font-display text-[22px] text-foreground">8. Cookies</h2>
          <p>
            We use essential cookies for authentication and session management. We do not use
            third-party advertising cookies.
          </p>

          <h2 className="font-display text-[22px] text-foreground">9. Contact</h2>
          <p>
            Questions: <a href="mailto:privacy@clausegraph.app" className="text-brass underline">privacy@clausegraph.app</a>.
          </p>
        </div>

        <div className="mt-12 flex gap-6 text-[13px] text-muted-foreground">
          <Link to="/terms" className="hover:text-brass">Terms</Link>
          <Link to="/refund" className="hover:text-brass">Refunds</Link>
          <Link to="/" className="hover:text-brass">Home</Link>
        </div>
      </div>
    </main>
  );
}
