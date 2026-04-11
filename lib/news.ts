import { fetchFinnhubNews } from "./finnhub";
import { fetchTwitterNews } from "./twitter";
import { classifyNews, Classification } from "./classifier";

export interface ClassifiedStory extends Classification {
  ticker: string;
  headline: string;
  summary: string;
  url: string;
  datetime: number;
  author?: string;
  source: "finnhub" | "twitter";
}

// Per-ticker 5-minute cache
const cache = new Map<string, { data: ClassifiedStory[]; expiresAt: number }>();

export async function getNewsForTicker(ticker: string): Promise<ClassifiedStory[]> {
  const cached = cache.get(ticker);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const [finnhubArticles, tweets] = await Promise.all([
    fetchFinnhubNews(ticker).catch((err) => {
      console.error(`[news] Finnhub error for ${ticker}:`, err);
      return [];
    }),
    fetchTwitterNews(ticker).catch((err) => {
      console.error(`[news] Twitter error for ${ticker}:`, err);
      return [];
    }),
  ]);

  const stories: Array<{
    ticker: string;
    headline: string;
    summary: string;
    url: string;
    datetime: number;
    author?: string;
    source: "finnhub" | "twitter";
  }> = [
    ...finnhubArticles.map((a) => ({
      ticker,
      headline: a.headline,
      summary: a.summary,
      url: a.url,
      datetime: a.datetime,
      source: "finnhub" as const,
    })),
    ...tweets.map((t) => ({
      ticker,
      headline: t.text.slice(0, 120),
      summary: t.text,
      url: t.url,
      datetime: t.datetime,
      author: t.author,
      source: "twitter" as const,
    })),
  ];

  // Classify all stories in parallel
  const classified: ClassifiedStory[] = await Promise.all(
    stories.map(async (s) => {
      const cls = await classifyNews(s.ticker, s.headline, s.summary);
      return { ...s, ...cls };
    })
  );

  // Sort newest first
  classified.sort((a, b) => b.datetime - a.datetime);

  cache.set(ticker, { data: classified, expiresAt: Date.now() + 5 * 60 * 1000 });
  return classified;
}
