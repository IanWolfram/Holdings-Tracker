export interface NewsAPIArticle {
  headline: string;
  summary: string;
  url: string;
  datetime: number; // unix timestamp
  source: "newsapi";
}

const BASE_URL = "https://newsapi.org/v2/everything";

export async function fetchNewsAPIArticles(
  ticker: string,
  companyName: string
): Promise<NewsAPIArticle[]> {
  const key = process.env.NEWSAPI_API_KEY;
  if (!key) throw new Error("NEWSAPI_API_KEY is not set");

  // Search for ticker OR "Company Name" to catch both cashtag and full-name mentions
  const queryTerms =
    companyName.toLowerCase() !== ticker.toLowerCase()
      ? `${ticker} OR "${companyName}"`
      : ticker;
  const query = encodeURIComponent(queryTerms);

  const url = `${BASE_URL}?q=${query}&language=en&sortBy=publishedAt&pageSize=10`;

  const res = await fetch(url, {
    headers: { "X-Api-Key": key },
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

  // Pre-filter: article must mention the ticker or a significant company-name
  // term.  NewsAPI's full-text search is fuzzy and can return loosely-related
  // results that don't actually discuss the requested stock.
  const tickerLc = ticker.toLowerCase();
  const nameTerms = companyName
    ? companyName.toLowerCase().split(/\s+/).filter(w => w.length >= 3)
    : [];

  const seen = new Set<string>();
  const articles: NewsAPIArticle[] = [];

  for (const item of raw) {
    const headline = item.title?.trim() ?? "";
    if (!headline || headline === "[Removed]" || seen.has(headline)) continue;
    seen.add(headline);

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

    if (articles.length >= 10) break;
  }

  return articles;
}
