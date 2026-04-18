import type { CongressTrade } from "@/types/news.types";

const CONGRESS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

let cache: { data: CongressTrade[]; expiresAt: number } | null = null;

// Quiver Quantitative API response shape
interface QuiverTrade {
  Representative?: string;
  BioGuideID?: string;
  ReportDate?: string;
  TransactionDate?: string;
  Ticker?: string;
  Transaction?: string;
  Range?: string;
  House?: string;
  Amount?: string;
  Party?: string;
  last_modified?: string;
  TickerType?: string;
  Description?: string | null;
}

function parseParty(raw: string | undefined): "D" | "R" | "I" {
  if (!raw) return "I";
  const u = raw.toUpperCase();
  if (u === "D") return "D";
  if (u === "R") return "R";
  return "I";
}

function parseChamber(raw: string | undefined): "house" | "senate" {
  return raw?.toLowerCase().includes("senate") ? "senate" : "house";
}

function parseTradeType(transaction: string | undefined): CongressTrade["tradeType"] {
  if (!transaction) return "buy";
  const l = transaction.toLowerCase();
  if (l.includes("sale") || l.includes("sell")) return "sell";
  if (l.includes("call")) return "buy_option";
  if (l.includes("put")) return "sell_option";
  return "buy";
}

function dateToUnix(dateStr: string | undefined): number {
  if (!dateStr) return Math.floor(Date.now() / 1000);
  const ms = Date.parse(dateStr);
  return isNaN(ms) ? Math.floor(Date.now() / 1000) : Math.floor(ms / 1000);
}

function mapTrade(item: QuiverTrade, index: number): CongressTrade | null {
  const ticker = item.Ticker?.toUpperCase();
  if (!ticker) return null;

  const politician = item.Representative ?? "Unknown";
  const party = parseParty(item.Party);
  const chamber = parseChamber(item.House);
  const tradeType = parseTradeType(item.Transaction);
  const assetType = item.TickerType ?? "stock";
  const amount = item.Range ?? item.Amount ?? "Unknown";
  const tradeDate = dateToUnix(item.TransactionDate);
  const filedDate = dateToUnix(item.ReportDate ?? item.last_modified);
  const id = `${ticker}-${politician}-${tradeDate}-${index}`;
  const url = item.BioGuideID 
    ? `https://www.capitoltrades.com/politicians/${item.BioGuideID}`
    : `https://www.quiverquant.com/congresstrading/politician/${encodeURIComponent(politician)}`;

  return { id, politician, party, chamber, ticker, companyName: ticker, tradeType, assetType, amount, tradeDate, filedDate, url };
}

export async function getCongressTrades(): Promise<CongressTrade[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.data;
  }

  try {
    const res = await fetch(
      "https://api.quiverquant.com/beta/live/congresstrading",
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; Pulse-Dashboard/1.0)",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!res.ok) {
      console.warn(`[congress] Quiver API returned ${res.status}`);
      return cache?.data ?? [];
    }

    const json = (await res.json()) as QuiverTrade[];

    if (!Array.isArray(json)) {
      console.warn("[congress] unexpected response shape");
      return cache?.data ?? [];
    }

    const cutoff = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;

    const trades = json
      .map((item, i) => mapTrade(item, i))
      .filter((t): t is CongressTrade => t !== null && t.tradeDate >= cutoff);

    // Sort newest trade date first to ensure monotonic time-ago display
    trades.sort((a, b) => b.tradeDate - a.tradeDate);

    // Limit to top 100 for global feed performance
    const finalTrades = trades.slice(0, 100);

    cache = { data: finalTrades, expiresAt: Date.now() + CONGRESS_CACHE_TTL_MS };
    return finalTrades;
  } catch (err) {
    console.error("[congress] fetch error:", err);
    return cache?.data ?? [];
  }
}
