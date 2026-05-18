import { fetchFinnhubNews } from "./finnhub";
import { fetchPolygonNews } from "./polygon";
import { fetchNewsAPIArticles } from "./newsapi";
import { getCompanyName } from "./company-names";
import { classifyNews } from "./classifier";
import { NEWS_CACHE_TTL_MS, SYSTEM_USER_ID } from "./constants";
import { dedupeStories } from "./utils/dedupeStories";
import { getVaultStoriesForTicker } from "./vault-stories";
import { writeStoryNote } from "../world-brain/obsidian";
import { getVaultStore } from "@/lib/vault/store";
import { buildRelevanceProfile, isRelevantToTicker } from "./relevance";
import type { ClassifiedStory } from "@/types/news.types";
import type { GeoStory } from "@/types/geo.types";
export type { ClassifiedStory } from "@/types/news.types";

const NEWS_WINDOW_S = 7 * 24 * 60 * 60; // seconds

function withinNewsWindow(stories: ClassifiedStory[]): ClassifiedStory[] {
  const cutoff = Math.floor(Date.now() / 1000) - NEWS_WINDOW_S;
  return stories.filter((s) => s.datetime >= cutoff);
}

// Per-ticker 5-minute cache with SWR support
const cache = new Map<string, { data: ClassifiedStory[]; expiresAt: number }>();

// Background revalidation locks per ticker to prevent duplicate fetches
const revalidationLocks = new Map<string, Promise<void>>();

/**
 * SWR-style fetch: returns cached data immediately (even if stale),
 * kicks off background revalidation if the cache is stale or empty.
 * Falls back to a blocking fetch only when there's no cached data at all.
 */
export async function getNewsForTicker(
  ticker: string,
  sector?: string,
  options?: { mock?: boolean; userId?: string }
): Promise<ClassifiedStory[]> {
  const cached = cache.get(ticker);

  // Fresh cache — return immediately
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  // Stale cache — return it now, revalidate in background
  if (cached) {
    if (!revalidationLocks.has(ticker)) {
      revalidationLocks.set(ticker,
        fetchNewsForTicker(ticker, sector, options)
          .then(() => {})
          .catch((err) => console.error(`[news] SWR revalidation failed for ${ticker}:`, err))
          .finally(() => revalidationLocks.delete(ticker))
      );
    }
    return cached.data;
  }

  // No cache — must fetch blocking
  return fetchNewsForTicker(ticker, sector, options);
}

async function fetchNewsForTicker(
  ticker: string,
  sector?: string,
  options?: { mock?: boolean; userId?: string }
): Promise<ClassifiedStory[]> {
  const companyName = await getCompanyName(ticker);

  // Only attempt keyed sources when their credentials are present
  const [finnhubArticles, polygonArticles, newsAPIArticles] = await Promise.all([
    process.env.FINNHUB_API_KEY
      ? fetchFinnhubNews(ticker).catch((err) => {
          console.error(`[news] Finnhub error for ${ticker}:`, err);
          return [];
        })
      : [],
    process.env.POLYGON_API_KEY
      ? fetchPolygonNews(ticker, companyName).catch((err) => {
          console.error(`[news] Polygon news error for ${ticker}:`, err);
          return [];
        })
      : [],
    process.env.NEWSAPI_API_KEY
      ? fetchNewsAPIArticles(ticker, companyName).catch((err) => {
          console.error(`[news] NewsAPI error for ${ticker}:`, err);
          return [];
        })
      : [],
  ]);

  // If all real sources came back empty, return empty — no mock data
  const totalRealStories =
    finnhubArticles.length + polygonArticles.length + newsAPIArticles.length;
  if (totalRealStories === 0) {
    cache.set(ticker, { data: [], expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
    return [];
  }

  const cutoff = Math.floor(Date.now() / 1000) - NEWS_WINDOW_S;
  const profile = buildRelevanceProfile(ticker, companyName);

  const stories = [
    ...finnhubArticles.map((a) => ({
      ticker,
      headline: a.headline,
      summary: a.summary,
      url: a.url,
      datetime: a.datetime,
      source: "finnhub" as const,
    })),
    ...polygonArticles.map((a) => ({
      ticker,
      headline: a.headline,
      summary: a.summary,
      url: a.url,
      datetime: a.datetime,
      source: "polygon" as const,
    })),
    ...newsAPIArticles.map((a) => ({
      ticker,
      headline: a.headline,
      summary: a.summary,
      url: a.url,
      datetime: a.datetime,
      source: "newsapi" as const,
    })),
  ].filter((s) => {
    if (s.datetime < cutoff) return false;
    return isRelevantToTicker(s.headline, s.summary ?? "", profile);
  });

  // Classify stories in parallel (fast keyword/vault lookup)
  const classified = await Promise.all(
    stories.map(async (s) => {
      const cls = await classifyNews(s.ticker, s.headline, s.summary ?? "", s.url);
      const result = { ...s, ...cls };
      
      // PERSISTENCE: If newly analyzed by the brain, remember it in the vault
      // Skip vault writes for mock data to avoid polluting the knowledge base
      if (result.isAnalyzed && !result.fromVault && !options?.mock) {
        const store = await getVaultStore(options?.userId ?? SYSTEM_USER_ID);
        await writeStoryNote(result as unknown as GeoStory, store, sector);
      }
      return result;
    })
  );

  // Sort newest first, drop anything older than 30 days
  const vaultStories = await getVaultStoriesForTicker(ticker, 7, options?.userId ?? SYSTEM_USER_ID);
  const allClassified = [...classified, ...vaultStories];
  const deduped = dedupeStories(allClassified, await getCompanyName(ticker));
  const recent = withinNewsWindow(deduped).sort((a, b) => b.datetime - a.datetime);

  cache.set(ticker, { data: recent, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
  return recent;
}
