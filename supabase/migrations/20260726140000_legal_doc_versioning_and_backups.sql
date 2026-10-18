-- Migration: Automated Legal Document Update, Versioning, and System Backups
-- Author: Senior Software Architect (Legal Data Integrity & Reliable Background Processing)
-- Created: 2026-10-19
-- Description: Establishes legal sources registry, version history with diff tracking, and ACID backup logs with isolated restore testing

-- 1. Create Enums if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'source_verification_status') THEN
    CREATE TYPE public.source_verification_status AS ENUM (
      'VERIFIED',
      'UNVERIFIED',
      'RATE_LIMITED',
      'OFFLINE',
      'DEGRADED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'version_status') THEN
    CREATE TYPE public.version_status AS ENUM (
      'DISCOVERED',
      'UNVERIFIED',
      'VERIFIED',
      'SUPERSEDED',
      'REJECTED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'backup_status') THEN
    CREATE TYPE public.backup_status AS ENUM (
      'COMPLETED',
      'FAILED',
      'RESTORE_VERIFIED'
    );
  END IF;
END $$;

-- 2. Legal Sources Registry Table
CREATE TABLE IF NOT EXISTS public.legal_sources (
  id VARCHAR(64) PRIMARY KEY,
  source_name VARCHAR(255) NOT NULL,
  official_url TEXT NOT NULL,
  jurisdiction VARCHAR(32) NOT NULL,
  document_category VARCHAR(64) NOT NULL,
  retrieval_method VARCHAR(64) NOT NULL DEFAULT 'HTTP_POLL',
  update_frequency VARCHAR(32) NOT NULL DEFAULT 'daily',
  last_successful_check TIMESTAMPTZ,
  last_discovered_version VARCHAR(128),
  verification_status public.source_verification_status NOT NULL DEFAULT 'VERIFIED',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Legal Document Versions (Full history, never silently overwrite)
CREATE TABLE IF NOT EXISTS public.legal_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_id VARCHAR(64) NOT NULL REFERENCES public.regulations(id) ON DELETE CASCADE,
  source_id VARCHAR(64) REFERENCES public.legal_sources(id) ON DELETE SET NULL,
  version_tag VARCHAR(128) NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  obligations JSONB NOT NULL DEFAULT '[]'::jsonb,
  content_hash VARCHAR(128) NOT NULL,
  raw_document_url TEXT,
  publication_date DATE,
  effective_date DATE,
  amendment_relationship TEXT,
  diff_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.version_status NOT NULL DEFAULT 'DISCOVERED',
  provenance_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index to prevent duplicate ingestion of identical content for a regulation
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_doc_versions_hash
  ON public.legal_document_versions (regulation_id, content_hash);

CREATE INDEX IF NOT EXISTS idx_legal_doc_versions_status
  ON public.legal_document_versions (regulation_id, status, created_at DESC);

-- 4. System Backups & Isolated Restore Verification Table
CREATE TABLE IF NOT EXISTS public.system_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  backup_type VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
  status public.backup_status NOT NULL DEFAULT 'COMPLETED',
  storage_path TEXT NOT NULL,
  manifest JSONB NOT NULL,
  sha256_checksum VARCHAR(128) NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  restore_tested_at TIMESTAMPTZ,
  restore_test_status VARCHAR(32) DEFAULT 'NOT_TESTED',
  restore_test_log TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_backups_org_status
  ON public.system_backups (org_id, status, created_at DESC);

-- 5. Seed Authoritative Government Legal Sources
INSERT INTO public.legal_sources (id, source_name, official_url, jurisdiction, document_category, retrieval_method, update_frequency, verification_status)
VALUES
  ('SRC-EUR-LEX', 'EUR-Lex Official Journal', 'https://eur-lex.europa.eu/oj/direct-access.html', 'EU', 'REGULATION', 'HTTP_POLL', 'daily', 'VERIFIED'),
  ('SRC-ECFR', 'Electronic Code of Federal Regulations (eCFR)', 'https://www.ecfr.gov/current/title-17/chapter-II/part-240/section-240.17a-4', 'US', 'REGULATION', 'REST_API', 'daily', 'VERIFIED'),
  ('SRC-BD-LAWS', 'Bangladesh Code / Laws of Bangladesh', 'http://bdlaws.minlaw.gov.bd/', 'BD', 'STATUTE', 'OFFICIAL_GAZETTE_FEED', 'weekly', 'VERIFIED'),
  ('SRC-SEC-EDGAR', 'U.S. SEC Regulatory Releases', 'https://www.sec.gov/rules/final', 'US', 'REGULATION', 'HTTP_POLL', 'daily', 'VERIFIED'),
  ('SRC-CPPA-GOV', 'California Privacy Protection Agency (CPPA)', 'https://cppa.ca.gov/regulations/', 'US', 'REGULATION', 'HTTP_POLL', 'weekly', 'VERIFIED'),
  ('SRC-BB-CIRCULARS', 'Bangladesh Bank Regulations & Circulars', 'https://www.bb.org.bd/en/index.php/mediaroom/circular', 'BD', 'CIRCULAR', 'OFFICIAL_GAZETTE_FEED', 'daily', 'VERIFIED')
ON CONFLICT (id) DO UPDATE SET
  official_url = EXCLUDED.official_url,
  source_name = EXCLUDED.source_name,
  jurisdiction = EXCLUDED.jurisdiction,
  document_category = EXCLUDED.document_category,
  updated_at = NOW();
