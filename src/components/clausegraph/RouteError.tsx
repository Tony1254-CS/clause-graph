import { useRouter } from "@tanstack/react-router";
import { RotateCw } from "lucide-react";
import { AppShell } from "./AppShell";

/**
 * Shared route-level error fallback. Any server function failure (missing
 * deployment env vars, transient database error) renders this instead of a
 * blank screen, with a retry that re-runs the loader.
 */
export function RouteError({
  title,
  error,
  reset,
}: {
  title: string;
  error?: Error;
  reset?: () => void;
}) {
  const router = useRouter();
  const detail = error?.message?.trim();

  return (
    <AppShell>
      <div className="glass-panel max-w-lg p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--risk)]">
          {title}
        </p>
        <h1 className="mt-2 font-display text-[24px] leading-[1.15] tracking-tight text-foreground">
          This page didn&apos;t load.
        </h1>
        <p className="mt-3 max-w-[50ch] text-[13px] leading-relaxed text-[var(--text-muted)]">
          Something went wrong on our end. Retrying usually fixes it — if it keeps failing, the
          server may be missing its configuration.
        </p>
        {detail && (
          <p className="mt-4 break-words font-mono text-[11px] text-[var(--text-muted)]">
            {detail}
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            reset?.();
            router.invalidate();
          }}
          className="press mt-6 inline-flex items-center gap-2 rounded-[12px] border border-[var(--hairline-strong)] px-4 py-2 text-[13px] text-foreground transition-ui hover:border-[var(--brass)] hover:text-[var(--brass)]"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    </AppShell>
  );
}
