export interface NewsArticle {
  headline: string;
  summary: string;
  url: string;
  datetime: number; // unix timestamp
  source: "finnhub";
}

const BASE_URL = "https://finnhub.io/api/v1";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export async function fetchFinnhubNews(ticker: string): Promise<NewsArticle[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not set");

  const url = `${BASE_URL}/company-news?symbol=${encodeURIComponent(ticker)}&from=${daysAgo(3)}&to=${today()}&token=${key}`;
  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Finnhub request failed ${res.status}: ${body}`);
  }

  const raw: Array<{
    headline?: string;
    summary?: string;
    url?: string;
    datetime?: number;
  }> = await res.json();

  // Deduplicate by headline, limit to 20
  const seen = new Set<string>();
  const articles: NewsArticle[] = [];

  for (const item of raw) {
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

  return articles;
}
