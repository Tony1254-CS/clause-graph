-- 0001_auth_uid_no_fallback.sql
-- S-7: auth.uid() returns NULL when request.jwt.claim.sub is missing or empty
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;
