-- Agent feature work (2026-07-28):
--   1. Per-user Telegram delivery (multi-tenant): each user links their own chat.
--   2. Retire the decorative `earnings_watch` / `concentration_risk` job kinds
--      that only ever ran the generic sweep.

-- ── 1. Per-user Telegram link ───────────────────────────────────────────────
alter table public.user_preferences
  add column if not exists telegram_chat_id   text,
  add column if not exists telegram_link_code text;

-- The one-time link code must be unique so the webhook can resolve it to a user.
create unique index if not exists user_preferences_telegram_link_code_idx
  on public.user_preferences (telegram_link_code)
  where telegram_link_code is not null;

-- ── 2. Retire unused agent job kinds ────────────────────────────────────────
-- Drop rows for the removed kinds first so the tightened CHECK can be applied.
delete from public.agent_jobs
  where kind in ('earnings_watch', 'concentration_risk');

alter table public.agent_jobs
  drop constraint if exists agent_jobs_kind_check;

alter table public.agent_jobs
  add constraint agent_jobs_kind_check
  check (kind in ('morning_digest', 'congress', 'story_backlog'));
