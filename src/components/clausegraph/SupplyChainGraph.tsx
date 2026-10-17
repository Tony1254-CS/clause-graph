import { useMemo, useState } from "react";
import type { ChainNode, ChainEdge, CascadeHit } from "@/lib/supply-chain.functions";

type Props = {
  nodes: ChainNode[];
  edges: ChainEdge[];
  hits: Map<string, CascadeHit>;
  animating: boolean;
  onNodeClick?: (n: ChainNode) => void;
  selectedId?: string | null;
};

const W = 920;
const H = 460;

const SEV_COLOR: Record<CascadeHit["severity"], string> = {
  high: "var(--risk)",
  medium: "color-mix(in oklab, var(--risk) 75%, transparent)",
  low: "color-mix(in oklab, var(--risk) 45%, transparent)",
};

export function SupplyChainGraph({ nodes, edges, hits, animating, onNodeClick, selectedId }: Props) {
  const [hoveredNode, setHoveredNode] = useState<ChainNode | null>(null);

  const { layout, tiersList } = useMemo(() => {
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
    const tList: Array<{ tier: number; x: number }> = [];

    Array.from(tiers.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([tier, list]) => {
        const x = colW * (tier + 1);
        tList.push({ tier, x });
        const step = H / (list.length + 1);
        list.forEach((n, i) => pos.set(n.id, { x, y: step * (i + 1) }));
      });

    return { layout: pos, tiersList: tList };
  }, [nodes]);

  // Compute connected nodes and edges when a node is hovered for Interactive Pathway Tracing
  const activePath = useMemo(() => {
    if (!hoveredNode) return null;
    const connectedNodeIds = new Set<string>([hoveredNode.id]);
    const connectedEdgeIds = new Set<string>();

    // Bidirectional graph search to find paths leading to/from hovered node
    let changed = true;
    while (changed) {
      changed = false;
      edges.forEach((e) => {
        if (connectedNodeIds.has(e.from_node_id) || connectedNodeIds.has(e.to_node_id)) {
          if (!connectedEdgeIds.has(e.id)) {
            connectedEdgeIds.add(e.id);
            connectedNodeIds.add(e.from_node_id);
            connectedNodeIds.add(e.to_node_id);
            changed = true;
          }
        }
      });
    }

    return { nodeIds: connectedNodeIds, edgeIds: connectedEdgeIds };
  }, [hoveredNode, edges]);

  const hoveredHit = hoveredNode ? hits.get(hoveredNode.id) : null;
  const hoveredPos = hoveredNode ? layout.get(hoveredNode.id) : null;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto select-none"
        role="img"
        aria-label="Multi-hop supply chain dependency graph"
      >
        <defs>
          <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="color-mix(in oklab, var(--brass) 35%, transparent)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="hit-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="color-mix(in oklab, var(--risk) 55%, transparent)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="self-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(20, 198, 164, 0.45)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Glowing Arrow Markers for direction */}
          <marker id="arrow-mint" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--brass)" opacity="0.6" />
          </marker>
          <marker id="arrow-risk" viewBox="0 0 10 10" refX="28" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="var(--risk)" opacity="0.9" />
          </marker>
        </defs>

        {/* Tier Column Background Guidelines */}
        {tiersList.map((t) => (
          <g key={t.tier}>
            <line
              x1={t.x}
              y1={24}
              x2={t.x}
              y2={H - 24}
              stroke="var(--hairline)"
              strokeDasharray="4 6"
              strokeWidth="1"
              opacity="0.45"
            />
            <text
              x={t.x}
              y={18}
              textAnchor="middle"
              className="fill-muted-foreground/60 font-mono text-[9.5px] uppercase tracking-[0.2em]"
            >
              {t.tier === 0 ? "Tier 0 (Your Company)" : `Tier ${t.tier} Supplier`}
            </text>
          </g>
        ))}

        {/* Edges with Animated Flow Particles */}
        {edges.map((e) => {
          const a = layout.get(e.from_node_id);
          const b = layout.get(e.to_node_id);
          if (!a || !b) return null;
          const fromHit = hits.get(e.from_node_id);
          const toHit = hits.get(e.to_node_id);
          const propagates = Boolean(fromHit && toHit);
          const midX = (a.x + b.x) / 2;
          const path = `M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`;
          
          const isPathActive = activePath ? activePath.edgeIds.has(e.id) : true;
          const stroke = propagates && toHit
            ? SEV_COLOR[toHit.severity]
            : isPathActive
              ? "color-mix(in oklab, var(--brass) 45%, transparent)"
              : "color-mix(in oklab, var(--brass) 12%, transparent)";
          const strokeWidth = propagates ? 2.5 : isPathActive ? 2 : 1;
          const opacity = activePath && !isPathActive ? 0.15 : 1;

          return (
            <g key={e.id} style={{ opacity, transition: "opacity 200ms ease" }}>
              {/* Main Line */}
              <path
                d={path}
                fill="none"
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={propagates ? "0" : "4 4"}
                markerEnd={propagates ? "url(#arrow-risk)" : "url(#arrow-mint)"}
              />

              {/* Animated Glowing Particle / Pulse moving along the edge */}
              {propagates ? (
                /* Red Energy Pulse traveling from upstream supplier to downstream */
                <circle r={3.5} fill="var(--risk)" className="shadow-lg">
                  <animateMotion
                    path={path}
                    dur="2.2s"
                    repeatCount="indefinite"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                </circle>
              ) : isPathActive && !activePath ? (
                /* Subtle healthy mint pulse */
                <circle r={2.5} fill="var(--brass)" opacity="0.65">
                  <animateMotion
                    path={path}
                    dur="3.8s"
                    repeatCount="indefinite"
                    keyPoints="0;1"
                    keyTimes="0;1"
                    calcMode="linear"
                  />
                </circle>
              ) : null}
            </g>
          );
        })}

        {/* Nodes with Enhanced Icons and Hierarchy */}
        {nodes.map((n) => {
          const p = layout.get(n.id);
          if (!p) return null;
          const hit = hits.get(n.id);
          const isSelf = n.role === "self";
          const isSelected = selectedId === n.id;
          const isHovered = hoveredNode?.id === n.id;
          const isDimmed = activePath ? !activePath.nodeIds.has(n.id) : false;

          const r = isSelf ? 32 : 25;
          const stroke = hit
            ? SEV_COLOR[hit.severity]
            : isHovered || isSelected
              ? "var(--brass-strong)"
              : isSelf
                ? "var(--brass)"
                : "color-mix(in oklab, var(--brass) 55%, transparent)";
          const fill = hit
            ? "color-mix(in oklab, var(--risk) 16%, #0d1218)"
            : isHovered
              ? "color-mix(in oklab, var(--brass) 18%, #0d1218)"
              : isSelf
                ? "color-mix(in oklab, var(--brass) 12%, #0d1218)"
                : "#0d1218";

          return (
            <g
              key={n.id}
              transform={`translate(${p.x} ${p.y})`}
              onClick={onNodeClick ? () => onNodeClick(n) : undefined}
              onMouseEnter={() => setHoveredNode(n)}
              onMouseLeave={() => setHoveredNode(null)}
              className="cursor-pointer transition-all duration-200"
              style={{
                opacity: isDimmed ? 0.25 : 1,
              }}
            >
              {/* Outer Glow Halo */}
              {hit ? (
                <circle r={r + 16} fill="url(#hit-glow)" className="animate-pulse" />
              ) : isSelf ? (
                <circle r={r + 14} fill="url(#self-glow)" opacity="0.75" />
              ) : null}

              {/* Node Body Circle */}
              <circle
                r={isHovered ? r + 4 : r}
                fill={fill}
                stroke={stroke}
                strokeWidth={isSelected || isHovered ? 2.5 : isSelf ? 2 : 1.5}
                className="transition-all duration-200"
                style={{
                  transformOrigin: "center",
                }}
              />

              {/* Role / Entity SVG Icon inside the node */}
              <g transform="translate(0, -6)" pointerEvents="none">
                {isSelf ? (
                  /* Shield / Fortress Icon for 'YOU' */
                  <path
                    d="M -7 -4 L 0 -8 L 7 -4 L 7 3 C 7 7, 0 11, 0 11 C 0 11, -7 7, -7 3 Z"
                    fill="none"
                    stroke={hit ? "var(--risk)" : "var(--brass)"}
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                  />
                ) : n.role === "supplier" ? (
                  /* Server / Cloud Database Icon */
                  <g stroke={hit ? "var(--risk)" : "var(--brass)"} strokeWidth="1.4" fill="none">
                    <rect x="-8" y="-7" width="16" height="6" rx="2" />
                    <rect x="-8" y="2" width="16" height="6" rx="2" />
                    <circle cx="4" cy="-4" r="0.8" fill={hit ? "var(--risk)" : "var(--brass)"} />
                    <circle cx="4" cy="5" r="0.8" fill={hit ? "var(--risk)" : "var(--brass)"} />
                  </g>
                ) : (
                  /* Vendor / Network Connection Icon */
                  <g stroke={hit ? "var(--risk)" : "var(--brass)"} strokeWidth="1.4" fill="none">
                    <circle cx="0" cy="-2" r="4.5" />
                    <path d="M -6 7 C -6 4, 6 4, 6 7" />
                  </g>
                )}
              </g>

              {/* Sub-label inside node */}
              <text
                y={13}
                textAnchor="middle"
                className="select-none font-mono"
                style={{
                  font: `700 ${isSelf ? 10.5 : 9.5}px var(--font-mono, monospace)`,
                  fill: hit ? SEV_COLOR[hit.severity] : isSelf ? "var(--brass)" : "var(--text-muted)",
                }}
              >
                {hit ? `HOP ${hit.hop}` : isSelf ? "YOU" : `T${n.tier}`}
              </text>

              {/* Node Labels: Auto-hide label on hover to completely prevent collision with the floating tooltip */}
              <g className={`transition-opacity duration-150 ${isHovered ? "opacity-0" : "opacity-100"}`}>
                <text
                  y={-r - 8}
                  textAnchor="middle"
                  className="fill-foreground font-semibold text-[12px] select-none"
                  style={{ font: "600 12px var(--font-display, serif)" }}
                >
                  {n.name}
                </text>
                <text
                  y={-r - 22}
                  textAnchor="middle"
                  className="fill-muted-foreground font-mono text-[9.5px] uppercase tracking-[0.14em] select-none"
                >
                  {isSelf ? "Enterprise Core" : `T${n.tier} · ${n.jurisdiction ?? "Global"}`}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Floating Smart Tooltip: Fully opaque obsidian background with vibrant glow, cleanly floating above nodes */}
      {hoveredNode && hoveredPos && (
        <div
          className="pointer-events-none absolute z-50 min-w-[260px] max-w-[320px] rounded-[16px] border border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-[#0d1218] p-4 shadow-[0_24px_60px_-10px_rgba(0,0,0,0.9),0_0_30px_-5px_rgba(94,234,212,0.28)] backdrop-blur-3xl transition-all duration-150 animate-in fade-in zoom-in-95"
          style={{
            left: `${(hoveredPos.x / W) * 100}%`,
            top: `${(hoveredPos.y / H) * 100}%`,
            transform: `translate(${
              hoveredPos.x > W - 180 ? "calc(-100% - 20px)" : hoveredPos.x < 180 ? "20px" : "-50%"
            }, ${
              hoveredPos.y < 130 ? "28px" : "calc(-100% - 28px)"
            })`,
          }}
        >
          {/* Top glowing hairline accent */}
          <div
            className="absolute inset-x-0 top-0 h-[2px] rounded-t-[16px]"
            style={{
              background: hoveredHit
                ? "linear-gradient(to right, transparent, var(--risk), transparent)"
                : "linear-gradient(to right, transparent, var(--brass), transparent)",
            }}
          />

          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2 mb-2.5">
            <span
              className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: hoveredHit ? "var(--risk)" : "var(--brass)" }}
            >
              {hoveredNode.role === "self" ? "Enterprise Organization (Target)" : `Tier ${hoveredNode.tier} Provider`}
            </span>
            <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
              {hoveredNode.jurisdiction ?? "Global"}
            </span>
          </div>

          <p className="font-display text-[14px] font-semibold leading-snug text-foreground">
            {hoveredNode.name}
          </p>

          {hoveredHit ? (
            <div className="mt-2.5 space-y-2 pt-2.5 border-t border-white/10 text-[11.5px]">
              <div className="flex items-center justify-between font-mono">
                <span className="text-muted-foreground">Cascade Hop:</span>
                <span className="font-semibold text-[var(--risk)]">Hop {hoveredHit.hop} &middot; {hoveredHit.severity.toUpperCase()}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {hoveredHit.reason}
              </p>
              {hoveredHit.indirect_exposure_usd > 0 && (
                <div className="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-white/5">
                  <span className="text-muted-foreground">Exposure at Risk:</span>
                  <span className="text-foreground font-semibold">${hoveredHit.indirect_exposure_usd.toLocaleString()}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-white/10 text-[11.5px] font-mono">
              <span className="text-muted-foreground">Status:</span>
              <span className="text-[var(--brass)] font-semibold inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brass)] shadow-[0_0_8px_var(--brass)]" />
                Healthy / No Breach
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
