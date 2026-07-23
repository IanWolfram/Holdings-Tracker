-- Automatic story analysis: the story_backlog agent job becomes on-by-default
-- for every user (the TopBar manual "brain button" is removed; the headless
-- worker now analyzes new stories in the background, with a faster cadence for
-- recently-active users — see lib/agent/job-runner.ts).

-- Backfill: enabled story_backlog job for every existing user. `do nothing` on
-- conflict so a row a user already toggled (either way) is left untouched.
insert into public.agent_jobs (user_id, kind, cron_expr, enabled, next_run_at)
select id, 'story_backlog', '*/15 * * * *', true, now()
from auth.users
where id <> '00000000-0000-0000-0000-000000000000'  -- system vault user has no portfolio
on conflict (user_id, kind) do nothing;

-- New signups get the job automatically. Body extends the 0002_app_roles.sql
-- version (user_preferences + user_activity + app_roles) with the agent job.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_preferences (user_id) values (new.id);
  insert into public.user_activity    (user_id) values (new.id);
  insert into public.app_roles        (user_id, role) values (new.id, 'user');
  insert into public.agent_jobs       (user_id, kind, cron_expr, enabled, next_run_at)
    values (new.id, 'story_backlog', '*/15 * * * *', true, now());
  return new;
end $$;
