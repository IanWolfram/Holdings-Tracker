/**
 * Shared types for the official-source congressional trade ingester.
 *
 * `CongressTradeRow` is the **database shape** (snake_case, one row per parsed
 * transaction) written to `public.congress_trades`. It is deliberately distinct
 * from the UI-facing `CongressTrade` (camelCase, unix timestamps) in
 * `types/news.types.ts` — the Phase 5 seam (`lib/congress/index.ts`) maps DB
 * rows → `CongressTrade` at read time. See docs/congress-official-scraper-plan.md.
 */

export type CongressSource = "house" | "senate";
export type Party = "D" | "R" | "I";
export type TxType = "buy" | "sell" | "buy_option" | "sell_option";

/** A single parsed transaction, matching the `congress_trades` columns. */
export interface CongressTradeRow {
  id: string; // `${source}-${doc_id}-${row_index}`
  source: CongressSource;
  doc_id: string;
  row_index: number;
  politician: string;
  bioguide_id: string | null; // filled by the roster join (Phase 4)
  party: Party | null; // filled by the roster join (Phase 4)
  chamber: CongressSource; // chamber === source for these two sources
  ticker: string;
  company_name: string | null;
  asset_type: string | null; // raw House code ("ST"/"OP"/…) or Senate asset-type word
  tx_type: TxType;
  amount_range: string | null;
  traded_date: string | null; // ISO YYYY-MM-DD
  filed_date: string | null; // ISO YYYY-MM-DD
  comment: string | null;
  url: string;
  content_hash: string; // change-detection only — NOT a dedupe key (legit dup trades exist)
  ingested_at?: string | null; // timestamptz, DB-default now(); present on reads, omitted by writers
}

/** Outcome of fetching+parsing one filing, recorded in `congress_ingest_log`. */
export type IngestStatus = "parsed" | "scanned" | "not_found" | "error";

export interface IngestLogEntry {
  source: CongressSource;
  doc_id: string;
  status: IngestStatus;
  row_count: number | null;
  detail: string | null;
}
