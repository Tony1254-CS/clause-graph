import { useState } from "react";
import type { Contract, Regulation } from "@/data/types";

type Props = {
  contracts: Contract[];
  regulations: Regulation[];
};

type Node = {
  id: string;
  label: string;
  kind: "contract" | "regulation";
  x: number;
  y: number;
};

const SIZE = 440;
const CENTER = SIZE / 2;

export function GraphMedallion({ contracts, regulations }: Props) {
  const [hover, setHover] = useState<Node | null>(null);

  // Deterministic circular layout: contracts on inner ring, regulations on outer.
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

  const edges: Array<{ from: Node; to: Node; key: string }> = [];
  contracts.forEach((c) => {
    const from = nodeById.get(c.id)!;
    const seen = new Set<string>();
    c.clauses.forEach((cl) => {
      cl.linked_regs.forEach((rid) => {
        if (seen.has(rid)) return;
        seen.add(rid);
        const to = nodeById.get(rid);
        if (to) edges.push({ from, to, key: `${c.id}-${rid}` });
      });
    });
  });

  return (
    <div className="relative flex flex-col items-center gap-6">
      <div className="text-center max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass">
          Blast Radius
        </p>
        <h1 className="mt-3 font-display text-[38px] leading-[1.05] tracking-tight text-foreground">
          Portfolio topology
        </h1>
        <p className="mt-3 text-[13.5px] text-muted-foreground leading-relaxed">
          {contracts.length} contracts · {regulations.length} regulations ·{" "}
          {edges.length} citations. Select a regulation to simulate downstream exposure.
        </p>
      </div>

      <div className="relative">
        <div className="absolute inset-0 rounded-full blur-3xl bg-[radial-gradient(circle,rgba(201,166,107,0.14),transparent_65%)]" />

        <div
          className="relative rounded-full border border-[var(--hairline-strong)] p-3"
          style={{ height: SIZE + 24, width: SIZE + 24, maxWidth: "80vw", maxHeight: "80vw" }}
        >
          <div className="relative h-full w-full rounded-full border border-[var(--hairline)] p-3">
            <div className="relative h-full w-full rounded-full glass-panel !rounded-full overflow-hidden">
              <svg
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="absolute inset-0 h-full w-full"
                aria-label="Contract-regulation topology"
              >
                {/* Radial rings */}
                <circle cx={CENTER} cy={CENTER} r={outerRadius} fill="none" stroke="var(--hairline)" strokeWidth="1" opacity="0.5" />
                <circle cx={CENTER} cy={CENTER} r={innerRadius} fill="none" stroke="var(--hairline)" strokeWidth="1" opacity="0.4" />
                <circle cx={CENTER} cy={CENTER} r={50} fill="none" stroke="var(--hairline)" strokeWidth="1" opacity="0.3" />

                {/* Edges */}
                <g>
                  {edges.map((e) => (
                    <line
                      key={e.key}
                      x1={e.from.x}
                      y1={e.from.y}
                      x2={e.to.x}
                      y2={e.to.y}
                      stroke="var(--hairline-strong)"
                      strokeWidth="0.6"
                      opacity="0.7"
                    />
                  ))}
                </g>

                {/* Contract nodes (circles) */}
                <g>
                  {contractNodes.map((n) => (
                    <circle
                      key={n.id}
                      cx={n.x}
                      cy={n.y}
                      r={hover?.id === n.id ? 5.5 : 3.5}
                      fill="var(--surface-raised)"
                      stroke="var(--text-muted)"
                      strokeWidth="1"
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(null)}
                    />
                  ))}
                </g>

                {/* Regulation nodes (triangles) */}
                <g>
                  {regNodes.map((n) => {
                    const size = hover?.id === n.id ? 7 : 5;
                    const points = `${n.x},${n.y - size} ${n.x - size * 0.87},${n.y + size * 0.5} ${n.x + size * 0.87},${n.y + size * 0.5}`;
                    return (
                      <polygon
                        key={n.id}
                        points={points}
                        fill="var(--surface-raised)"
                        stroke="var(--text-muted)"
                        strokeWidth="1"
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(null)}
                      />
                    );
                  })}
                </g>

                {/* Center */}
                <circle cx={CENTER} cy={CENTER} r={3} fill="var(--brass)" />
              </svg>

              {hover && (
                <div
                  className="absolute pointer-events-none rounded-[8px] border border-[var(--hairline-strong)] bg-[var(--surface-raised)] px-3 py-2 shadow-[var(--glow-brass)] max-w-[220px]"
                  style={{
                    left: `${(hover.x / SIZE) * 100}%`,
                    top: `${(hover.y / SIZE) * 100}%`,
                    transform: "translate(-50%, calc(-100% - 12px))",
                  }}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass">
                    {hover.id}
                  </p>
                  <p className="mt-0.5 text-[12px] text-foreground leading-tight">{hover.label}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
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
          <span className="h-px w-6 bg-[var(--hairline-strong)]" />
          citation
        </span>
      </div>
    </div>
  );
}
