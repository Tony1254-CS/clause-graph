import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — ClauseGraph" },
      {
        name: "description",
        content: "ClauseGraph 30-day money-back guarantee and refund policy.",
      },
      { property: "og:title", content: "Refund Policy — ClauseGraph" },
      {
        property: "og:description",
        content: "30-day money-back guarantee on ClauseGraph subscriptions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-[820px] px-6 py-16">
        <Link
          to="/"
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-brass hover:underline"
        >
          ← ClauseGraph
        </Link>
        <h1 className="mt-6 font-display text-[44px] leading-tight text-foreground">
          Refund Policy
        </h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Last updated: 25 July 2026
        </p>

        <div className="prose prose-invert mt-10 space-y-6 text-[14.5px] leading-[1.7] text-foreground/90">
          <p>
            <strong>30-day money-back guarantee.</strong> If ClauseGraph isn't the right fit, you
            can request a full refund within 30 days of your order date. No questions asked.
          </p>

          <h2 className="font-display text-[22px] text-foreground">How to request a refund</h2>
          <p>
            Refunds are processed by our payment provider, <strong>Paddle</strong>, which is the
            merchant of record for all ClauseGraph subscriptions. You have two ways to request one:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Visit{" "}
              <a
                href="https://paddle.net"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brass underline"
              >
                paddle.net
              </a>{" "}
              and look up your order using the email address you used at checkout.
            </li>
            <li>
              Email us at{" "}
              <a href="mailto:support@clausegraph.app" className="text-brass underline">
                support@clausegraph.app
              </a>{" "}
              and we'll initiate the refund on your behalf.
            </li>
          </ul>

          <p>
            Refunds are returned to the original payment method within 5–10 business days, depending
            on your bank or card issuer.
          </p>

          <h2 className="font-display text-[22px] text-foreground">After the refund window</h2>
          <p>
            Beyond 30 days you can cancel your subscription at any time from the billing portal —
            you will keep access until the end of the current billing period and won't be charged
            again.
          </p>
        </div>

        <div className="mt-12 flex gap-6 text-[13px] text-muted-foreground">
          <Link to="/terms" className="hover:text-brass">
            Terms
          </Link>
          <Link to="/privacy" className="hover:text-brass">
            Privacy
          </Link>
          <Link to="/" className="hover:text-brass">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
