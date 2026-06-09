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
import { getDailyBars, type DailyBar } from "@/lib/marketdata/prices";
import { findBarOnOrAfter } from "@/lib/marketdata/volatility";
import type { CongressTradeRow, Party } from "./types";

const COMPLIANCE_WINDOW_DAYS = 45;
const DEFAULT_LIMIT = 250;
const BENCHMARK = "SPY"; // excess return = trade return − SPY return over the same window
const BARS_WINDOW_DAYS = 800; // ~2y, so older trades still resolve an entry bar

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

function rowToCongressTrade(row: CongressTradeRow): CongressTrade {
  return {
    id: row.id,
    politician: row.politician,
    party: (row.party ?? "I") as Party, // roster miss → Independent/unknown
    chamber: row.chamber,
    ticker: row.ticker,
    companyName: row.company_name ?? row.ticker,
    tradeType: row.tx_type,
    assetType: readableAssetType(row),
    amount: row.amount_range ?? "unknown",
    tradeDate: isoToUnixSeconds(row.traded_date),
    filedDate: isoToUnixSeconds(row.filed_date),
    url: row.url,
    // excessReturn is not in official filings — omitted for MVP (card shows N/A).
    isCompliant: computeCompliant(row.traded_date, row.filed_date),
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
  const trades = (data as CongressTradeRow[]).map(rowToCongressTrade);
  await enrichExcessReturns(trades);
  return trades;
}

// ── Excess return (trade return vs SPY since the trade date) ───────────────────

/** Total return from the first bar on/after `fromIso` to the latest bar. */
function returnSince(bars: DailyBar[], fromIso: string): number | null {
  const entry = findBarOnOrAfter(bars, fromIso);
  const latest = bars.at(-1);
  if (!entry || !latest || entry.close <= 0) return null;
  return latest.close / entry.close - 1;
}

/**
 * Fill `excessReturn` on each trade = (stock return since trade date) − (SPY
 * return over the same window), formatted like "+4.2%". Best-effort: any trade
 * whose bars are missing or older than our window stays "N/A". Never throws —
 * market-data failures must not break the Hot Trades feed.
 */
async function enrichExcessReturns(trades: CongressTrade[]): Promise<void> {
  if (trades.length === 0) return;
  try {
    const tickers = [...new Set(trades.map((t) => t.ticker))];
    const bars = new Map<string, DailyBar[]>();
    // Bounded concurrency over distinct tickers + the benchmark (bars are cached).
    const targets = [...tickers, BENCHMARK];
    const CONCURRENCY = 5;
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
        while (cursor < targets.length) {
          const tk = targets[cursor++];
          try {
            bars.set(tk, await getDailyBars(tk, BARS_WINDOW_DAYS));
          } catch {
            bars.set(tk, []);
          }
        }
      }),
    );

    const spy = bars.get(BENCHMARK) ?? [];
    for (const t of trades) {
      if (!t.tradeDate) {
        t.excessReturn = "N/A";
        continue;
      }
      const fromIso = new Date(t.tradeDate * 1000).toISOString().slice(0, 10);
      const stock = returnSince(bars.get(t.ticker) ?? [], fromIso);
      const bench = returnSince(spy, fromIso);
      if (stock === null || bench === null) {
        t.excessReturn = "N/A";
        continue;
      }
      const excess = (stock - bench) * 100;
      t.excessReturn = `${excess >= 0 ? "+" : ""}${excess.toFixed(1)}%`;
    }
  } catch (e) {
    console.error("[congress/index] excess-return enrichment failed:", (e as Error).message);
  }
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
