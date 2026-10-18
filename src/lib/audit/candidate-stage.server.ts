// ============================================================================
// Service: Human Review Candidate Staging & Approval: src/lib/audit/candidate-stage.server.ts
// Specification: ClauseGraph_AuditLog_EvalHarness_Spec_MERGED.md (§4.4, §21)
// ============================================================================

import fs from "fs";
import path from "path";
import { redactAuditPayload } from "./redaction.server";
import type { ReviewItem } from "../review/types";


export interface StagedCandidate {
  id: string;
  source_review_id: string;
  staged_at: string;
  staged_by?: string;
  decision: "approved" | "rejected" | "edited";
  label_correctness: "correct" | "incorrect" | "overridden";
  reason?: string;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  promoted_to_dataset?: string | null;
  case: {
    id: string;
    class?: string;
    regulation_family: string;
    jurisdiction: string;
    regulation_text: string;
    contracts: Array<{
      id: string;
      name: string;
      value: number;
      clauses: string[];
    }>;
    expected: {
      impacted_contract_ids: string[];
      severity: Record<string, string>;
      total_exposure_usd: number;
      requires_human_review: boolean;
    };
  };
}

const CANDIDATES_FILE = path.resolve(process.cwd(), "evals/datasets/candidates/candidates.json");

function getCandidatesData(): { version: string; dataset: string; description: string; candidates: StagedCandidate[] } {
  if (fs.existsSync(CANDIDATES_FILE)) {
    try {
      const content = fs.readFileSync(CANDIDATES_FILE, "utf-8");
      return JSON.parse(content);
    } catch (err) {
      console.warn("[CandidateStage] Failed to read candidates.json, initializing default:", err);
    }
  }

  return {
    dataset: "candidates",
    version: "1.0.0",
    description: "Production-derived review queue candidates awaiting human approval before joining golden sets",
    candidates: [],
  };
}

function saveCandidatesData(data: any): void {
  const dir = path.dirname(CANDIDATES_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(CANDIDATES_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Stage an edited or rejected AI output into the candidates staging queue (§21)
 */
export async function stageCandidateFromReview(params: {
  reviewItem: ReviewItem;
  decision: "approved" | "rejected";
  reason?: string;
  editedPayload?: any;
  reviewerId: string;
  labelCorrectness?: "correct" | "incorrect";
}): Promise<StagedCandidate> {
  const { reviewItem, decision, reason, editedPayload, reviewerId, labelCorrectness } = params;

  // Sanitization (§21.3): Ensure customer identifiers, emails, and secrets are redacted
  const sanitizedOriginal = await redactAuditPayload(reviewItem.payload || {});
  const sanitizedEdited = editedPayload ? await redactAuditPayload(editedPayload) : undefined;


  const candidateId = `cand-${reviewItem.id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
  const effectivePayload = sanitizedEdited || sanitizedOriginal;

  const candidate: StagedCandidate = {
    id: candidateId,
    source_review_id: reviewItem.id,
    staged_at: new Date().toISOString(),
    staged_by: reviewerId,
    decision: editedPayload ? "edited" : decision,
    label_correctness: labelCorrectness || (decision === "rejected" || editedPayload ? "incorrect" : "correct"),
    reason: reason || "Staged via human review decision",
    approved: false,
    approved_by: null,
    approved_at: null,
    case: {
      id: candidateId,
      regulation_family: effectivePayload.regulation_family || "General Compliance",
      jurisdiction: effectivePayload.jurisdiction || "Global",
      regulation_text: effectivePayload.regulation_text || reviewItem.risk_summary || "Sample regulation text",
      contracts: effectivePayload.contracts || [
        {
          id: `c-sanitized-${candidateId}`,
          name: "Sanitized Enterprise Contract",
          value: Number(effectivePayload.total_exposure_usd || 100000),
          clauses: ["Contract terms sanitized for evaluation golden dataset candidate."],
        },
      ],
      expected: {
        impacted_contract_ids: effectivePayload.impacted_contracts || [`c-sanitized-${candidateId}`],
        severity: effectivePayload.severity || { [`c-sanitized-${candidateId}`]: reviewItem.severity || "high" },
        total_exposure_usd: Number(effectivePayload.total_exposure_usd || 100000),
        requires_human_review: true,
      },
    },
  };

  const data = getCandidatesData();
  const existingIdx = data.candidates.findIndex((c) => c.source_review_id === reviewItem.id);
  if (existingIdx >= 0) {
    data.candidates[existingIdx] = candidate;
  } else {
    data.candidates.push(candidate);
  }

  saveCandidatesData(data);
  return candidate;
}

/**
 * List all staged candidates
 */
export function listStagedCandidates(): StagedCandidate[] {
  return getCandidatesData().candidates;
}

/**
 * Approve a staged candidate and promote it into an authorized golden dataset (§21.4, §21.5)
 */
export async function approveCandidateFixture(
  candidateId: string,
  targetClass: "landmark" | "synthetic" | "negative" | "adversarial",
  adminUserId: string
): Promise<{ success: boolean; targetFile: string }> {
  // §21.5 Security Rule: Never automatically promote a candidate directly to hold-out
  if ((targetClass as string) === "holdout") {
    throw new Error(
      "Security Violation: Candidates cannot be promoted directly to the holdout set to prevent data contamination (§21.5)."
    );
  }

  const data = getCandidatesData();
  const candidate = data.candidates.find((c) => c.id === candidateId);
  if (!candidate) {
    throw new Error(`Candidate with ID "${candidateId}" not found`);
  }

  const targetFile = path.resolve(process.cwd(), `evals/datasets/simulation/${targetClass}.v1.json`);
  if (!fs.existsSync(targetFile)) {
    throw new Error(`Target golden dataset file not found: ${targetFile}`);
  }

  const datasetContent = JSON.parse(fs.readFileSync(targetFile, "utf-8"));
  if (!Array.isArray(datasetContent.cases)) {
    datasetContent.cases = [];
  }

  // Ensure case has proper class and tags
  const newCase = {
    ...candidate.case,
    class: targetClass,
    tags: [targetClass, "promoted-candidate", "human-approved"],
    labeled_by: `admin:${adminUserId}`,
    labeled_at: new Date().toISOString(),
  };

  const existingCaseIdx = datasetContent.cases.findIndex((c: any) => c.id === newCase.id);
  if (existingCaseIdx >= 0) {
    datasetContent.cases[existingCaseIdx] = newCase;
  } else {
    datasetContent.cases.push(newCase);
  }

  fs.writeFileSync(targetFile, JSON.stringify(datasetContent, null, 2), "utf-8");

  // Update candidate status
  candidate.approved = true;
  candidate.approved_by = adminUserId;
  candidate.approved_at = new Date().toISOString();
  candidate.promoted_to_dataset = `${targetClass}.v1.json`;
  saveCandidatesData(data);

  return { success: true, targetFile };
}
