import { useMemo } from "react";
import type { ChainNode, ChainEdge, CascadeHit } from "@/lib/supply-chain.functions";

type Props = {
  nodes: ChainNode[];
  edges: ChainEdge[];
  hits: Map<string, CascadeHit>;
  animating: boolean;
  onNodeClick?: (n: ChainNode) => void;
  selectedId?: string | null;
};

const W = 900;
const H = 460;

const SEV_COLOR: Record<CascadeHit["severity"], string> = {
  high: "var(--risk)",
  medium: "rgba(225,82,75,0.75)",
  low: "rgba(225,82,75,0.45)",
};

export function SupplyChainGraph({ nodes, edges, hits, animating, onNodeClick, selectedId }: Props) {
  const layout = useMemo(() => {
    // Column-per-tier layout, top-to-bottom by index within tier.
    const tiers = new Map<number, ChainNode[]>();
    nodes.forEach((n) => {
      const list = tiers.get(n.tier) ?? [];
      list.push(n);
      tiers.set(n.tier, list);
    });
    const maxTier = Math.max(0, ...Array.from(tiers.keys()));
    const colW = W / (maxTier + 2);
    const pos = new Map<string, { x: number; y: number }>();
    Array.from(tiers.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([tier, list]) => {
        const x = colW * (tier + 1);
        const step = H / (list.length + 1);
        list.forEach((n, i) => pos.set(n.id, { x, y: step * (i + 1) }));
      });
    return pos;
  }, [nodes]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Multi-hop supply chain dependency graph"
    >
      <defs>
        <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(201,166,107,0.35)" />
          <stop offset="100%" stopColor="rgba(201,166,107,0)" />
        </radialGradient>
        <radialGradient id="hit-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(225,82,75,0.55)" />
          <stop offset="100%" stopColor="rgba(225,82,75,0)" />
        </radialGradient>
      </defs>

      {/* Edges */}
      {edges.map((e) => {
        const a = layout.get(e.from_node_id);
        const b = layout.get(e.to_node_id);
        if (!a || !b) return null;
        const fromHit = hits.get(e.from_node_id);
        const toHit = hits.get(e.to_node_id);
        const propagates = !!(fromHit && toHit);
        const midX = (a.x + b.x) / 2;
        const path = `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
        const stroke = propagates
          ? SEV_COLOR[toHit!.severity]
          : "rgba(201,166,107,0.22)";
        const delay = animating && propagates ? Math.max(fromHit!.hop, 0) * 220 : 0;
        return (
          <g key={e.id}>
            <path
              d={path}
              fill="none"
              stroke={stroke}
              strokeWidth={propagates ? 2 : 1}
              strokeDasharray={propagates ? "0" : "4 4"}
              style={{
                opacity: 0,
                animation: animating
                  ? `edge-appear 380ms ease-out ${delay}ms forwards`
                  : "none",
                animationFillMode: "forwards",
              }}
            />
            {!animating && (
              <path d={path} fill="none" stroke={stroke} strokeWidth={propagates ? 2 : 1} strokeDasharray={propagates ? "0" : "4 4"} />
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map((n) => {
        const p = layout.get(n.id);
        if (!p) return null;
        const hit = hits.get(n.id);
        const isSelf = n.role === "self";
        const r = isSelf ? 30 : 24;
        const stroke = hit ? SEV_COLOR[hit.severity] : "rgba(201,166,107,0.55)";
        const fill = hit ? "rgba(225,82,75,0.10)" : "rgba(255,255,255,0.03)";
        const delay = animating && hit ? hit.hop * 220 : 0;
        return (
          <g
            key={n.id}
            transform={`translate(${p.x} ${p.y})`}
            onClick={onNodeClick ? () => onNodeClick(n) : undefined}
            style={{ cursor: onNodeClick ? "pointer" : "default" }}
          >
            {hit && (
              <circle
                r={r + 14}
                fill="url(#hit-glow)"
                style={{
                  opacity: 0,
                  animation: animating
                    ? `node-hit 500ms ease-out ${delay}ms forwards`
                    : "none",
                  animationFillMode: "forwards",
                }}
              />
            )}
            <circle
              r={r}
              fill={fill}
              stroke={stroke}
              strokeWidth={selectedId === n.id ? 2.5 : 1.5}
              style={{
                transformOrigin: "center",
                animation: animating && hit
                  ? `node-pulse 500ms ease-out ${delay}ms forwards`
                  : "none",
              }}
            />
            <text
              y={-r - 8}
              textAnchor="middle"
              className="fill-foreground"
              style={{ font: "600 12px var(--font-display, serif)" }}
            >
              {n.name}
            </text>
            <text
              y={-r - 22}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ font: "10px var(--font-mono, monospace)", letterSpacing: "0.14em", textTransform: "uppercase" }}
            >
              T{n.tier} · {n.jurisdiction ?? "—"}
            </text>
            <text
              y={4}
              textAnchor="middle"
              style={{ font: `600 ${isSelf ? 11 : 10}px var(--font-mono, monospace)`, fill: hit ? SEV_COLOR[hit.severity] : "var(--brass)" }}
            >
              {hit ? `HOP ${hit.hop}` : isSelf ? "YOU" : ""}
            </text>
          </g>
        );
      })}

      <style>{`
        @keyframes edge-appear { from { opacity: 0; stroke-dashoffset: 40; } to { opacity: 1; stroke-dashoffset: 0; } }
        @keyframes node-hit { 0% { opacity: 0; transform: scale(0.6); } 60% { opacity: 1; } 100% { opacity: 0.7; transform: scale(1); } }
        @keyframes node-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.08); } 100% { transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          @keyframes edge-appear { from { opacity: 1; } to { opacity: 1; } }
          @keyframes node-hit { from { opacity: 0.7; } to { opacity: 0.7; } }
          @keyframes node-pulse { from { transform: scale(1); } to { transform: scale(1); } }
        }
      `}</style>
    </svg>
  );
}
