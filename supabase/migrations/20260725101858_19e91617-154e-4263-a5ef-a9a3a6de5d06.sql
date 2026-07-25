
-- 1. Contracts table extension
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS extraction_error text;
CREATE INDEX IF NOT EXISTS contracts_org_created_idx ON public.contracts (org_id, created_at DESC);

-- 2. Storage RLS on `contract-files` bucket. Path convention: `<org_id>/<uuid>.<ext>`.
--    We reuse `public.current_org_id()` (SECURITY DEFINER) which returns the caller's org.

DROP POLICY IF EXISTS "contract-files: org can read own" ON storage.objects;
DROP POLICY IF EXISTS "contract-files: org can insert own" ON storage.objects;
DROP POLICY IF EXISTS "contract-files: org can update own" ON storage.objects;
DROP POLICY IF EXISTS "contract-files: org can delete own" ON storage.objects;

CREATE POLICY "contract-files: org can read own"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'contract-files'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
);

CREATE POLICY "contract-files: org can insert own"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'contract-files'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
);

CREATE POLICY "contract-files: org can update own"
ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'contract-files'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
)
WITH CHECK (
  bucket_id = 'contract-files'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
);

CREATE POLICY "contract-files: org can delete own"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'contract-files'
  AND (storage.foldername(name))[1] = public.current_org_id()::text
);
