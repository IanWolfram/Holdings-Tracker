// eslint-disable-next-line @typescript-eslint/no-require-imports
const finnhub = require('finnhub') as Record<string, unknown>;

export interface NewsArticle {
  headline: string;
  summary: string;
  url: string;
  datetime: number; // unix timestamp
  source: "finnhub";
}

export interface Quote {
  currentPrice: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

// Lazy client — initialized on first use so the API key is read after env is loaded
let _client: any = null;
function getClient() {
  if (!_client) _client = new (finnhub as any).DefaultApi(process.env.FINNHUB_API_KEY);
  return _client;
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
 * Fetch company news using the Finnhub SDK
 */
export async function fetchFinnhubNews(ticker: string): Promise<NewsArticle[]> {
  if (!process.env.FINNHUB_API_KEY) {
    throw new Error("FINNHUB_API_KEY is not set");
  }

  return new Promise((resolve, reject) => {
    getClient().companyNews(
      ticker,
      daysAgo(3),
      today(),
      (error: any, data: any, response: any) => {
        if (error) {
          reject(new Error(`Finnhub SDK error: ${error.message || error}`));
          return;
        }

        if (!data || !Array.isArray(data)) {
          resolve([]);
          return;
        }

        // Deduplicate by headline, limit to 20
        const seen = new Set<string>();
        const articles: NewsArticle[] = [];

        for (const item of data) {
          const headline = item.headline?.trim() ?? "";
          if (!headline || seen.has(headline)) continue;
          seen.add(headline);
          articles.push({
            headline,
            summary: item.summary?.trim() ?? "",
            url: item.url ?? "",
            datetime: item.datetime ?? 0,
            source: "finnhub",
          });
          if (articles.length >= 20) break;
        }

        resolve(articles);
      }
    );
  });
}

/**
 * Fetch real-time stock quote using the Finnhub SDK
 */
export async function fetchQuote(ticker: string): Promise<Quote> {
  if (!process.env.FINNHUB_API_KEY) {
    throw new Error("FINNHUB_API_KEY is not set");
  }

  return new Promise((resolve, reject) => {
    getClient().quote(ticker, (error: any, data: any, response: any) => {
      if (error) {
        reject(new Error(`Finnhub SDK error: ${error.message || error}`));
        return;
      }

      if (!data) {
        reject(new Error(`No quote data returned for ${ticker}`));
        return;
      }

      resolve({
        currentPrice: data.c ?? 0,
        change: data.d ?? 0,
        percentChange: data.dp ?? 0,
        high: data.h ?? 0,
        low: data.l ?? 0,
        open: data.o ?? 0,
        previousClose: data.pc ?? 0,
        timestamp: data.t ?? Math.floor(Date.now() / 1000),
      });
    });
  });
}
