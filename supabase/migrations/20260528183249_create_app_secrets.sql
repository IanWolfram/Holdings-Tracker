CREATE TABLE IF NOT EXISTS public.app_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

-- No policies = no access for any role except the service role, which bypasses RLS.
-- This ensures only server-side code with the service role key can read or write secrets.

COMMENT ON TABLE public.app_secrets IS 'Centralized secret store. Read at server boot by lib/secrets.ts:hydrateSecrets(). Service role only.';
