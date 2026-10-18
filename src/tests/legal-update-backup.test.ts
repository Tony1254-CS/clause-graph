import assert from "node:assert/strict";
import test from "node:test";
import crypto from "crypto";
import fs from "fs";
import { query, queryOne } from "../lib/db.server";
import {
  computeDocumentHash,
  computeVersionDiff,
  ingestCandidateUpdate,
  approveDocumentVersion,
  rejectDocumentVersion,
  executeLegalSourceCheck,
  createSystemBackup,
  runIsolatedRestoreTest,
  listLegalSources,
  listLegalDocVersions,
} from "../lib/document-update.server";
import { processJob } from "../lib/jobs.worker";
import type { JobRecord } from "../lib/jobs.types";

async function getTestOrgAndUser() {
  const org = await queryOne<{ id: string }>(
    `SELECT id FROM public.organizations LIMIT 1`
  );
  assert.ok(org, "Test organization must exist");

  const user = await queryOne<{ id: string }>(
    `SELECT id FROM auth.users LIMIT 1`
  );
  assert.ok(user, "Test user must exist");

  return { orgId: org.id, userId: user.id };
}

test("Legal Sources & Backups: Lists configured authoritative legal sources", async () => {
  const sources = await listLegalSources();
  assert.ok(sources.length >= 4, "Must contain configured legal sources");

  const eurLex = sources.find((s) => s.id === "SRC-EUR-LEX");
  assert.ok(eurLex, "EUR-Lex source must exist");
  assert.equal(eurLex.jurisdiction, "EU");
  assert.equal(eurLex.retrieval_method, "HTTP_POLL");

  const ecfr = sources.find((s) => s.id === "SRC-ECFR");
  assert.ok(ecfr, "eCFR source must exist");
  assert.equal(ecfr.jurisdiction, "US");
});

test("Legal Sources & Backups: Computes document content hash and structured diff", () => {
  const hash1 = computeDocumentHash("Summary content A", ["data_minimization", "accuracy"]);
  const hash2 = computeDocumentHash("Summary content A", ["accuracy", "data_minimization"]);
  assert.equal(hash1, hash2, "Content hashing must be order-independent for obligations");

  const hash3 = computeDocumentHash("Summary content B", ["data_minimization"]);
  assert.notEqual(hash1, hash3, "Different content must produce different hash");

  const diff = computeVersionDiff(
    { summary: "Old summary", obligations: ["data_minimization"] },
    { summary: "New expanded summary", obligations: ["data_minimization", "ai_risk_assessment"], amendmentDirection: "tightened" }
  );
  assert.deepEqual(diff.addedObligations, ["ai_risk_assessment"]);
  assert.deepEqual(diff.removedObligations, []);
  assert.equal(diff.amendmentDirection, "tightened");
});

test("Legal Sources & Backups: Ingestion of candidate version preserves current law and prevents duplicates", async () => {
  const candidate = {
    sourceId: "SRC-EUR-LEX",
    regulationId: "REG-GDPR-5",
    versionTag: "2026-Test-Guideline-v1",
    title: "GDPR Article 5 — EDPB Automated Processing Guidance 2026",
    summary: "Personal data processed for automated decision-making must adhere to strict contextual minimization.",
    obligations: ["data_minimization", "purpose_limitation", "contextual_minimization"],
    rawContent: "Official Gazette text for EDPB 2026 guidance on Art 5...",
    publicationDate: "2026-05-10",
    effectiveDate: "2026-06-01",
    amendmentRelationship: "EDPB Guidelines 02/2026 clarifying contextual minimization",
    amendmentDirection: "tightened" as const,
    officialUrl: "https://eur-lex.europa.eu/oj/direct-access.html",
  };

  // 1. Initial Ingestion
  const ingestResult = await ingestCandidateUpdate(candidate, {
    sourceUrl: candidate.officialUrl,
    httpStatus: 200,
    rawPayloadSize: 2048,
  });

  assert.ok(ingestResult.versionId, "Must return candidate version ID");
  assert.equal(ingestResult.isDuplicate, false, "First ingestion is not a duplicate");
  assert.equal(ingestResult.status, "DISCOVERED");

  // Verify that active regulation in public.regulations was NOT modified
  const currentReg = await queryOne<{ title: string; summary: string }>(
    `SELECT title, summary FROM public.regulations WHERE id = 'REG-GDPR-5'`
  );
  assert.ok(currentReg);
  assert.equal(currentReg.title.includes("2026-Test"), false, "Active regulation must never be silently overwritten");

  // 2. Duplicate Ingestion check
  const duplicateResult = await ingestCandidateUpdate(candidate, {
    sourceUrl: candidate.officialUrl,
    httpStatus: 200,
    rawPayloadSize: 2048,
  });
  assert.equal(duplicateResult.isDuplicate, true, "Duplicate hash must be rejected idempotently");
  assert.equal(duplicateResult.versionId, ingestResult.versionId);
});

