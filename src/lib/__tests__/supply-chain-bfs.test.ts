import { describe, it, expect } from "vitest";
import {
  computeDeterministicBfsCascade,
  determineSeverity,
  coerceHits,
} from "../supply-chain.server";
import type { ChainNode, ChainEdge } from "../supply-chain.functions";

describe("Supply Chain Deterministic BFS Cascade", () => {
  // Fixture 1: Linear 3-tier chain
  // self (0) -> cloud (1) -> datacenter (2) -> power (3)
  const linearNodes: ChainNode[] = [
    {
      id: "node-self",
      name: "Your Org",
      role: "self",
      tier: 0,
      jurisdiction: "US",
      description: "Root",
    },
    {
      id: "node-cloud",
      name: "Cloud Provider",
      role: "supplier",
      tier: 1,
      jurisdiction: "US",
      description: "Hosting",
    },
    {
      id: "node-dc",
      name: "Colocation DC",
      role: "subprocessor",
      tier: 2,
      jurisdiction: "DE",
      description: "Data Center",
    },
    {
      id: "node-power",
      name: "Power Grid",
      role: "vendor",
      tier: 3,
      jurisdiction: "DE",
      description: "Electricity",
    },
  ];

  const linearEdges: ChainEdge[] = [
    {
      id: "edge-1",
      from_node_id: "node-self",
      to_node_id: "node-cloud",
      contract_name: "Cloud MSA",
      contract_value: 1000000,
      key_clauses: ["Data residency", "Availability SLA 99.9%"],
      depends_on_regs: ["REG-GDPR-44"],
    },
    {
      id: "edge-2",
      from_node_id: "node-cloud",
      to_node_id: "node-dc",
      contract_name: "DC Sublease",
      contract_value: 500000,
      key_clauses: ["Physical security", "Energy efficiency PUE"],
      depends_on_regs: ["EU-DATA-CENTER-ENERGY"],
    },
    {
      id: "edge-3",
      from_node_id: "node-dc",
      to_node_id: "node-power",
      contract_name: "Industrial Electricity",
      contract_value: 300000,
      key_clauses: ["Renewable energy percentage", "Uninterrupted power guarantee"],
      depends_on_regs: ["EU-DATA-CENTER-ENERGY"],
    },
  ];

  // Fixture 2: Diamond / Multi-Branch Dependency Graph
  // self -> cloud -> dc -> sub1
  // self -> payment -> processor -> sub1
  const diamondNodes: ChainNode[] = [
    {
      id: "d-self",
      name: "Self Corp",
      role: "self",
      tier: 0,
      jurisdiction: "EU",
      description: "Root",
    },
    {
      id: "d-cloud",
      name: "Cloud Provider",
      role: "supplier",
      tier: 1,
      jurisdiction: "EU",
      description: "Cloud",
    },
    {
      id: "d-pay",
      name: "Payment Gateway",
      role: "supplier",
      tier: 1,
      jurisdiction: "US",
      description: "Gateway",
    },
    {
      id: "d-sub",
      name: "Shared Subprocessor",
      role: "subprocessor",
      tier: 2,
      jurisdiction: "US",
      description: "Storage",
    },
  ];

  const diamondEdges: ChainEdge[] = [
    {
      id: "d-e1",
      from_node_id: "d-self",
      to_node_id: "d-cloud",
      contract_name: "Cloud Contract",
      contract_value: 800000,
      key_clauses: ["Security audits"],
      depends_on_regs: ["REG-SEC-17A4"],
    },
    {
      id: "d-e2",
      from_node_id: "d-self",
      to_node_id: "d-pay",
      contract_name: "Payment Processing",
      contract_value: 600000,
      key_clauses: ["PCI-DSS compliance"],
      depends_on_regs: ["PCI-DSS"],
    },
    {
      id: "d-e3",
      from_node_id: "d-cloud",
      to_node_id: "d-sub",
      contract_name: "Database Hosting",
      contract_value: 200000,
      key_clauses: ["Data encryption at rest"],
      depends_on_regs: ["REG-SEC-17A4"],
    },
    {
      id: "d-e4",
      from_node_id: "d-pay",
      to_node_id: "d-sub",
      contract_name: "Token Vault Storage",
      contract_value: 350000,
      key_clauses: ["Cardholder token storage"],
      depends_on_regs: ["PCI-DSS"],
    },
  ];

  // Fixture 3: Disconnected and Cyclic Graph
  const cycleNodes: ChainNode[] = [
    {
      id: "c-self",
      name: "Root Self",
      role: "self",
      tier: 0,
      jurisdiction: "EU",
      description: "Self",
    },
    {
      id: "c-a",
      name: "Node A",
      role: "supplier",
      tier: 1,
      jurisdiction: "EU",
      description: "Node A",
    },
    {
      id: "c-b",
      name: "Node B",
      role: "subprocessor",
      tier: 2,
      jurisdiction: "EU",
      description: "Node B",
    },
    {
      id: "c-isolated",
      name: "Isolated Node",
      role: "vendor",
      tier: 3,
      jurisdiction: "BD",
      description: "Unconnected",
    },
  ];

  const cycleEdges: ChainEdge[] = [
    {
      id: "c-e1",
      from_node_id: "c-self",
      to_node_id: "c-a",
      contract_name: "A Agreement",
      contract_value: 400000,
      key_clauses: ["Compliance obligations"],
      depends_on_regs: ["REG-GDPR-33"],
    },
    {
      id: "c-e2",
      from_node_id: "c-a",
      to_node_id: "c-b",
      contract_name: "B Agreement",
      contract_value: 250000,
      key_clauses: ["72-hour breach reporting"],
      depends_on_regs: ["REG-GDPR-33"],
    },
    {
      id: "c-e3",
      from_node_id: "c-b",
      to_node_id: "c-a", // Cycle back to A
      contract_name: "Reciprocal SLA",
      contract_value: 100000,
      key_clauses: ["Mutual indemnity"],
      depends_on_regs: ["REG-GDPR-33"],
    },
  ];

  it("Fixture 1: correctly calculates BFS hop distance and exposure in linear chain", () => {
    const res = computeDeterministicBfsCascade(
      linearNodes,
      linearEdges,
      "New Energy Efficiency Directive EU-DATA-CENTER-ENERGY regarding server power consumption",
    );

    expect(res.fallback).toBe(false);
    expect(res.hits.length).toBe(2);

    // node-dc is hop 2, node-power is hop 3
    const dcHit = res.hits.find((h) => h.node_id === "node-dc");
    const powerHit = res.hits.find((h) => h.node_id === "node-power");

    expect(dcHit).toBeDefined();
    expect(dcHit?.hop).toBe(2);
    expect(dcHit?.indirect_exposure_usd).toBe(500000);

    expect(powerHit).toBeDefined();
    expect(powerHit?.hop).toBe(3);
    expect(powerHit?.indirect_exposure_usd).toBe(300000);

    expect(res.total_indirect_exposure).toBe(800000);
  });

  it("Fixture 2: handles diamond dependencies with multiple edges impacting the same subprocessor", () => {
    const res = computeDeterministicBfsCascade(
      diamondNodes,
      diamondEdges,
      "SEC Rule 17a-4 Electronic records preservation update",
    );

    expect(res.hits.length).toBe(2);

    const cloudHit = res.hits.find((h) => h.node_id === "d-cloud");
    const subHit = res.hits.find((h) => h.node_id === "d-sub");

    expect(cloudHit).toBeDefined();
    expect(cloudHit?.hop).toBe(1);
    expect(cloudHit?.indirect_exposure_usd).toBe(800000);

    expect(subHit).toBeDefined();
    expect(subHit?.hop).toBe(2);
    expect(subHit?.indirect_exposure_usd).toBe(200000);

    expect(res.total_indirect_exposure).toBe(1000000);
  });

  it("Fixture 3: terminates safely on cycles and ignores unreachable nodes", () => {
    const res = computeDeterministicBfsCascade(
      cycleNodes,
      cycleEdges,
      "GDPR Article 33 breach notification mandate",
    );

    // Both A and B should be hit without infinite looping
    expect(res.hits.length).toBe(2);
    const hitA = res.hits.find((h) => h.node_id === "c-a");
    const hitB = res.hits.find((h) => h.node_id === "c-b");

    expect(hitA).toBeDefined();
    expect(hitA?.hop).toBe(1);

    expect(hitB).toBeDefined();
    expect(hitB?.hop).toBe(2);

    // Isolated node should not be in hits
    expect(res.hits.some((h) => h.node_id === "c-isolated")).toBe(false);
  });

  it("returns clean zero exposure when no supply-chain edges match", () => {
    const res = computeDeterministicBfsCascade(
      linearNodes,
      linearEdges,
      "Completely unrelated copyright statute concerning public performance and royalties",
    );

    expect(res.hits.length).toBe(0);
    expect(res.total_indirect_exposure).toBe(0);
    expect(res.summary).toContain("No supplier dependencies");
  });

  it("determines severity correctly using hop distance and contract value thresholds", () => {
    expect(determineSeverity(1, 100000)).toBe("high"); // Hop 1 is high
    expect(determineSeverity(2, 500000)).toBe("medium"); // Hop 2 is medium
    expect(determineSeverity(3, 100000)).toBe("low"); // Hop 3 is low
    expect(determineSeverity(3, 1500000)).toBe("medium"); // Hop 3 elevated by value >= $1M
    expect(determineSeverity(2, 2500000)).toBe("high"); // Hop 2 elevated by value >= $2M
  });

  it("coerceHits filters invalid node IDs and unknown severities", () => {
    const valid = new Set(["node-a", "node-b"]);
    const raw = [
      { node_id: "node-a", hop: 1, severity: "high", indirect_exposure_usd: 10000 },
      { node_id: "node-invalid", hop: 2, severity: "low", indirect_exposure_usd: 5000 },
      { node_id: "node-b", hop: 2, severity: "unknown_sev", indirect_exposure_usd: 5000 },
    ];

    const coerced = coerceHits(raw, valid);
    expect(coerced.length).toBe(1);
    expect(coerced[0].node_id).toBe("node-a");
  });
});
