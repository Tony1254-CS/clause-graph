import { getPaddleEnvironment } from "@/lib/paddle";

export function PaymentTestModeBanner() {
  if (getPaddleEnvironment() !== "sandbox") return null;
  return (
    <div className="w-full border-b border-[var(--hairline)] bg-[var(--surface-glass)] px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-muted)] backdrop-blur-xl">
      Preview runs in test mode — use card 4242 4242 4242 4242 to try checkout.{" "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--ink)] underline underline-offset-2"
      >
        Learn more
      </a>
    </div>
  );
}
