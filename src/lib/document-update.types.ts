/**
 * Canonical Types for Automated Legal Document Update, Versioning, and Backup System
 */

export type SourceVerificationStatus =
  | "VERIFIED"
  | "UNVERIFIED"
  | "RATE_LIMITED"
  | "OFFLINE"
  | "DEGRADED";

export type RetrievalMethod = "HTTP_POLL" | "OFFICIAL_GAZETTE_FEED" | "REST_API";

export type UpdateFrequency = "hourly" | "daily" | "weekly" | "monthly";

export interface LegalSourceRecord {
  id: string;
  source_name: string;
  official_url: string;
  jurisdiction: string; // 'EU', 'US', 'BD', 'GLOBAL'
  document_category: string; // 'STATUTE', 'REGULATION', 'CIRCULAR', 'JUDICIAL_ORDER'
  retrieval_method: RetrievalMethod;
  update_frequency: UpdateFrequency;
  last_successful_check?: string | null;
  last_discovered_version?: string | null;
  verification_status: SourceVerificationStatus;
  consecutive_failures: number;
  last_error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export type LegalDocVersionStatus =
  | "DISCOVERED"
  | "UNVERIFIED"
  | "VERIFIED"
  | "SUPERSEDED"
  | "REJECTED";

export interface VersionDiffSummary {
  addedObligations: string[];
  removedObligations: string[];
  summaryChanges: string;
  effectiveDate?: string;
  amendmentDirection?: "tightened" | "loosened" | "expanded" | "clarified";
  citationStatusChange?: string;
}

export interface LegalDocVersionRecord {
  id: string;
  regulation_id: string; // references public.regulations(id)
  source_id?: string | null; // references public.legal_sources(id)
  version_tag: string; // e.g. "2026-v1.1", "EDPB-2026-Guideline"
  title: string;
  summary: string;
  obligations: string[];
  content_hash: string; // SHA-256
  raw_document_url?: string | null;
  publication_date?: string | null;
  effective_date?: string | null;
  amendment_relationship?: string | null; // e.g. "Amends Art 5(1)(c) data minimization"
  diff_summary: VersionDiffSummary;
  status: LegalDocVersionStatus;
  provenance_evidence: {
    retrievedAt: string;
    sourceUrl: string;
    httpStatus: number;
    sha256: string;
    contentLength: number;
    headers?: Record<string, string>;
  };
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at: string;
}

export type BackupStatus = "COMPLETED" | "FAILED" | "RESTORE_VERIFIED";

export interface BackupManifest {
  manifestVersion: string;
  timestamp: string;
  recordCounts: {
    regulations: number;
    amendments: number;
    contracts: number;
    clauses: number;
    sources: number;
    versions: number;
  };
  checksums: Record<string, string>; // table -> SHA-256
  encryption: "AES-256-GCM" | "NONE";
  storageLocation: string;
}

export interface SystemBackupRecord {
  id: string;
  org_id: string;
  backup_type: "MANUAL" | "SCHEDULED";
  status: BackupStatus;
  storage_path: string;
  manifest: BackupManifest;
  sha256_checksum: string;
  file_size_bytes: number;
  restore_tested_at?: string | null;
  restore_test_status?: "SUCCESS" | "FAILED" | "NOT_TESTED";
  restore_test_log?: string | null;
  created_by?: string | null;
  created_at: string;
}

export interface DiscoveredCandidateUpdate {
  sourceId: string;
  regulationId: string;
  versionTag: string;
  title: string;
  summary: string;
  obligations: string[];
  rawContent: string;
  publicationDate: string;
  effectiveDate: string;
  amendmentRelationship: string;
  amendmentDirection?: "tightened" | "loosened" | "expanded" | "clarified";
  officialUrl: string;
}

export interface RestoreVerificationResult {
  ok: boolean;
  backupId: string;
  testedAt: string;
  checksumMatches: boolean;
  recordsVerified: {
    regulations: number;
    amendments: number;
    contracts: number;
    clauses: number;
  };
  latencyMs: number;
  error?: string;
}
