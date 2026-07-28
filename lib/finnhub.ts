export interface NewsArticle {
  headline: string;
  summary: string;
  url: string;
  datetime: number; // unix timestamp
  source: "finnhub";
}

import { FINNHUB_BASE_URL, API_TIMEOUT_MS } from "./constants";

const BASE = FINNHUB_BASE_URL;

function requireKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not set");
  return key;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Fetch company news using direct REST (avoids SDK Cloudflare issues)
 */
export async function fetchFinnhubNews(ticker: string): Promise<NewsArticle[]> {
  const key = requireKey();
  const url = `${BASE}/company-news?symbol=${ticker}&from=${daysAgo(7)}&to=${today()}&token=${key}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data)) return [];

    const tickerLc = ticker.toLowerCase();
    const seen = new Set<string>();
    const articles: NewsArticle[] = [];

    for (const item of data) {
      const headline = item.headline?.trim() ?? "";
      if (!headline || seen.has(headline)) continue;
      seen.add(headline);

      // Pre-filter: headline or summary must mention the ticker.
      // Finnhub's symbol filter is usually precise but can occasionally
      // return loosely-related articles.
      const text = `${headline} ${item.summary ?? ""}`.toLowerCase();
      if (!text.includes(tickerLc)) continue;

      articles.push({
        headline,
        summary: item.summary?.trim() ?? "",
        url: item.url ?? "",
        datetime: item.datetime ?? 0,
        source: "finnhub",
      });
      if (articles.length >= 50) break;
    }

    return articles;
  } catch (err) {
    console.error(`[finnhub] News fetch error for ${ticker}:`, err);
    return [];
  }
}

