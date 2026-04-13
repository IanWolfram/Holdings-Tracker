import { fetchFinnhubNews } from "./finnhub";
import { fetchTwitterNews } from "./twitter";
import { fetchRedditPosts } from "./reddit";
import { fetchNewsAPIArticles } from "./newsapi";
import { getCompanyName } from "./company-names";
import { classifyNews } from "./classifier";
import { MOCK_NEWS } from "./mock-news";
import { NEWS_CACHE_TTL_MS } from "./constants";
export type { ClassifiedStory } from "@/types/news.types";

// Per-ticker 5-minute cache
const cache = new Map<string, { data: ClassifiedStory[]; expiresAt: number }>();

export async function getNewsForTicker(ticker: string): Promise<ClassifiedStory[]> {
  const cached = cache.get(ticker);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  // Fall back to mock news when no API keys are configured
  const hasKeys =
    !!process.env.FINNHUB_API_KEY ||
    !!process.env.TWITTER_BEARER_TOKEN ||
    !!process.env.NEWSAPI_API_KEY;
  if (!hasKeys) {
    return MOCK_NEWS[ticker] ?? [];
  }

  const companyName = await getCompanyName(ticker);

  const [finnhubArticles, tweets, redditPosts, newsAPIArticles] = await Promise.all([
    fetchFinnhubNews(ticker).catch((err) => {
      console.error(`[news] Finnhub error for ${ticker}:`, err);
      return [];
    }),
    fetchTwitterNews(ticker).catch((err) => {
      console.error(`[news] Twitter error for ${ticker}:`, err);
      return [];
    }),
    fetchRedditPosts(ticker, companyName).catch((err) => {
      console.error(`[news] Reddit error for ${ticker}:`, err);
      return [];
    }),
    fetchNewsAPIArticles(ticker, companyName).catch((err) => {
      console.error(`[news] NewsAPI error for ${ticker}:`, err);
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
    ...redditPosts.map((p) => ({
      ticker,
      headline: p.text.split("\n")[0].slice(0, 120),
      summary: p.text,
      url: p.url,
      datetime: p.datetime,
      author: p.author,
      source: "reddit" as const,
    })),
    ...newsAPIArticles.map((a) => ({
      ticker,
      headline: a.headline,
      summary: a.summary,
      url: a.url,
      datetime: a.datetime,
      source: "newsapi" as const,
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
