import fs from "fs";
import path from "path";
import { fetchFinnhubNews } from "./finnhub";
import { fetchPolygonNews } from "./polygon";
import { fetchNewsAPIArticles } from "./newsapi";
import { getCompanyName } from "./company-names";
import { classifyNews } from "./classifier";
import { MOCK_NEWS } from "./mock-news";
import { NEWS_CACHE_TTL_MS, WORLD_VAULT_PATH } from "./constants";
import { dedupeStories } from "./utils/dedupeStories";
import { getVaultStoriesForTicker } from "./vault-stories";
import { writeStoryNote } from "../world-brain/obsidian";
import { buildRelevanceProfile, isRelevantToTicker } from "./relevance";
import type { ClassifiedStory } from "@/types/news.types";
import type { GeoStory } from "@/types/geo.types";
export type { ClassifiedStory } from "@/types/news.types";

// Pre-classified verdicts from scripts/review-verdicts.ts --save
// If absent, falls back to classifying mock stories through the AI Brain
function loadMockVerdicts(): Record<string, ClassifiedStory[]> | null {
  try {
    const p = path.join(process.cwd(), "lib", "mock-verdicts.json");
    return JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, ClassifiedStory[]>;
  } catch {
    return null;
  }
}
// Load once per process
const MOCK_VERDICTS = loadMockVerdicts();

const NEWS_WINDOW_S = 7 * 24 * 60 * 60; // seconds

function withinNewsWindow(stories: ClassifiedStory[]): ClassifiedStory[] {
  const cutoff = Math.floor(Date.now() / 1000) - NEWS_WINDOW_S;
  return stories.filter((s) => s.datetime >= cutoff);
}

// Per-ticker 5-minute cache
const cache = new Map<string, { data: ClassifiedStory[]; expiresAt: number }>();

export async function getNewsForTicker(
  ticker: string,
  sector?: string,
  options?: { mock?: boolean }
): Promise<ClassifiedStory[]> {
  const cached = cache.get(ticker);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

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

  // If all real sources came back empty, classify and cache mock news so
  // tooltips still show AI reasoning instead of being empty
  const totalRealStories =
    finnhubArticles.length + polygonArticles.length + newsAPIArticles.length;
  if (totalRealStories === 0) {
    // Use pre-classified verdicts if available (run scripts/review-verdicts.ts --save to generate)
    if (MOCK_VERDICTS?.[ticker]) {
      const data = withinNewsWindow(MOCK_VERDICTS[ticker]);
      cache.set(ticker, { data, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
      return data;
    }
    // Fall back to classifying mock stories sequentially through the AI Brain
    const mockStories = MOCK_NEWS[ticker] ?? [];
    const classified: ClassifiedStory[] = [];
    for (const s of mockStories) {
      if (s.reason) { classified.push(s); continue; }
      const cls = await classifyNews(s.ticker, s.headline, s.summary ?? "", s.url);
      classified.push({ ...s, verdict: cls.verdict, confidence: cls.confidence, reason: cls.reason, classifiedAt: cls.classifiedAt });
    }
    const filtered = withinNewsWindow(classified);
    cache.set(ticker, { data: filtered, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
    return filtered;
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
      if (result.isAnalyzed && !result.fromVault && WORLD_VAULT_PATH && !options?.mock) {
        await writeStoryNote(result as unknown as GeoStory, WORLD_VAULT_PATH, sector);
      }
      return result;
    })
  );

  // Sort newest first, drop anything older than 30 days
  const vaultStories = await getVaultStoriesForTicker(ticker, 7);
  const allClassified = [...classified, ...vaultStories];
  const deduped = dedupeStories(allClassified, await getCompanyName(ticker));
  const recent = withinNewsWindow(deduped).sort((a, b) => b.datetime - a.datetime);

  cache.set(ticker, { data: recent, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
  return recent;
}
