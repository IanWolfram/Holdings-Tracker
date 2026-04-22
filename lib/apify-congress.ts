import { ApifyClient } from 'apify-client';
import type { CongressTrade } from '@/types/news.types';

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const client = APIFY_TOKEN ? new ApifyClient({ token: APIFY_TOKEN }) : null;

// Actor ID for Capitol Trades
const ACTOR_ID = "VyNAX2PeuvQ8UQ7FK";

/**
 * Fetches congress trades for a list of tickers from Capitol Trades via Apify.
 */
export async function fetchCongressTrades(tickers: string[]): Promise<CongressTrade[]> {
  if (!client) {
    console.error("[apify-congress] APIFY_API_TOKEN is missing");
    return [];
  }

  // If no tickers provided, we might want to fetch general recent trades
  // but based on user request, we focus on their positions.
  const startUrls = tickers.length > 0 
    ? tickers.map(ticker => `https://www.capitoltrades.com/trades?ticker=${ticker.toUpperCase()}&txDate=90d`)
    : ["https://www.capitoltrades.com/trades?txDate=30d"]; // Fallback to all recent trades

  const input = {
    "start_urls": startUrls,
    "max_page": 1 // Keep it fast
  };

  try {
    const run = await client.actor(ACTOR_ID).call(input);
    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    return items.map((item: any) => {
      // Robust mapping based on Capitol Trades actor output schema
      // Note: We might need to adjust field names based on actual scraper output
      
      const tradeDate = item.pubDate ? Math.floor(new Date(item.pubDate).getTime() / 1000) : 0;
      const filedDate = item.filingDate ? Math.floor(new Date(item.filingDate).getTime() / 1000) : tradeDate;
      
      // Determine trade type
      let tradeType: "buy" | "sell" | "buy_option" | "sell_option" = "buy";
      const txType = (item.txType || "").toLowerCase();
      if (txType.includes("sell")) {
        tradeType = txType.includes("option") ? "sell_option" : "sell";
      } else if (txType.includes("buy")) {
        tradeType = txType.includes("option") ? "buy_option" : "buy";
      }

      return {
        id: item.id || `congress-${item.politicianName}-${item.ticker}-${item.txDate}`,
        politician: item.politicianName || "Unknown",
        party: (item.party === "Democratic" ? "D" : item.party === "Republican" ? "R" : "I") as "D" | "R" | "I",
        chamber: (item.chamber || "house").toLowerCase() as "house" | "senate",
        ticker: item.ticker || "N/A",
        companyName: item.issuerName || item.ticker || "N/A",
        tradeType,
        assetType: item.assetType || "stock",
        amount: item.value || "unknown",
        tradeDate: item.txDate ? Math.floor(new Date(item.txDate).getTime() / 1000) : tradeDate,
        filedDate: filedDate,
        url: item.url || `https://www.capitoltrades.com/trades?ticker=${item.ticker}`,
      };
    }).filter(t => t.ticker !== "N/A");
  } catch (err) {
    console.error("[apify-congress] Error calling actor:", err);
    return [];
  }
}
