-- Pulse: initial multi-tenant schema
-- E*TRADE per-user tokens, app-layer AES-256-GCM encrypted

-- E*TRADE per-user tokens, app-layer AES-256-GCM encrypted
create table public.etrade_tokens (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  oauth_token_ct   bytea not null,
  oauth_secret_ct  bytea not null,
  iv               bytea not null,
  auth_tag         bytea not null,
  key_version      smallint not null default 1,
  account_id_key   text,
  env              text not null default 'live',   -- 'live' | 'sandbox'
  authorized_at    timestamptz not null default now(),
  expires_at       timestamptz,                    -- next midnight ET
  updated_at       timestamptz not null default now()
);

-- short-lived OAuth request secrets (replaces cookie-based stash so it survives device switches)
create table public.etrade_request_tokens (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  request_token  text not null,
  request_secret text not null,
  expires_at     timestamptz not null
);

-- replaces .ai-config.json
create table public.user_preferences (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  ai_model_id    text not null default 'deepseek',
  vault_enabled  boolean not null default true,
  cron_opt_in    boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- vault content (migrated from filesystem world-vault/)
create table public.vault_notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  path         text not null,         -- e.g. 'PLTR.md', 'daily/2026-05-06.md'
  body         text not null,
  frontmatter  jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  unique (user_id, path)
);
create index vault_notes_user_path_idx    on public.vault_notes (user_id, path);
create index vault_notes_user_updated_idx on public.vault_notes (user_id, updated_at desc);

create table public.user_activity (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  last_seen_at    timestamptz not null default now(),
  last_refresh_at timestamptz
);

-- RLS — auth.uid() = user_id on every table
alter table public.etrade_tokens         enable row level security;
alter table public.etrade_request_tokens enable row level security;
alter table public.user_preferences      enable row level security;
alter table public.vault_notes           enable row level security;
alter table public.user_activity         enable row level security;

create policy "own row"  on public.etrade_tokens         for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own row"  on public.etrade_request_tokens for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own row"  on public.user_preferences      for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own rows" on public.vault_notes           for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "own row"  on public.user_activity         for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- Bootstrap rows on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.user_activity    (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();