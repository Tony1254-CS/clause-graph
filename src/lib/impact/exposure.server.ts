// src/lib/impact/exposure.server.ts
// Deterministic financial exposure calculation for regulatory impact assessments (Phase 3 T3.3)

export interface ContractExposureInput {
  contractId: string;
  contractName: string;
  contractValue: number;
  reviewStatus: "pending_review" | "approved" | "rejected" | "edited";
  verdict: "conflict" | "gap" | "needs_update" | "compliant" | "insufficient_evidence";
  severity: "low" | "medium" | "high" | null;
}

export interface ExposureBreakdown {
  totalExposure: number;
  approvedExposure: number;
  pendingExposure: number;
  impactedContractsCount: number;
  contractsTotalCount: number;
  bySeverity: {
    high: number;
    medium: number;
    low: number;
  };
  byVerdict: {
    conflict: number;
    gap: number;
    needs_update: number;
    insufficient_evidence: number;
    compliant: number;
  };
  formula: string;
}

const ACTIONABLE_VERDICTS = new Set(["conflict", "gap", "needs_update"]);

/**
 * Calculates deterministic portfolio exposure.
 * Formula: sum(distinct contract.value) for contracts with at least one actionable impact
 * (verdict IN ('conflict', 'gap', 'needs_update') and reviewStatus != 'rejected').
 *
 * Distinct contract aggregation avoids double-counting contracts that violate multiple obligations.
 */
export function calculateDeterministicExposure(
  assessments: ContractExposureInput[],
  totalPortfolioContracts = 0,
): ExposureBreakdown {
  const distinctContracts = new Map<
    string,
    {
      value: number;
      isApproved: boolean;
      maxSeverity: "low" | "medium" | "high";
    }
  >();

  const byVerdict = {
    conflict: 0,
    gap: 0,
    needs_update: 0,
    insufficient_evidence: 0,
    compliant: 0,
  };

  const severityOrder: Record<string, number> = {
    low: 1,
    medium: 2,
    high: 3,
  };

  for (const item of assessments) {
    if (item.verdict in byVerdict) {
      byVerdict[item.verdict]++;
    }

    // Exclude non-actionable or rejected impacts from exposure
    if (!ACTIONABLE_VERDICTS.has(item.verdict) || item.reviewStatus === "rejected") {
      continue;
    }

    const current = distinctContracts.get(item.contractId);
    const itemSeverity = item.severity || "medium";
    const isItemApproved = item.reviewStatus === "approved" || item.reviewStatus === "edited";

    if (!current) {
      distinctContracts.set(item.contractId, {
        value: item.contractValue || 0,
        isApproved: isItemApproved,
        maxSeverity: itemSeverity,
      });
    } else {
      // If any impact on this contract is approved, count toward approved exposure
      if (isItemApproved) {
        current.isApproved = true;
      }
      // Upgrade severity if current impact is higher severity
      if (severityOrder[itemSeverity] > severityOrder[current.maxSeverity]) {
        current.maxSeverity = itemSeverity;
      }
    }
  }

  let totalExposure = 0;
  let approvedExposure = 0;
  let pendingExposure = 0;

  const bySeverity = {
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const contract of distinctContracts.values()) {
    totalExposure += contract.value;
    if (contract.isApproved) {
      approvedExposure += contract.value;
    } else {
      pendingExposure += contract.value;
    }
    bySeverity[contract.maxSeverity] += contract.value;
  }

  return {
    totalExposure,
    approvedExposure,
    pendingExposure,
    impactedContractsCount: distinctContracts.size,
    contractsTotalCount: Math.max(totalPortfolioContracts, distinctContracts.size),
    bySeverity,
    byVerdict,
    formula: "sum(distinct contract.value) for contracts with >= 1 actionable unrejected impact",
  };
}
