import { useEffect, useState } from "react";
import type { Contract, Regulation } from "@/data/types";
import type { Severity } from "@/lib/simulate-types";

type Props = {
  contracts: Contract[];
  regulations: Regulation[];
  impacts?: Map<string, Severity>;
  pulsing?: boolean;
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

type Node = {
  id: string;
  label: string;
  kind: "contract" | "regulation";
  x: number;
  y: number;
};

const SIZE = 440;
const CENTER = SIZE / 2;

const SEV_COLOR: Record<Severity, string> = {
  low: "rgba(225, 82, 75, 0.55)",
  medium: "rgba(225, 82, 75, 0.8)",
  high: "rgba(225, 82, 75, 1)",
};

const SEV_RADIUS: Record<Severity, number> = {
  low: 5,
  medium: 6.5,
  high: 8,
};

export function GraphMedallion({ contracts, regulations, impacts, pulsing }: Props) {
  const [hover, setHover] = useState<Node | null>(null);
  const reducedMotion = useReducedMotion();
  const nodeTransition = reducedMotion
    ? undefined
    : {
        transition:
          "r 500ms cubic-bezier(0.19, 1, 0.22, 1), fill 500ms cubic-bezier(0.19, 1, 0.22, 1), stroke 400ms ease-out, opacity 500ms ease-out",
      };
  const edgeTransition = reducedMotion
    ? undefined
    : {
        transition:
          "stroke 500ms cubic-bezier(0.19, 1, 0.22, 1), opacity 500ms ease-out, stroke-width 400ms ease-out",
      };

  const innerRadius = 118;
  const outerRadius = 180;

  const contractNodes: Node[] = contracts.map((c, i) => {
    const angle = (i / contracts.length) * Math.PI * 2 - Math.PI / 2;
    return {
      id: c.id,
      label: c.name,
      kind: "contract",
      x: CENTER + Math.cos(angle) * innerRadius,
      y: CENTER + Math.sin(angle) * innerRadius,
    };
  });

  const regNodes: Node[] = regulations.map((r, i) => {
    const angle = (i / regulations.length) * Math.PI * 2 - Math.PI / 2;
    return {
      id: r.id,
      label: r.title,
      kind: "regulation",
      x: CENTER + Math.cos(angle) * outerRadius,
      y: CENTER + Math.sin(angle) * outerRadius,
    };
  });

  const nodeById = new Map<string, Node>();
  [...contractNodes, ...regNodes].forEach((n) => nodeById.set(n.id, n));

  const edges: Array<{ from: Node; to: Node; key: string; impacted: boolean }> = [];
  contracts.forEach((c) => {
    const from = nodeById.get(c.id);
    if (!from) return;
    const impacted = impacts?.has(c.id) ?? false;
    const seen = new Set<string>();
    c.clauses.forEach((cl) => {
      cl.linked_regs.forEach((rid) => {
        if (seen.has(rid)) return;
        seen.add(rid);
        const to = nodeById.get(rid);
        if (to) edges.push({ from, to, key: `${c.id}-${rid}`, impacted });
      });
    });
  });

  return (
    <div className="relative flex flex-col items-center gap-6">
      <div className="max-w-xl text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
          Blast Radius
        </p>
        <h1 className="mt-3 font-display text-[clamp(42px,7vw,76px)] leading-[0.98] tracking-tight text-foreground">
          Portfolio topology
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
          {contracts.length} contracts · {regulations.length} regulations · {edges.length}{" "}
          citations.{" "}
          {impacts && impacts.size > 0
            ? `${impacts.size} contracts in blast radius.`
            : pulsing
              ? "Simulating downstream exposure…"
              : "Paste a regulation to simulate downstream exposure."}
        </p>
      </div>

      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brass)_28%,transparent),transparent_65%)] blur-3xl" />

        <div
          className={`relative rounded-full border border-[var(--hairline-strong)] bg-[color-mix(in_oklab,var(--surface-glass)_70%,transparent)] p-3 transition-shadow duration-200 ease-out backdrop-blur-2xl ${pulsing && !reducedMotion ? "rim-pulse" : ""}`}
          style={{ height: SIZE + 24, width: SIZE + 24, maxWidth: "80vw", maxHeight: "80vw" }}
        >
          <div className="relative h-full w-full rounded-full border border-[var(--hairline)] p-3">
            <div className="glass-panel relative h-full w-full overflow-hidden !rounded-full">
              <div className="pointer-events-none absolute inset-[16%] rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brass)_16%,transparent),transparent_68%)] radar-breathe" />
              <svg
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="absolute inset-0 h-full w-full"
                aria-label="Contract-regulation topology"
              >
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={outerRadius}
                  fill="none"
                  stroke="var(--hairline-strong)"
                  strokeWidth="1"
                  opacity="0.5"
                />
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={innerRadius}
                  fill="none"
                  stroke="var(--hairline)"
                  strokeWidth="1"
                  opacity="0.55"
                />
                <circle
                  cx={CENTER}
                  cy={CENTER}
                  r={50}
                  fill="none"
                  stroke="var(--brass)"
                  strokeWidth="1"
                  opacity="0.28"
                />

                <g>
                  {edges.map((e) => (
                    <line
                      key={e.key}
                      x1={e.from.x}
                      y1={e.from.y}
                      x2={e.to.x}
                      y2={e.to.y}
                      stroke={e.impacted ? "rgba(225,82,75,0.55)" : "var(--hairline-strong)"}
                      strokeWidth={e.impacted ? "1" : "0.6"}
                      opacity={e.impacted ? 0.9 : 0.7}
                      style={edgeTransition}
                    />
                  ))}
                </g>

                <g>
                  {contractNodes.map((n, idx) => {
                    const sev = impacts?.get(n.id);
                    const isHover = hover?.id === n.id;
                    const r = sev ? SEV_RADIUS[sev] : isHover ? 5.5 : 3.5;
                    const fill = sev ? SEV_COLOR[sev] : "var(--paper)";
                    const stroke = sev ? "rgba(225,82,75,1)" : "var(--brass)";
                    // Cascade delay proportional to node index → sweep effect
                    const delay = sev && !reducedMotion ? `${idx * 55}ms` : "0ms";
                    const cascadeStyle = nodeTransition
                      ? { ...nodeTransition, transitionDelay: delay }
                      : undefined;
                    return (
                      <g key={n.id}>
                        {sev && (
                          <circle
                            cx={n.x}
                            cy={n.y}
                            r={r + 4}
                            fill={SEV_COLOR[sev]}
                            opacity={0.18}
                            style={cascadeStyle}
                          />
                        )}
                        <circle
                          cx={n.x}
                          cy={n.y}
                          r={r}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth="1"
                          className="cursor-pointer"
                          style={cascadeStyle}
                          onMouseEnter={() => setHover(n)}
                          onMouseLeave={() => setHover(null)}
                        />
                      </g>
                    );
                  })}
                </g>

                <g>
                  {regNodes.map((n) => {
                    const size = hover?.id === n.id ? 7 : 5;
                    const points = `${n.x},${n.y - size} ${n.x - size * 0.87},${n.y + size * 0.5} ${n.x + size * 0.87},${n.y + size * 0.5}`;
                    return (
                      <polygon
                        key={n.id}
                        points={points}
                        fill="var(--paper)"
                        stroke="var(--text-muted)"
                        strokeWidth="1"
                        className="cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(null)}
                      />
                    );
                  })}
                </g>

                <circle cx={CENTER} cy={CENTER} r={4} fill="var(--brass)" />
              </svg>

              {hover && (
                <div
                  className="pointer-events-none absolute max-w-[220px] rounded-[12px] border border-[var(--hairline-strong)] bg-[var(--surface-raised)] px-3 py-2 shadow-[var(--glow-brass)] backdrop-blur-xl"
                  style={{
                    left: `${(hover.x / SIZE) * 100}%`,
                    top: `${(hover.y / SIZE) * 100}%`,
                    transform: "translate(-50%, calc(-100% - 12px))",
                  }}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--brass)]">
                    {hover.id}
                  </p>
                  <p className="mt-0.5 text-[12px] text-foreground leading-tight">{hover.label}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full border border-[var(--text-muted)]" />
          contract
        </span>
        <span className="flex items-center gap-2">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <polygon points="5,1 1,9 9,9" fill="none" stroke="var(--text-muted)" strokeWidth="1" />
          </svg>
          regulation
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[var(--risk)]" />
          in blast radius
        </span>
      </div>
    </div>
  );
}
