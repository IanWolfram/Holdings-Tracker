-- Congressional trade ingestion (official-source scraper).
--
-- Replaces the pelositracker.app dependency. These tables are populated by a
-- daily ingest job (scripts/ingest-congress.ts) that downloads House Clerk PTR
-- filings and Senate eFD reports, parses each into rows, and upserts them here.
-- Requests then read by ticker. See docs/congress-official-scraper-plan.md.
--
-- Shared + portfolio-agnostic (no user_id): congressional disclosures are public
-- record, identical for every tenant. RLS gives authenticated users read-only
-- access; only the service role (which bypasses RLS) writes.

-- ── Parsed trade rows ────────────────────────────────────────────────────────
create table if not exists public.congress_trades (
  id            text primary key,          -- house-{docid}-{row} / senate-{uuid}-{row}
  source        text not null check (source in ('house', 'senate')),
  doc_id        text not null,             -- House DocID / Senate report uuid
  row_index     int  not null,
  politician    text not null,
  bioguide_id   text,                      -- from roster join, when matched
  party         text check (party in ('D', 'R', 'I')),
  chamber       text not null check (chamber in ('house', 'senate')),
  ticker        text not null,
  company_name  text,
  asset_type    text,                      -- "stock", "call option", etc.
  tx_type       text not null check (tx_type in ('buy', 'sell', 'buy_option', 'sell_option')),
  amount_range  text,                      -- "$1,001 - $15,000"
  traded_date   date,
  filed_date    date,
  comment       text,
  url           text,
  content_hash  text,                      -- dedupe / change detection
  ingested_at   timestamptz not null default now()
);

create index if not exists congress_trades_ticker_date_idx
  on public.congress_trades (ticker, traded_date desc);

create unique index if not exists congress_trades_source_doc_row_idx
  on public.congress_trades (source, doc_id, row_index);

alter table public.congress_trades enable row level security;

-- Authenticated users may read all rows. No INSERT/UPDATE/DELETE policy exists,
-- so writes are reachable only via the service role (which bypasses RLS).
create policy "authenticated read" on public.congress_trades
  for select to authenticated using (true);

comment on table public.congress_trades is
  'Parsed congressional PTR trade rows from House Clerk + Senate eFD. Public record, shared across tenants. Written by service-role ingest job; authenticated read-only.';

-- ── Ingest log (incremental dedupe) ──────────────────────────────────────────
-- Lets the daily run skip already-processed filings and records skipped scanned
-- (non-digital) PTRs so coverage gaps are visible rather than silently dropped.
create table if not exists public.congress_ingest_log (
  source       text not null check (source in ('house', 'senate')),
  doc_id       text not null,
  status       text not null,             -- 'parsed' | 'scanned' | 'error' | 'not_found'
  row_count    int,
  detail       text,
  processed_at timestamptz not null default now(),
  primary key (source, doc_id)
);

alter table public.congress_ingest_log enable row level security;

-- Service-role only: no policies. Matches the app_secrets pattern.

comment on table public.congress_ingest_log is
  'Per-filing ingest status so the daily congress job is incremental. Service role only.';
