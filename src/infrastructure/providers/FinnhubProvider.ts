import type { INewsProvider, RawNewsItem } from "@/src/domain/interfaces/INewsProvider";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export class FinnhubProvider implements INewsProvider {
  constructor(private readonly apiKey: string) {}

  async fetchNews(ticker: string): Promise<RawNewsItem[]> {
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(ticker)}&from=${daysAgo(3)}&to=${today()}&token=${this.apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });

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

    const seen = new Set<string>();
    const articles: RawNewsItem[] = [];

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
}
