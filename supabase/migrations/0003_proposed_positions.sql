-- Proposed positions (watchlist) per user — persists across devices
create table public.proposed_positions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  ticker        text not null,
  target_shares integer,
  target_price  numeric(12,4),
  added_at      timestamptz not null default now(),
  unique (user_id, ticker)
);

create index proposed_positions_user_idx on public.proposed_positions (user_id);

alter table public.proposed_positions enable row level security;

create policy "own rows" on public.proposed_positions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);