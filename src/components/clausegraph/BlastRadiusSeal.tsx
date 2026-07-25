export function BlastRadiusSeal() {
  return (
    <div className="relative flex flex-col items-center gap-8">
      {/* Caption above */}
      <div className="text-center max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
          Blast Radius
        </p>
        <h1 className="mt-3 font-display text-[42px] leading-[1.05] tracking-tight text-foreground">
          Awaiting simulation
        </h1>
        <p className="mt-3 text-[13.5px] text-muted-foreground leading-relaxed">
          Select a pending regulation to trace its downstream impact across
          contract obligations and calculate exposure.
        </p>
      </div>

      {/* The seal */}
      <div className="relative">
        {/* Outer glow */}
        <div className="absolute inset-0 rounded-full blur-3xl bg-[radial-gradient(circle,rgba(201,166,107,0.14),transparent_65%)]" />

        {/* Outer brass rim */}
        <div className="relative h-[440px] w-[440px] max-w-[80vw] max-h-[80vw] rounded-full border border-[var(--hairline-strong)] p-3">
          {/* Middle ring - mono tick marks would go here in later phases */}
          <div className="relative h-full w-full rounded-full border border-[var(--hairline)] p-3">
            {/* Inner glass medallion */}
            <div className="relative h-full w-full rounded-full glass-panel !rounded-full grid place-items-center overflow-hidden">
              {/* Radial faint grid */}
              <div className="absolute inset-6 rounded-full border border-[var(--hairline)] opacity-60" />
              <div className="absolute inset-16 rounded-full border border-[var(--hairline)] opacity-40" />
              <div className="absolute inset-28 rounded-full border border-[var(--hairline)] opacity-25" />

              {/* Crosshair */}
              <div className="absolute left-1/2 top-6 bottom-6 w-px bg-[var(--hairline)] opacity-40" />
              <div className="absolute top-1/2 left-6 right-6 h-px bg-[var(--hairline)] opacity-40" />

              {/* Center indicator */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-brass shadow-[0_0_20px_var(--brass)]" />
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  epicenter
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Corner labels — mono compass points */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          N · Direct
        </div>
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          S · Tertiary
        </div>
        <div className="absolute top-1/2 -left-3 -translate-y-1/2 -rotate-90 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground origin-center">
          W · Counterparty
        </div>
        <div className="absolute top-1/2 -right-3 -translate-y-1/2 rotate-90 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground origin-center">
          E · Clause
        </div>
      </div>

      {/* Meta strip */}
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 pt-4">
        <MetaStat label="Est. Exposure" value="$ —" mono />
        <span className="h-3 w-px bg-[var(--hairline)]" />
        <MetaStat label="Clauses Affected" value="—" mono />
        <span className="h-3 w-px bg-[var(--hairline)]" />
        <MetaStat label="Effective" value="—" mono />
      </div>
    </div>
  );
}

function MetaStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span
        className={`text-[15px] text-foreground ${mono ? "font-mono" : "font-display"}`}
      >
        {value}
      </span>
    </div>
  );
}
