-- Precomputed excess-return (trade return − SPY return since the trade date),
-- in percentage points (e.g. 4.2 == "+4.2%"). NULL == N/A (bars missing / out of
-- window). Filled by the daily congress cron (refreshCongressExcessReturns), NOT
-- at read time — the read path must never trigger rate-limited Polygon fetches.
alter table public.congress_trades
  add column if not exists excess_return double precision;

comment on column public.congress_trades.excess_return is
  'Excess return vs SPY since traded_date, in percentage points. Refreshed daily by the congress cron; NULL = N/A.';
