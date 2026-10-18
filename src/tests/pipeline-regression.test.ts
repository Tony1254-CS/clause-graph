import test from "node:test";
import assert from "node:assert/strict";

import { coerceActionPlan } from "../lib/action-plan.server.js";
import { coerceImpacts } from "../lib/simulate.server.js";
import { fallbackSimulation } from "../lib/simulate-fallback.js";
import { fallbackActionPlan } from "../lib/action-plan-fallback.js";
import { verifyCitations } from "../lib/citation-verifier.js";

test("Regression: coerceImpacts maintains backward-compatible schema", () => {
  const validIds = new Set(["CTR-001", "CTR-002"]);
  const raw = {
    summary: "New capital adequacy rule applies to lending facilities.",
    impacts: [
      {
        contract_id: "CTR-001",
        severity: "high",
        suggested_amendment: "Update risk-weighted asset computation clause.",
      },
      {
        contract_id: "CTR-INVALID",
        severity: "low",
        suggested_amendment: "Ignore this.",
      },
    ],
  };

  const parsed = coerceImpacts(raw, validIds);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].contract_id, "CTR-001");
  assert.equal(parsed[0].severity, "high");
});

test("Regression: coerceActionPlan maintains backward-compatible schema", () => {
  const raw = {
    policy_draft: "This is a mandatory draft policy on internal controls.",
    amendments: [
      {
        contract_id: "CTR-001",
        contract_name: "Master Cloud Agreement",
        suggestion: "Amend term to 72h notification.",
        rationale: "Align with GDPR Art. 33.",
      },
    ],
    tech_fixes: [
      {
        priority: "P0",
        title: "Configure audit logging",
        detail: "Enable cloud trail logging across VPC.",
      },
    ],
  };

  const plan = coerceActionPlan(raw);
  assert.ok(plan);
  assert.equal(plan?.fallback, false);
  assert.equal(plan?.amendments.length, 1);
  assert.equal(plan?.tech_fixes.length, 1);
  assert.equal(plan?.tech_fixes[0].priority, "P0");
});

test("Regression: Fallback simulation and action plans remain intact", () => {
  assert.ok(fallbackSimulation.impacts.length > 0);
  assert.ok(fallbackActionPlan.amendments.length > 0);
  assert.ok(fallbackActionPlan.tech_fixes.length > 0);
});

test("Regression: Citation verification on fallback simulation produces non-blocking audit", () => {
  const sampleFallbackText = [
    fallbackSimulation.summary ?? "",
    ...fallbackSimulation.impacts.map((i) => i.suggested_amendment),
  ].join("\n");

  const summary = verifyCitations(sampleFallbackText);
  assert.ok(summary);
  assert.equal(typeof summary.totalCitations, "number");
  assert.equal(typeof summary.requiresHumanReview, "boolean");
});