test("Legal Sources & Backups: Outage or rate limit does not repeal law or corrupt corpus", async () => {
  const outageResult = await executeLegalSourceCheck("SRC-EUR-LEX", {
    simulateOutage: true,
  });
  assert.equal(outageResult.success, false);
  assert.equal(outageResult.httpStatus, 503);

  // Check source status was updated to OFFLINE
  const sourceAfter = await queryOne<{ verification_status: string }>(
    `SELECT verification_status FROM public.legal_sources WHERE id = 'SRC-EUR-LEX'`
  );
  assert.equal(sourceAfter?.verification_status, "OFFLINE");

  // Check underlying regulation REG-GDPR-5 is still intact and in force
  const reg = await queryOne<{ id: string }>(
    `SELECT id FROM public.regulations WHERE id = 'REG-GDPR-5'`
  );
  assert.ok(reg, "Regulation must NEVER be deleted or repealed due to source check outage");

  // Re-verify clean status
  await executeLegalSourceCheck("SRC-EUR-LEX", {});
});

test("Legal Sources & Backups: Human Approval promotes candidate to VERIFIED and updates active regulation", async () => {
  const { userId } = await getTestOrgAndUser();

  // Find candidate version created in previous test
  const versions = await listLegalDocVersions("REG-GDPR-5", "DISCOVERED");
  const testCandidate = versions.find((v) => v.version_tag === "2026-Test-Guideline-v1");
  assert.ok(testCandidate, "Candidate version must be present in queue");

  // Approve
  const approvalRes = await approveDocumentVersion(
    testCandidate.id,
    userId,
    "Approved following legal counsel review of EDPB 2026 guidance"
  );
  assert.equal(approvalRes.success, true);
  assert.equal(approvalRes.regulationId, "REG-GDPR-5");

  // Verify version status is now VERIFIED
  const updatedVersion = await queryOne<{ status: string; review_notes: string }>(
    `SELECT status, review_notes FROM public.legal_document_versions WHERE id = $1::uuid`,
    [testCandidate.id]
  );
  assert.equal(updatedVersion?.status, "VERIFIED");
  assert.equal(updatedVersion?.review_notes.includes("Approved following legal counsel"), true);

  // Verify public.regulations was atomically updated with the new title & obligations
  const activeReg = await queryOne<{ title: string; summary: string; obligations: any }>(
    `SELECT title, summary, obligations FROM public.regulations WHERE id = 'REG-GDPR-5'`
  );
  assert.equal(activeReg?.title, testCandidate.title);
  assert.equal(activeReg?.summary, testCandidate.summary);

  // Clean up: Reset baseline for REG-GDPR-5
  await query(
    `UPDATE public.regulations
     SET title = 'GDPR Article 5 — Principles / Data Minimization',
         summary = 'Personal data must be adequate, relevant, and limited to what is necessary for the purpose it was collected for. Controllers must be able to demonstrate compliance with the principles of lawfulness, purpose limitation, accuracy, storage limitation, and integrity.',
         obligations = '["data_minimization","purpose_limitation","storage_limitation","accountability","accuracy"]'::jsonb
     WHERE id = 'REG-GDPR-5'`
  );
  await query(
    `DELETE FROM public.legal_document_versions WHERE id = $1::uuid`,
    [testCandidate.id]
  );
  await query(
    `DELETE FROM public.regulation_amendments WHERE regulation_id = 'REG-GDPR-5' AND summary LIKE '%EDPB Guidelines 02/2026%'`
  );
});

