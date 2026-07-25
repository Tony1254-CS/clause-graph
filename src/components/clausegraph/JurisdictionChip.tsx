export function JurisdictionChip({ jurisdiction }: { jurisdiction: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--hairline)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-brass">
      <span className="h-1 w-1 rounded-full bg-brass" />
      {jurisdiction}
    </span>
  );
}
