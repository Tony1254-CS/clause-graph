import { getPaddleEnvironment } from "@/lib/paddle";

export function PaymentTestModeBanner() {
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div className="w-full border-b border-brass/20 bg-brass/10 px-4 py-1.5 text-center font-mono text-[11px] uppercase tracking-wider text-brass">
      Preview runs in test mode — use card 4242 4242 4242 4242 to try checkout.{" "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        Learn more
      </a>
    </div>
  );
}
