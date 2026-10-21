import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, ShieldAlert, CheckCircle, Scale, FileText } from "lucide-react";
import type { Contract, Regulation } from "@/data/types";
import type { Severity } from "@/lib/simulate-types";

type Props = {
  contracts: Contract[];
  regulations: Regulation[];
  impacts?: Map<string, Severity>;
  pulsing?: boolean;
  hideHeader?: boolean;
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
  contract?: Contract;
  regulation?: Regulation;
};

const SIZE = 440;
const CENTER = SIZE / 2;

const SEV_COLOR: Record<Severity, string> = {
  low: "#e1524b",
  medium: "#e1524b",
  high: "#e1524b",
};

export function GraphMedallion({ contracts, regulations, impacts, pulsing, hideHeader }: Props) {
  const navigate = useNavigate();
  const [hover, setHover] = useState<Node | null>(null);
  const reducedMotion = useReducedMotion();

  const nodeTransition = reducedMotion
    ? undefined
    : { transition: "r 400ms cubic-bezier(0.19, 1, 0.22, 1), fill 400ms ease-out, stroke 300ms ease-out, opacity 400ms ease-out" };
  const edgeTransition = reducedMotion
    ? undefined
    : { transition: "stroke 300ms ease-out, opacity 300ms ease-out, stroke-width 300ms ease-out" };

  const innerRadius = 118;
  const outerRadius = 180;

  // Max value to scale node radii dynamically
  const maxContractVal = useMemo(() => {
    return Math.max(...contracts.map((c) => Number(c.value) || 0), 1_000_000);
  }, [contracts]);

  const contractNodes: Node[] = contracts.map((c, i) => {
    const angle = (i / contracts.length) * Math.PI * 2 - Math.PI / 2;
    return {
      id: c.id,
      label: c.name,
      kind: "contract",
      x: CENTER + Math.cos(angle) * innerRadius,
      y: CENTER + Math.sin(angle) * innerRadius,
      contract: c,
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
      regulation: r,
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

  // Smart Focus Highlighting: When a node is hovered, find all connected edges and counterpart nodes
  const { connectedNodeIds, connectedEdgeKeys } = useMemo(() => {
    if (!hover) return { connectedNodeIds: new Set<string>(), connectedEdgeKeys: new Set<string>() };

    const nodeIds = new Set<string>([hover.id]);
    const edgeKeys = new Set<string>();

    edges.forEach((e) => {
      if (e.from.id === hover.id) {
        nodeIds.add(e.to.id);
        edgeKeys.add(e.key);
      } else if (e.to.id === hover.id) {
        nodeIds.add(e.from.id);
        edgeKeys.add(e.key);
      }
    });

    return { connectedNodeIds: nodeIds, connectedEdgeKeys: edgeKeys };
  }, [hover, edges]);

  // Handle node navigation
  const handleNodeClick = (node: Node) => {
    if (node.kind === "contract") {
      navigate({ to: "/contracts/$contractId", params: { contractId: node.id } });
    } else {
      navigate({ to: "/regulations/$regId", params: { regId: node.id } });
    }
  };

  return (
    <div className="relative flex flex-col items-center gap-6">
      {!hideHeader && (
        <div className="max-w-xl text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--brass)]">
            Blast Radius
          </p>
          <h1 className="mt-3 font-display text-[clamp(42px,7vw,76px)] leading-[0.98] tracking-tight text-foreground">
            Portfolio Topology
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            {contracts.length} contracts · {regulations.length} regulations ·{" "}
            {edges.length} citations.{" "}
            {impacts && impacts.size > 0
              ? `${impacts.size} contracts in blast radius.`
              : pulsing
                ? "Simulating downstream exposure…"
                : "Paste a regulation to simulate downstream exposure."}
          </p>
        </div>
      )}

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
                className="absolute inset-0 h-full w-full select-none"
                aria-label="Contract-regulation topology"
              >
                <circle cx={CENTER} cy={CENTER} r={outerRadius} fill="none" stroke="var(--hairline-strong)" strokeWidth="1" opacity="0.35" />
                <circle cx={CENTER} cy={CENTER} r={innerRadius} fill="none" stroke="var(--hairline)" strokeWidth="1" opacity="0.4" />
                <circle cx={CENTER} cy={CENTER} r={50} fill="none" stroke="var(--brass)" strokeWidth="1" opacity="0.25" />

                {/* Edges with smart focus highlight */}
                <g>
                  {edges.map((e) => {
                    const isConnected = hover ? connectedEdgeKeys.has(e.key) : true;
                    const stroke = e.impacted ? "var(--risk)" : "var(--hairline-strong)";
                    const strokeWidth = hover && isConnected ? (e.impacted ? "2.5" : "1.8") : e.impacted ? "1.5" : "0.75";
                    const opacity = hover
                      ? isConnected
                        ? 1
                        : 0.12 // Dim unconnected lines when hovering
                      : e.impacted
                        ? 0.95
                        : 0.55;

                    return (
                      <line
                        key={e.key}
                        x1={e.from.x}
                        y1={e.from.y}
                        x2={e.to.x}
                        y2={e.to.y}
                        stroke={stroke}
                        strokeWidth={strokeWidth}
                        opacity={opacity}
                        style={edgeTransition}
                      />
                    );
                  })}
                </g>

                {/* Contract Nodes (Inner Ring) */}
                <g>
                  {contractNodes.map((n, idx) => {
                    const sev = impacts?.get(n.id);
                    const isHover = hover?.id === n.id;
                    const isConnected = hover ? connectedNodeIds.has(n.id) : true;
                    const isBlast = Boolean(sev);

                    // Proportional sizing based on contract monetary value
                    const valRatio = (Number(n.contract?.value) || 0) / maxContractVal;
                    const baseRadius = 4 + valRatio * 3.5; // Scaled between 4px and 7.5px
                    const r = isHover ? baseRadius + 2.5 : baseRadius;

                    const fill = isBlast ? (sev ? SEV_COLOR[sev] : "var(--risk)") : "var(--paper)";
                    const stroke = isBlast ? "var(--risk)" : "var(--brass)";
                    const opacity = hover && !isConnected ? 0.25 : 1;
                    const delay = sev && !reducedMotion ? `${idx * 40}ms` : "0ms";
                    const cascadeStyle = nodeTransition
                      ? { ...nodeTransition, transitionDelay: delay }
                      : undefined;

                    return (
                      <g
                        key={n.id}
                        className="cursor-pointer transition-opacity duration-200"
                        opacity={opacity}
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => handleNodeClick(n)}
                      >
                        {/* Invisible larger hit-area to eliminate hover flickering/jitter */}
                        <circle cx={n.x} cy={n.y} r={16} fill="transparent" />

                        {/* Blast halo glow */}
                        {isBlast && (
                          <circle
                            cx={n.x}
                            cy={n.y}
                            r={r + 5}
                            fill={sev ? SEV_COLOR[sev] : "var(--risk)"}
                            opacity={hover && isConnected ? 0.45 : 0.25}
                            className="pointer-events-none"
                            style={cascadeStyle}
                          />
                        )}

                        {/* Outer hover ring highlight */}
                        {(isHover || (hover && isConnected && n.id !== hover.id)) && (
                          <circle
                            cx={n.x}
                            cy={n.y}
                            r={r + 3.5}
                            fill="none"
                            stroke={stroke}
                            strokeWidth="1.2"
                            opacity={isHover ? 0.8 : 0.4}
                            className="pointer-events-none animate-pulse"
                          />
                        )}

                        <circle
                          cx={n.x}
                          cy={n.y}
                          r={r}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={isBlast ? "2" : "1.5"}
                          className="pointer-events-none"
                          style={cascadeStyle}
                        />
                      </g>
                    );
                  })}
                </g>

                {/* Regulation Nodes (Outer Ring - Triangles) */}
                <g>
                  {regNodes.map((n) => {
                    const isHover = hover?.id === n.id;
                    const isConnected = hover ? connectedNodeIds.has(n.id) : true;
                    const size = isHover ? 7.5 : 5.5;
                    const points = `${n.x},${n.y - size} ${n.x - size * 0.87},${n.y + size * 0.5} ${n.x + size * 0.87},${n.y + size * 0.5}`;
                    const opacity = hover && !isConnected ? 0.25 : 1;

                    return (
                      <g
                        key={n.id}
                        className="cursor-pointer transition-opacity duration-200"
                        opacity={opacity}
                        onMouseEnter={() => setHover(n)}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => handleNodeClick(n)}
                      >
                        {/* Invisible larger hit-area to prevent mouseleave jitter */}
                        <circle cx={n.x} cy={n.y} r={16} fill="transparent" />

                        {/* Hover accent ring */}
                        {(isHover || (hover && isConnected && n.id !== hover.id)) && (
                          <circle
                            cx={n.x}
                            cy={n.y}
                            r={11}
                            fill="none"
                            stroke="var(--brass)"
                            strokeWidth="1.2"
                            opacity={isHover ? 0.75 : 0.35}
                            className="pointer-events-none animate-pulse"
                          />
                        )}

                        <polygon
                          points={points}
                          fill="var(--paper)"
                          stroke="var(--brass)"
                          strokeWidth="1.5"
                          className="pointer-events-none"
                        />
                      </g>
                    );
                  })}
                </g>

                <circle cx={CENTER} cy={CENTER} r={4.5} fill="var(--brass)" className="shadow-[0_0_8px_var(--brass)]" />
              </svg>
            </div>
          </div>

          {/* Smart Executive Tooltip outside overflow-hidden */}
          {hover && (
            <div
              className="pointer-events-none absolute z-50 min-w-[260px] max-w-[340px] rounded-2xl border border-[color-mix(in_oklab,var(--brass)_45%,transparent)] bg-[var(--shell-bg)]/95 p-4 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.75),0_0_24px_-4px_rgba(94,234,212,0.25)] backdrop-blur-2xl transition-opacity duration-150 ease-out"
              style={{
                left: `${(hover.x / SIZE) * 100}%`,
                top: `${(hover.y / SIZE) * 100}%`,
                transform: `translate(${
                  hover.x > CENTER + 40 ? "calc(-100% - 14px)" : hover.x < CENTER - 40 ? "14px" : "-50%"
                }, ${
                  hover.y < 90 ? "18px" : "calc(-100% - 16px)"
                })`,
              }}
            >
              {/* Glowing Hairline Accent */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brass)] to-transparent rounded-t-2xl" />

              {/* Status Header Badge */}
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2 mb-2.5">
                <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider">
                  {hover.kind === "contract" ? (
                    impacts?.has(hover.id) ? (
                      <span className="flex items-center gap-1 text-[var(--risk)]">
                        <ShieldAlert className="h-3 w-3" /> In Blast Radius
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle className="h-3 w-3" /> Compliant Instrument
                      </span>
                    )
                  ) : (
                    <span className="flex items-center gap-1 text-[var(--brass)]">
                      <Scale className="h-3 w-3" /> Regulatory Framework
                    </span>
                  )}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] text-muted-foreground uppercase">
                  {hover.kind}
                </span>
              </div>

              {/* Title & Organization */}
              <p className="font-display text-[13.5px] font-semibold leading-snug text-foreground">
                {hover.label}
              </p>

              {/* Contract Specific Details */}
              {hover.kind === "contract" && hover.contract && (
                <div className="mt-3 space-y-2 border-t border-white/5 pt-2.5 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Counterparty</span>
                    <strong className="text-foreground font-medium">{hover.contract.counterparty}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Contract Valuation</span>
                    <strong className="text-[var(--brass)] text-[13px] font-bold">
                      ${((hover.contract.value || 0) / 1_000_000).toFixed(2)}M
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Linked Citations</span>
                    <span className="text-foreground/90">
                      {(hover.contract.clauses || []).flatMap((c) => c.linked_regs).length} Statutory links
                    </span>
                  </div>
                </div>
              )}

              {/* Regulation Specific Details */}
              {hover.kind === "regulation" && hover.regulation && (
                <div className="mt-3 space-y-2 border-t border-white/5 pt-2.5 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Jurisdiction</span>
                    <strong className="text-foreground font-medium">{hover.regulation.jurisdiction || "Global"}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Compliance Rules</span>
                    <span className="text-[var(--brass)] font-semibold">
                      {hover.regulation.obligations?.length || 0} Mandated Obligations
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Dependent Contracts</span>
                    <span className="text-foreground/90">
                      {edges.filter((e) => e.to.id === hover.id).length} Active Agreements
                    </span>
                  </div>
                </div>
              )}

              {/* Interactive Action Prompt */}
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[10px] font-mono text-[var(--brass)]">
                <span>Click node to view details</span>
                <ArrowUpRight className="h-3 w-3" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full border border-[var(--brass)] bg-[var(--paper)]" />
          contract
        </span>
        <span className="flex items-center gap-2">
          <svg width="11" height="11" viewBox="0 0 10 10">
            <polygon points="5,1 1,9 9,9" fill="var(--paper)" stroke="var(--brass)" strokeWidth="1.2" />
          </svg>
          regulation
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--risk)] shadow-[0_0_8px_var(--risk)]" />
          in blast radius
        </span>
      </div>
    </div>
  );
}
