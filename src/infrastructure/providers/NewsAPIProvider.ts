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
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=50&from=${from}`;

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
    const tickerLc = ticker.toLowerCase();
    const nameTerms = companyName
      ? companyName.toLowerCase().split(/\s+/).filter(w => w.length >= 3)
      : [];
    const articles: RawNewsItem[] = [];

    for (const item of raw) {
      const headline = item.title?.trim() ?? "";
      if (!headline || headline === "[Removed]" || seen.has(headline)) continue;
      seen.add(headline);

      // Pre-filter: article must mention the ticker or a significant
      // company-name term.  NewsAPI's full-text search is fuzzy and can
      // return loosely-related results.
      const text = `${headline} ${item.description ?? ""}`.toLowerCase();
      const tickerHit = text.includes(tickerLc);
      const nameHit = nameTerms.some(term => text.includes(term));
      if (!tickerHit && !nameHit) continue;

      articles.push({
        headline,
        summary: item.description?.trim() ?? "",
        url: item.url ?? "",
        datetime: item.publishedAt
          ? Math.floor(new Date(item.publishedAt).getTime() / 1000)
          : 0,
        source: "newsapi",
      });
      if (articles.length >= 50) break;
    }

    return articles;
  }
}
