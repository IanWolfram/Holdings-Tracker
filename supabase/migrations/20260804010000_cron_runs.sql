-- Durable last-ran-at stamps for the background crons.
--
-- node-cron only fires while the worker process is alive; a run whose tick
-- passes while pulse-worker is down is simply skipped. Daily jobs self-heal on
-- the next day's tick, but the MONTHLY recalibration would then wait a full
-- month. This table records when each cron last completed so register() can
-- detect a missed monthly run at boot and catch up once.

create table if not exists public.cron_runs (
  job_name    text primary key,
  last_ran_at timestamptz not null default now()
);

alter table public.cron_runs enable row level security;
-- No policies: only the service role (which bypasses RLS) reads/writes this.
