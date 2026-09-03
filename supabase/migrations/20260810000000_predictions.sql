-- Predictions as first-class rows (was: JSON blobs in vault_notes).
--
-- The calibration loop trains on this data forever, so relational storage buys:
-- single-INSERT appends (no read-modify-write of a whole file), UPDATE-by-status
-- resolution, SQL aggregates for calibration, and no full-scan N+1 to list a
-- user's predictions. RLS mirrors vault_notes so request paths carrying the
-- caller's JWT are DB-enforced; the worker/cron use the service role.
--
-- id is unique per user (e.g. "HOOD-1d-1778786778697"), so PK is (user_id, id).

create table if not exists public.predictions (
  user_id             uuid        not null references auth.users(id) on delete cascade,
  id                  text        not null,
  ticker              text        not null,
  horizon_days        integer     not null,
  run_at              bigint      not null,
  status              text        not null,
  direction           text        not null,
  magnitude_pct       double precision not null,
  confidence          double precision not null,
  raw_confidence      double precision,
  reasoning           text        not null default '',
  engine              text        not null default 'unknown',
  version             text,
  shadow              boolean      not null default false,
  source_url          text,
  synthetic           boolean,
  price_at_prediction double precision not null,
  resolved_at         bigint,
  price_at_resolution double precision,
  actual_pct          double precision,
  outcome             text,
  flat_band_pct       double precision,
  catalysts           jsonb        not null default '[]'::jsonb,
  catalyst_types      jsonb,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now(),
  primary key (user_id, id)
);

-- Hot lookups: per-ticker-per-horizon load, status scans (resolution), and the
-- non-shadow filter the calibration/metrics readers apply.
create index if not exists predictions_user_ticker_horizon_idx
  on public.predictions (user_id, ticker, horizon_days);
create index if not exists predictions_user_status_idx
  on public.predictions (user_id, status);
create index if not exists predictions_user_shadow_idx
  on public.predictions (user_id, shadow);

alter table public.predictions enable row level security;

-- Same policy shape as vault_notes: a user owns their rows; the service role
-- (worker/cron) bypasses RLS.
create policy "own rows" on public.predictions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
