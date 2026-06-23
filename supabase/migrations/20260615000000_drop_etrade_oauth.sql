-- Remove E*TRADE OAuth storage.
--
-- Brokerage linking is now handled entirely through SnapTrade. The E*TRADE
-- OAuth 1.0a flow (per-user encrypted access tokens + short-lived request
-- token secrets) and its tables are removed. Dropping the tables also drops
-- their RLS policies.
drop table if exists public.etrade_request_tokens cascade;
drop table if exists public.etrade_tokens cascade;
