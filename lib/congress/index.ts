/**
 * Read seam — turns ingested `congress_trades` rows into the UI-facing
 * `CongressTrade` shape consumed by `getHotTrades` → `/api/congress` →
 * CongressTradeCard.
 *
 * The DB stores ISO dates + raw House asset codes; here we convert to the unix
 * seconds + readable strings the card expects, and derive `isCompliant` from the
 * STOCK Act 45-day window (the official filings don't carry it).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CongressTrade } from "@/types/news.types";
import { createServiceClient } from "@/lib/supabase/server";
import type { CongressTradeRow, Party } from "./types";

const COMPLIANCE_WINDOW_DAYS = 45;
const DEFAULT_LIMIT = 250;
// The general (unscoped) discovery feed is capped lower than the ticker-scoped
// read — the Hot tab and nav badge only need the most recent activity.
const RECENT_FEED_LIMIT = 60;

// House filings use 2-letter asset codes; the Senate already supplies words.
const HOUSE_ASSET_WORDS: Record<string, string> = {
  ST: "Stock",
  OP: "Option",
  OL: "Other Securities",
  OI: "Other Income",
  AB: "Asset-Backed Security",
  CS: "Corporate Security",
};

function isoToUnixSeconds(iso: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

/** Parse a full timestamptz (e.g. `ingested_at`) to unix seconds. */
function timestampToUnixSeconds(ts: string | null | undefined): number {
  if (!ts) return 0;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function readableAssetType(row: CongressTradeRow): string {
  const raw = row.asset_type;
  if (!raw) return "Stock";
  if (row.source === "house" && /^[A-Z]{2}$/.test(raw)) {
    return HOUSE_ASSET_WORDS[raw] ?? raw;
  }
  return raw;
}

/** STOCK Act: a PTR must be filed within 45 days of the transaction. */
function computeCompliant(tradedIso: string | null, filedIso: string | null): boolean | undefined {
  if (!tradedIso || !filedIso) return undefined;
  const traded = Date.parse(`${tradedIso}T00:00:00Z`);
  const filed = Date.parse(`${filedIso}T00:00:00Z`);
  if (!Number.isFinite(traded) || !Number.isFinite(filed)) return undefined;
  const days = (filed - traded) / 86_400_000;
  return days <= COMPLIANCE_WINDOW_DAYS;
}

// Trailing security-class descriptors ("Common Stock", "American Depositary
// Shares", etc.), optionally qualified ("Class A", "New", "Series B"). Stored
// verbatim from filings; trimmed here (read-side, non-destructive) so the UI
// shows the issuer name, not the share class.
const SECURITY_SUFFIX_RE =
  /[\s,–-]+(?:(?:Class\s+[A-Z0-9]+|New|Series\s+[A-Z0-9]+)\s+)*(?:Common\s+Stock|Ordinary\s+Shares?|Preferred\s+Stock|American\s+Depositary\s+(?:Shares?|Receipts?))\s*$/i;

// Tokens that never occur in a real issuer name but do in leaked PTR comment
// prose (per-share sale ledgers, narrative footnotes). A name containing one is
// unsalvageable — the caller falls back to the (always-correct) ticker.
const PROSE_LEAK_RE =
  /@|\/share|\bsold\b|\bpurchased those\b|insider trading|conjunction with|\bRSUs?\b|to be paid|\(CVR\)|this PTR|directed advisor|should be read/i;

function normalizeCompanyName(name: string | null | undefined): string {
  if (!name) return "";
  if (PROSE_LEAK_RE.test(name)) return ""; // garbage → caller uses the ticker
  const trimmed = name.replace(SECURITY_SUFFIX_RE, "").trim();
  return trimmed.length ? trimmed : name.trim();
}

function rowToCongressTrade(row: CongressTradeRow): CongressTrade {
  return {
    id: row.id,
    politician: row.politician,
    party: (row.party ?? "I") as Party, // roster miss → Independent/unknown
    chamber: row.chamber,
    ticker: row.ticker,
    companyName: normalizeCompanyName(row.company_name) || row.ticker,
    tradeType: row.tx_type,
    assetType: readableAssetType(row),
    amount: row.amount_range ?? "unknown",
    tradeDate: isoToUnixSeconds(row.traded_date),
    filedDate: isoToUnixSeconds(row.filed_date),
    url: row.url,
    isCompliant: computeCompliant(row.traded_date, row.filed_date),
    ingestedAt: timestampToUnixSeconds(row.ingested_at),
  };
}

/**
 * Read congressional trades for the given tickers from `congress_trades`,
 * most-recent first. Never throws — DB errors degrade to an empty list so the
 * news feed simply shows "no congress data".
 */
export async function fetchCongressTrades(
  tickers: string[],
  client?: SupabaseClient,
): Promise<CongressTrade[]> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return [];

  const supabase = client ?? createServiceClient();
  const { data, error } = await supabase
    .from("congress_trades")
    .select("*")
    .in("ticker", unique)
    .order("traded_date", { ascending: false, nullsFirst: false })
    .limit(DEFAULT_LIMIT);

  if (error) {
    console.error("[congress/index] read failed:", error.message);
    return [];
  }
  return (data as CongressTradeRow[]).map(rowToCongressTrade);
}

/**
 * Read the most-recent congressional trades across ALL tickers (no ticker
 * filter) — the general discovery feed for the Hot tab and the nav badge.
 * Same degrade-to-empty contract as {@link fetchCongressTrades}.
 */
export async function fetchRecentCongressTrades(
  limit = RECENT_FEED_LIMIT,
  client?: SupabaseClient,
): Promise<CongressTrade[]> {
  const supabase = client ?? createServiceClient();
  // Order by disclosure date (filed_date) — the "news" event a congress-trade
  // feed is really about — so newly-disclosed filings surface at the top.
  // traded_date is a poor sort key here (some filings carry future option dates).
  const { data, error } = await supabase
    .from("congress_trades")
    .select("*")
    .order("filed_date", { ascending: false, nullsFirst: false })
    .order("traded_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("[congress/index] recent read failed:", error.message);
    return [];
  }
  return (data as CongressTradeRow[]).map(rowToCongressTrade);
}

/**
 * Read a single politician's congressional trades by name (case-insensitive
 * substring), most-recent first. Powers the Hot tab politician search/watchlist,
 * which must surface a tracked person's filings even when they fall outside the
 * recent discovery window (`fetchRecentCongressTrades`). Same degrade-to-empty
 * contract as the others.
 */
export async function fetchCongressTradesByPolitician(
  name: string,
  limit = DEFAULT_LIMIT,
  client?: SupabaseClient,
): Promise<CongressTrade[]> {
  const q = name.trim();
  if (q.length < 2) return [];

  // Escape LIKE metacharacters so a name with % or _ is matched literally.
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);

  const supabase = client ?? createServiceClient();
  const { data, error } = await supabase
    .from("congress_trades")
    .select("*")
    .ilike("politician", `%${escaped}%`)
    .order("traded_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error("[congress/index] politician read failed:", error.message);
    return [];
  }
  return (data as CongressTradeRow[]).map(rowToCongressTrade);
}

/** Cheap check: does `congress_trades` hold any rows at all (i.e. backfilled)? */
export async function congressDbHasData(client?: SupabaseClient): Promise<boolean> {
  const supabase = client ?? createServiceClient();
  const { count, error } = await supabase
    .from("congress_trades")
    .select("*", { count: "exact", head: true })
    .limit(1);
  return !error && (count ?? 0) > 0;
}
