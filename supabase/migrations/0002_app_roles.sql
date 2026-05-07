-- App-level role system for Pulse
create table if not exists public.app_roles (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  role     text not null default 'user',  -- 'admin' | 'user'
  updated_at timestamptz not null default now()
);

alter table public.app_roles enable row level security;

-- Users can read their own role
create policy "read own role" on public.app_roles
  for select using (auth.uid() = user_id);

-- Only service role can write roles (admin assignment is server-side)
create policy "service write" on public.app_roles
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- Helper to check if a user is admin
create or replace function public.is_admin(check_uid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (select 1 from app_roles where user_id = check_uid and role = 'admin');
$$;

-- Update handle_new_user trigger to also seed app_roles
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.user_activity    (user_id) values (new.id);
  insert into public.app_roles        (user_id, role) values (new.id, 'user');
  return new;
end $$;

-- Seed initial admins
insert into public.app_roles (user_id, role) values
  ('dadae72f-02da-47f8-ab60-329b1b6f1f5d', 'admin'),
  ('68e792a4-5845-48d8-8142-3ceedb1074e3', 'admin')
on conflict (user_id) do update set role = 'admin';