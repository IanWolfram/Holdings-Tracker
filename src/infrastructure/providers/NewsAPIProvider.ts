import type { INewsProvider, RawNewsItem } from "@/src/domain/interfaces/INewsProvider";

export class NewsAPIProvider implements INewsProvider {
  constructor(private readonly apiKey: string) {}

  async fetchNews(ticker: string, companyName?: string): Promise<RawNewsItem[]> {
    const name = companyName ?? ticker;
    const queryTerms =
      name.toLowerCase() !== ticker.toLowerCase()
        ? `${ticker} OR "${name}"`
        : ticker;
    const query = encodeURIComponent(queryTerms);
    const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=10`;

    const res = await fetch(url, {
      headers: { "X-Api-Key": this.apiKey },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`NewsAPI request failed ${res.status}: ${body}`);
    }

    const json: {
      articles?: Array<{
        title?: string;
        description?: string;
        url?: string;
        publishedAt?: string;
      }>;
    } = await res.json();

    const raw = json.articles ?? [];
    const seen = new Set<string>();
    const articles: RawNewsItem[] = [];

    for (const item of raw) {
      const headline = item.title?.trim() ?? "";
      if (!headline || headline === "[Removed]" || seen.has(headline)) continue;
      seen.add(headline);
      articles.push({
        headline,
        summary: item.description?.trim() ?? "",
        url: item.url ?? "",
        datetime: item.publishedAt
          ? Math.floor(new Date(item.publishedAt).getTime() / 1000)
          : 0,
        source: "newsapi",
      });
      if (articles.length >= 10) break;
    }

    return articles;
  }
}
