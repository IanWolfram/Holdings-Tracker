import { fetchFinnhubNews } from "./finnhub";
import { fetchTwitterNews } from "./twitter";
import { classifyNews } from "./classifier";
import { MOCK_NEWS } from "./mock-news";
import { NEWS_CACHE_TTL_MS } from "./constants";
import type { ClassifiedStory } from "@/types/news.types";

// Per-ticker 5-minute cache
const cache = new Map<string, { data: ClassifiedStory[]; expiresAt: number }>();

export async function getNewsForTicker(ticker: string): Promise<ClassifiedStory[]> {
  const cached = cache.get(ticker);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  // Fall back to mock news when API keys are not configured
  const hasKeys = !!process.env.FINNHUB_API_KEY || !!process.env.TWITTER_BEARER_TOKEN;
  if (!hasKeys) {
    return MOCK_NEWS[ticker] ?? [];
  }

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

  const stories = [
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

  cache.set(ticker, { data: classified, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
  return classified;
}
