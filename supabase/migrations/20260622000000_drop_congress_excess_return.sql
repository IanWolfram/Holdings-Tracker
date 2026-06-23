-- Excess-return was removed from the congress card (replaced by a "days to
-- disclose" figure derived from the existing trade/filed dates). It was never
-- populated in practice (the nightly precompute didn't run) and the read/cron
-- code paths have been deleted. Drop the dead column + its bulk-update RPC.
drop function if exists public.update_congress_excess_returns(jsonb);

alter table public.congress_trades
  drop column if exists excess_return;
