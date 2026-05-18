-- System service account for vault writes when no user session exists (CLI/cron).
-- This UUID must match SYSTEM_USER_ID in lib/constants.ts.
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'system@pulse-vault.internal',
  '',  -- no password; login via service role only
  now(),
  now(),
  now(),
  '',
  '',
  '',
  ''
) on conflict (id) do nothing;