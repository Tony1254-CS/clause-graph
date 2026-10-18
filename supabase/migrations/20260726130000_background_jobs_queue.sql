-- Migration: Background Jobs Queue & Worker System
-- Author: Senior Backend Architect
-- Created: 2026-10-19
-- Description: ACID-compliant job queue with SKIP LOCKED concurrency, idempotency keys, progress tracking, and failure categorization

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE public.job_status AS ENUM (
      'QUEUED',
      'RUNNING',
      'RETRYING',
      'COMPLETED',
      'FAILED',
      'CANCELLED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_priority') THEN
    CREATE TYPE public.job_priority AS ENUM (
      'low',
      'normal',
      'high',
      'critical'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  job_type VARCHAR(64) NOT NULL,
  status public.job_status NOT NULL DEFAULT 'QUEUED',
  priority public.job_priority NOT NULL DEFAULT 'normal',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  progress_stage VARCHAR(128),
  error_message TEXT,
  error_stack TEXT,
  error_code VARCHAR(64),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  idempotency_key VARCHAR(128),
  locked_by VARCHAR(64),
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial unique index to enforce idempotency for active/queued tasks
CREATE UNIQUE INDEX IF NOT EXISTS idx_background_jobs_idempotency
  ON public.background_jobs (org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status IN ('QUEUED', 'RUNNING', 'RETRYING');

-- Performance indexes for worker lock acquisition and user listing
CREATE INDEX IF NOT EXISTS idx_background_jobs_queue_pickup
  ON public.background_jobs (status, next_run_at, priority DESC, created_at ASC)
  WHERE status IN ('QUEUED', 'RETRYING');

CREATE INDEX IF NOT EXISTS idx_background_jobs_org_listing
  ON public.background_jobs (org_id, status, created_at DESC);

-- Enable RLS
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY background_jobs_org_read ON public.background_jobs
  FOR SELECT
  USING (org_id IN (
    SELECT org_id FROM public.profiles WHERE id = auth.uid()
  ));

CREATE POLICY background_jobs_org_insert ON public.background_jobs
  FOR INSERT
  WITH CHECK (org_id IN (
    SELECT org_id FROM public.profiles WHERE id = auth.uid()
  ));
