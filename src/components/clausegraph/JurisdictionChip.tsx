export function JurisdictionChip({ jurisdiction }: { jurisdiction: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface-glass)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--brass)]">
      <span className="h-1 w-1 rounded-full bg-[var(--brass)]" />
      {jurisdiction}
    </span>
  );
}
