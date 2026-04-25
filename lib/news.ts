import fs from "fs";
import path from "path";
import { fetchFinnhubNews } from "./finnhub";
import { fetchRedditPosts } from "./reddit";
import { fetchNewsAPIArticles } from "./newsapi";
import { getCompanyName } from "./company-names";
import { classifyNews } from "./classifier";
import { MOCK_NEWS } from "./mock-news";
import { NEWS_CACHE_TTL_MS, WORLD_VAULT_PATH } from "./constants";
import { writeStoryNote } from "../world-brain/obsidian";
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

const NEWS_WINDOW_S = 14 * 24 * 60 * 60; // seconds

function withinNewsWindow(stories: ClassifiedStory[]): ClassifiedStory[] {
  const cutoff = Math.floor(Date.now() / 1000) - NEWS_WINDOW_S;
  return stories.filter((s) => s.datetime >= cutoff);
}

// Per-ticker 5-minute cache
const cache = new Map<string, { data: ClassifiedStory[]; expiresAt: number }>();

export async function getNewsForTicker(
  ticker: string,
  sector?: string
): Promise<ClassifiedStory[]> {
  const cached = cache.get(ticker);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const companyName = await getCompanyName(ticker);

  // Reddit needs no API key — always attempt it
  // Only attempt keyed sources when their credentials are present
  const [finnhubArticles, redditPosts, newsAPIArticles] = await Promise.all([
    process.env.FINNHUB_API_KEY
      ? fetchFinnhubNews(ticker).catch((err) => {
          console.error(`[news] Finnhub error for ${ticker}:`, err);
          return [];
        })
      : [],
    fetchRedditPosts(ticker, companyName, sector).catch((err) => {
      console.error(`[news] Reddit error for ${ticker}:`, err);
      return [];
    }),
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
    finnhubArticles.length + redditPosts.length + newsAPIArticles.length;
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

  const stories = [
    ...finnhubArticles.map((a) => ({
      ticker,
      headline: a.headline,
      summary: a.summary,
      url: a.url,
      datetime: a.datetime,
      source: "finnhub" as const,
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
  ].filter((s) => s.datetime >= cutoff);

  // Classify stories in parallel (fast keyword/vault lookup)
  const classified = await Promise.all(
    stories.map(async (s) => {
      const cls = await classifyNews(s.ticker, s.headline, s.summary ?? "", s.url);
      const result = { ...s, ...cls };
      
      // PERSISTENCE: If newly analyzed by the brain, remember it in the vault
      if (result.isAnalyzed && !result.fromVault && WORLD_VAULT_PATH) {
        await writeStoryNote(result as unknown as GeoStory, WORLD_VAULT_PATH, sector);
      }
      return result;
    })
  );

  // Sort newest first, drop anything older than 30 days
  const recent = withinNewsWindow(classified).sort((a, b) => b.datetime - a.datetime);

  cache.set(ticker, { data: recent, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
  return recent;
}