test("Legal Sources & Backups: Generates ACID backup with SHA-256 manifest and executes isolated restore test", async () => {
  const { orgId, userId } = await getTestOrgAndUser();

  // 1. Create System Backup
  const backup = await createSystemBackup(orgId, "MANUAL", userId);
  assert.ok(backup.id, "Backup record must be created");
  assert.equal(backup.status, "COMPLETED");
  assert.ok(backup.file_size_bytes > 0, "Backup file size must be non-zero");
  assert.ok(fs.existsSync(backup.storage_path), "Backup file must exist on disk");

  // Check manifest structure
  const manifest = backup.manifest;
  assert.equal(manifest.manifestVersion, "2.0.0");
  assert.ok(manifest.recordCounts.regulations > 0);
  assert.ok(manifest.recordCounts.amendments >= 0);
  assert.ok(manifest.checksums.regulations.length === 64);

  // 2. Run Isolated Restore Test
  const restoreRes = await runIsolatedRestoreTest(backup.id);
  assert.equal(restoreRes.ok, true, "Isolated restore test must succeed");
  assert.equal(restoreRes.checksumMatches, true, "SHA-256 must match manifest");
  assert.equal(restoreRes.recordsVerified.regulations, manifest.recordCounts.regulations);
  assert.ok(restoreRes.latencyMs >= 0);

  // 3. Verify backup status was updated to RESTORE_VERIFIED
  const backupInDb = await queryOne<{ status: string; restore_test_status: string }>(
    `SELECT status, restore_test_status FROM public.system_backups WHERE id = $1::uuid`,
    [backup.id]
  );
  assert.equal(backupInDb?.status, "RESTORE_VERIFIED");
  assert.equal(backupInDb?.restore_test_status, "SUCCESS");

  // Clean up backup file
  if (fs.existsSync(backup.storage_path)) {
    fs.unlinkSync(backup.storage_path);
  }
});

test("Legal Sources & Backups: Background Worker processes LEGAL_SOURCE_CHECK and SYSTEM_BACKUP_RUN", async () => {
  const { orgId, userId } = await getTestOrgAndUser();

  // 1. Test worker handling of LEGAL_SOURCE_CHECK
  const sourceCheckJob: JobRecord = {
    id: crypto.randomUUID(),
    org_id: orgId,
    created_by: userId,
    job_type: "LEGAL_SOURCE_CHECK",
    status: "RUNNING",
    priority: "normal",
    payload: { sourceId: "SRC-ECFR" },
    progress: 0,
    retry_count: 0,
    max_retries: 3,
    created_at: new Date().toISOString(),
    next_run_at: new Date().toISOString(),
  };

  // We should be able to process the job without throwing
  let sourceJobFailed = false;
  try {
    await processJob(sourceCheckJob);
  } catch {
    sourceJobFailed = true;
  }
  assert.equal(sourceJobFailed, false, "Worker must process LEGAL_SOURCE_CHECK successfully");

  // 2. Test worker handling of SYSTEM_BACKUP_RUN
  const backupJob: JobRecord = {
    id: crypto.randomUUID(),
    org_id: orgId,
    created_by: userId,
    job_type: "SYSTEM_BACKUP_RUN",
    status: "RUNNING",
    priority: "high",
    payload: { orgId, runRestoreTest: true, createdBy: userId },
    progress: 0,
    retry_count: 0,
    max_retries: 3,
    created_at: new Date().toISOString(),
    next_run_at: new Date().toISOString(),
  };

  let backupJobFailed = false;
  try {
    await processJob(backupJob);
  } catch {
    backupJobFailed = true;
  }
  assert.equal(backupJobFailed, false, "Worker must process SYSTEM_BACKUP_RUN with isolated restore successfully");
});
