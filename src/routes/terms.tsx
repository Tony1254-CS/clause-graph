import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — ClauseGraph" },
      { name: "description", content: "Terms and conditions for using ClauseGraph." },
      { property: "og:title", content: "Terms of Service — ClauseGraph" },
      { property: "og:description", content: "Terms and conditions for using ClauseGraph." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[820px] px-6 py-16">
        <Link to="/" className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass hover:underline">
          ← ClauseGraph
        </Link>
        <h1 className="mt-6 font-display text-[44px] leading-tight text-foreground">Terms of Service</h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Last updated: 25 July 2026
        </p>

        <div className="prose prose-invert mt-10 space-y-6 text-[14.5px] leading-[1.7] text-foreground/90">
          <p>
            These Terms govern your use of ClauseGraph ("the Service"), operated by ClauseGraph
            ("we", "us"). By creating an account or using the Service you agree to these Terms.
          </p>

          <h2 className="font-display text-[22px] text-foreground">1. The Service</h2>
          <p>
            ClauseGraph is a legal-technology tool that analyses contract portfolios against
            regulatory text. Output is informational only, is generated in part by automated
            systems, and does not constitute legal advice. All output is marked for legal review
            and must be reviewed by qualified counsel before use.
          </p>

          <h2 className="font-display text-[22px] text-foreground">2. Your account</h2>
          <p>
            You must provide accurate account information, keep credentials confidential, and are
            responsible for activity under your account. You must have authority to bind your
            organization if you sign up on its behalf.
          </p>

          <h2 className="font-display text-[22px] text-foreground">3. Acceptable use</h2>
          <p>You must not:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Use the Service unlawfully, fraudulently, or to send spam.</li>
            <li>Infringe intellectual-property rights or upload content you have no rights to.</li>
            <li>Probe, scan, scrape, or interfere with security of the Service.</li>
            <li>Reverse engineer, resell, or circumvent technical limits of the Service.</li>
          </ul>

          <h2 className="font-display text-[22px] text-foreground">4. Payments &amp; subscriptions</h2>
          <p>
            Our order process is conducted by our online reseller <strong>Paddle.com</strong>.
            Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer
            service inquiries and handles returns. Payment, billing, tax, cancellation, and refund
            mechanics are governed by the{" "}
            <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noopener noreferrer" className="text-brass underline">
              Paddle Buyer Terms
            </a>
            .
          </p>

          <h2 className="font-display text-[22px] text-foreground">5. Intellectual property</h2>
          <p>
            We retain all right, title, and interest in the Service, including software,
            documentation, and branding. We grant you a limited, non-exclusive, non-transferable
            right to use the Service within your selected plan. You retain ownership of the
            content you upload; you grant us a limited license to host and process it solely to
            provide the Service.
          </p>

          <h2 className="font-display text-[22px] text-foreground">6. Suspension &amp; termination</h2>
          <p>
            We may suspend or terminate access for material breach of these Terms, non-payment,
            fraud or security risk, or repeated or serious policy violations. Upon termination
            you may export your data within 30 days; after that we will delete it.
          </p>

          <h2 className="font-display text-[22px] text-foreground">7. Warranties &amp; liability</h2>
          <p>
            The Service is provided "as is" without warranties of any kind to the fullest extent
            permitted by law. We do not guarantee uninterrupted or error-free performance. To the
            maximum extent permitted by law, our aggregate liability is capped at the fees you
            paid in the 12 months preceding a claim. We are not liable for indirect, consequential
            or special damages. Nothing excludes liability that cannot be excluded by law.
          </p>

          <h2 className="font-display text-[22px] text-foreground">8. AI outputs</h2>
          <p>
            The Service uses generative AI. Outputs may be inaccurate or incomplete and are not
            suitable for regulated professional advice without human oversight. You are
            responsible for prompts, use of outputs, and having rights to any input content. We
            may remove or restrict content and refuse or filter outputs, including suspending
            accounts for repeated violations.
          </p>

          <h2 className="font-display text-[22px] text-foreground">9. Governing law</h2>
          <p>
            These Terms are governed by the laws of the jurisdiction in which ClauseGraph is
            established. Disputes will be resolved in the courts of that jurisdiction.
          </p>

          <h2 className="font-display text-[22px] text-foreground">10. Contact</h2>
          <p>
            Questions about these Terms: <a href="mailto:legal@clausegraph.app" className="text-brass underline">legal@clausegraph.app</a>.
          </p>
        </div>

        <div className="mt-12 flex gap-6 text-[13px] text-muted-foreground">
          <Link to="/privacy" className="hover:text-brass">Privacy</Link>
          <Link to="/refund" className="hover:text-brass">Refunds</Link>
          <Link to="/" className="hover:text-brass">Home</Link>
        </div>
      </div>
    </main>
  );
}
