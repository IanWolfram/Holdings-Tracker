-- Agent chat conversations per user — persists across devices
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'New chat',
  updated_at  timestamptz not null default now()
);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index conversations_user_idx on public.conversations (user_id, updated_at desc);
create index messages_conv_idx on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "own rows" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on public.messages
  for all using (auth.uid() in (select user_id from public.conversations where id = conversation_id))
  with check (auth.uid() in (select user_id from public.conversations where id = conversation_id));