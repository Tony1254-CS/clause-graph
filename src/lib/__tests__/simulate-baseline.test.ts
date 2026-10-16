import { describe, it, expect } from "vitest";
import { runDeterministicBaseline } from "../simulate-fallback";
import { coerceImpacts } from "../simulate.server";

describe("T1.6 (B-1/B-2): Deterministic Simulation Baseline & Honest Evaluation", () => {
  const dummyRegulations = [
    {
      id: "REG-GDPR-33",
      title: "GDPR Article 33 — 72-Hour Breach Notification",
      summary: "Notify competent supervisory authority within 72 hours of personal data breach.",
    },
    {
      id: "REG-HIPAA-SEC",
      title: "HIPAA Security Rule",
      summary: "Implement technical and administrative safeguards for ePHI.",
    },
  ];

  const dummyContracts = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Cloud Hosting Agreement",
      counterparty: "CloudCorp GmbH",
      clauses: [
        {
          id: "cl-1",
          text: "Processor shall notify Controller within 24 hours of any personal data breach.",
          linked_regs: ["REG-GDPR-33"],
        },
      ],
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      name: "Office Lease Agreement",
      counterparty: "Realty Trust",
      clauses: [
        {
          id: "cl-2",
          text: "Tenant shall maintain the leased premises in good order and pay rent monthly.",
          linked_regs: [],
        },
      ],
    },
  ];

  it("identifies direct regulatory citation matches on real contract IDs", () => {
    const input = "New guidance on REG-GDPR-33 requiring immediate supervisory escalation.";
    const result = runDeterministicBaseline(dummyContracts, dummyRegulations, input);

    expect(result.mode).toBe("deterministic");
    expect(result.fallback).toBe(true);
    expect(result.impacts.length).toBe(1);
    expect(result.impacts[0].contract_id).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.impacts[0].severity).toBe("high");
  });

  it("identifies keyword matches without direct tag when terms overlap", () => {
    const input =
      "Safeguards required for electronic protected health information and technical controls.";
    const result = runDeterministicBaseline(dummyContracts, dummyRegulations, input);

    expect(result.mode).toBe("deterministic");
    // Office lease should not match health safeguards
    const matchedIds = result.impacts.map((i) => i.contract_id);
    expect(matchedIds).not.toContain("22222222-2222-2222-2222-222222222222");
  });

  it("returns zero impacts honestly when no contract matches", () => {
    const input = "Deep seabed mineral exploration extraction quota regulations.";
    const result = runDeterministicBaseline(dummyContracts, dummyRegulations, input);

    expect(result.impacts).toEqual([]);
    expect(result.summary).toContain("found no contracts impacted");
  });

  it("handles empty contracts portfolio gracefully", () => {
    const result = runDeterministicBaseline([], dummyRegulations, "Any regulation");
    expect(result.impacts).toEqual([]);
    expect(result.mode).toBe("deterministic");
  });

  it("coerceImpacts preserves an empty impacts array honestly (B-1 fix)", () => {
    const validIds = new Set(["c1", "c2"]);
    const emptyPayload = { summary: "No impacts found", impacts: [] };
    const coerced = coerceImpacts(emptyPayload, validIds);

    expect(coerced).not.toBeNull();
    expect(coerced).toEqual([]);
  });

  it("coerceImpacts filters out hallucinated contract IDs", () => {
    const validIds = new Set(["valid-id-1"]);
    const payload = {
      impacts: [
        { contract_id: "valid-id-1", severity: "high", suggested_amendment: "Fix clause" },
        { contract_id: "CTR-999-hallucinated", severity: "high", suggested_amendment: "Fake" },
      ],
    };
    const coerced = coerceImpacts(payload, validIds);

    expect(coerced).not.toBeNull();
    expect(coerced?.length).toBe(1);
    expect(coerced?.[0].contract_id).toBe("valid-id-1");
  });
});
