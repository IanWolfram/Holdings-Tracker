/**
 * Database helpers for the congress ingester (service-role only).
 *
 * Writes go to `public.congress_trades` (the parsed rows) and
 * `public.congress_ingest_log` (per-filing status so the daily run is
 * incremental). Both tables are written exclusively via the service role,
 * which bypasses RLS — never call these from a request-scoped client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CongressTradeRow, CongressSource, IngestLogEntry } from "./types";

/** doc_ids already processed for a source, so the daily run can skip them. */
export async function getProcessedDocIds(
  supabase: SupabaseClient,
  source: CongressSource,
): Promise<Set<string>> {
  const seen = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("congress_ingest_log")
      .select("doc_id")
      .eq("source", source)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`[congress/db] read ingest log: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) seen.add(String(r.doc_id));
    if (data.length < PAGE) break;
  }
  return seen;
}

/**
 * Upsert parsed trade rows. Conflict target is the `id`
 * (`${source}-${doc_id}-${row_index}`) — the stable positional key. We do NOT
 * dedupe on content_hash: byte-identical trades (same ticker/dates/amount) are
 * legitimately distinct disclosures and must each survive.
 */
export async function upsertTrades(
  supabase: SupabaseClient,
  rows: CongressTradeRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from("congress_trades")
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "id" });
    if (error) throw new Error(`[congress/db] upsert trades: ${error.message}`);
  }
}

/** Record per-filing ingest status (upsert on (source, doc_id)). */
export async function logIngest(
  supabase: SupabaseClient,
  entries: IngestLogEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const { error } = await supabase
      .from("congress_ingest_log")
      .upsert(entries.slice(i, i + CHUNK), { onConflict: "source,doc_id" });
    if (error) throw new Error(`[congress/db] write ingest log: ${error.message}`);
  }
}
