
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_org_deletion_scheduled_at
  ON public.organizations(deletion_scheduled_at)
  WHERE deletion_scheduled_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.request_workspace_deletion(_org uuid, _by uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_when timestamptz;
BEGIN
  IF NOT public.has_role(_by, _org, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: only admins can delete a workspace';
  END IF;
  v_when := now() + interval '30 days';
  UPDATE public.organizations
    SET deletion_scheduled_at = v_when,
        deletion_requested_by = _by
    WHERE id = _org;
  RETURN v_when;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_workspace_deletion(_org uuid, _by uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(_by, _org, 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: only admins can cancel deletion';
  END IF;
  UPDATE public.organizations
    SET deletion_scheduled_at = NULL,
        deletion_requested_by = NULL
    WHERE id = _org;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_workspace_deletion(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_workspace_deletion(uuid, uuid) TO authenticated;
