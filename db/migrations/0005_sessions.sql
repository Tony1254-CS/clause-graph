-- 0005_sessions.sql: Server-side revocable sessions table for HttpOnly cookie session management
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  ip_address text,
  user_agent text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_token_hash_idx 
  ON public.sessions (token_hash) 
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS sessions_user_id_idx 
  ON public.sessions (user_id);

CREATE INDEX IF NOT EXISTS sessions_org_id_idx 
  ON public.sessions (org_id);

-- Enable RLS on sessions for defense in depth
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sessions' AND policyname = 'sessions_org_isolation'
  ) THEN
    CREATE POLICY sessions_org_isolation ON public.sessions
      FOR ALL
      TO clausegraph_app
      USING (org_id = NULLIF(current_setting('app.org_id', true), '')::uuid);
  END IF;
END $$;

-- Grant permissions to clausegraph_app and superuser
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO clausegraph_app;
GRANT ALL ON public.sessions TO postgres;
