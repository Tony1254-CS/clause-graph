/**
 * TanStack Start Server Functions for Legal Sources, Versions, and Backups
 */

import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "./auth-middleware";
import type { LegalDocVersionStatus } from "./document-update.types";

export const getLegalSourcesFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { listLegalSources } = await import("./document-update.server");
    return await listLegalSources();
  });

export const getCandidateVersionsFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((data?: { regulationId?: string; status?: LegalDocVersionStatus }) => data)
  .handler(async ({ data }) => {
    const { listLegalDocVersions } = await import("./document-update.server");
    return await listLegalDocVersions(data?.regulationId, data?.status);
  });

export const triggerSourceCheckFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: { sourceId: string }) => data)
  .handler(async ({ data, context }) => {
    const { enqueueJob } = await import("./jobs.server");
    const job = await enqueueJob({
      orgId: context.orgId,
      jobType: "LEGAL_SOURCE_CHECK",
      payload: { sourceId: data.sourceId },
      createdBy: context.userId,
      priority: "high",
    });

    return { jobId: job.id, status: job.status };
  });

export const approveCandidateVersionFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: { versionId: string; reviewNotes: string }) => data)
  .handler(async ({ data, context }) => {
    const { approveDocumentVersion } = await import("./document-update.server");
    return await approveDocumentVersion(data.versionId, context.userId, data.reviewNotes);
  });

export const rejectCandidateVersionFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: { versionId: string; rejectionReason: string }) => data)
  .handler(async ({ data, context }) => {
    const { rejectDocumentVersion } = await import("./document-update.server");
    await rejectDocumentVersion(data.versionId, context.userId, data.rejectionReason);
    return { success: true };
  });

export const getBackupsListFn = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { listSystemBackups } = await import("./document-update.server");
    return await listSystemBackups(context.orgId);
  });

export const triggerBackupRunFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data?: { runRestoreTest?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { enqueueJob } = await import("./jobs.server");
    const job = await enqueueJob({
      orgId: context.orgId,
      jobType: "SYSTEM_BACKUP_RUN",
      payload: {
        orgId: context.orgId,
        runRestoreTest: data?.runRestoreTest ?? true,
        createdBy: context.userId,
      },
      createdBy: context.userId,
      priority: "high",
    });

    return { jobId: job.id, status: job.status };
  });

export const runRestoreTestFn = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: { backupId: string }) => data)
  .handler(async ({ data }) => {
    const { runIsolatedRestoreTest } = await import("./document-update.server");
    return await runIsolatedRestoreTest(data.backupId);
  });
