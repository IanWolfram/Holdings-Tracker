-- Cross-process mutual exclusion for per-user agent sweeps.
--
-- The in-memory "already in progress" guard in lib/agent/progress.ts only
-- covers one process, but manual sweeps run in the Next.js UI process while
-- scheduled sweeps (story_backlog / morning_digest) run in pulse-worker.
-- Without a shared lock the same user's sweep can run twice concurrently,
-- doubling LLM spend and racing on read-modify-write prediction files.
--
-- user_id is text (not uuid) so the CLI/system sweep ("__system") can lock too.
-- Claiming is a conditional UPDATE (claimed_at null or stale) — Postgres row
-- locking serializes concurrent claimers; the loser's WHERE re-evaluates and
-- matches zero rows. claimed_by holds a per-run token so release/heartbeat can
-- never touch a lock that was legitimately reclaimed after going stale.

create table if not exists public.sweep_locks (
  user_id    text primary key,
  claimed_at timestamptz,
  claimed_by text,
  updated_at timestamptz not null default now()
);

alter table public.sweep_locks enable row level security;
-- No policies: only the service role (which bypasses RLS) touches this table.
