-- Agent scheduler: per-user scheduled jobs, stock watches, and notifications.
--
-- NOTE: This file was reconstructed from the live database on 2026-06-03.
-- The original migration was applied to the remote (version 0007) but its SQL
-- body was never stored in supabase_migrations.schema_migrations (empty record)
-- and the file was never committed. The DDL below was introspected from the
-- production catalog so a fresh `supabase db reset` reproduces the live schema.

-- ── Scheduled agent jobs ────────────────────────────────────────────────────
create table if not exists public.agent_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in (
                 'morning_digest', 'earnings_watch', 'concentration_risk',
                 'congress', 'story_backlog')),
  cron_expr    text not null,
  enabled      boolean not null default false,
  config       jsonb not null default '{}'::jsonb,
  last_run_at  timestamptz,
  next_run_at  timestamptz,
  last_status  text,
  last_summary text,
  claimed_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, kind)
);

create index if not exists agent_jobs_due_idx
  on public.agent_jobs (enabled, next_run_at);

alter table public.agent_jobs enable row level security;

create policy "own rows" on public.agent_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Stock watches (alert rules) ─────────────────────────────────────────────
create table if not exists public.stock_watches (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  symbol            text not null,
  rule              jsonb not null,
  enabled           boolean not null default true,
  cooldown_minutes  integer not null default 240,
  last_triggered_at timestamptz,
  last_trigger_hash text,
  last_seen_value   jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists stock_watches_user_idx
  on public.stock_watches (user_id, enabled);

alter table public.stock_watches enable row level security;

create policy "own rows" on public.stock_watches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Notifications ───────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  ticker     text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

create policy "own rows" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
