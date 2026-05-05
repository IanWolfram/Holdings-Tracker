import fs from "fs";
import path from "path";
import type { INewsProvider } from "@/src/domain/interfaces/INewsProvider";
import type { IClassifier } from "@/src/domain/interfaces/IClassifier";
import type { ICache } from "@/src/domain/interfaces/ICache";
import type { ClassifiedStory } from "@/types/news.types";
import { MOCK_NEWS, MOCK_PENDING } from "@/lib/mock-news";
import { getCompanyName } from "@/lib/company-names";
import { NEWS_CACHE_TTL_MS } from "@/lib/constants";
import { dedupeStories } from "@/lib/utils/dedupeStories";
import { getVaultStoriesForTicker } from "@/lib/vault-stories";

const NEWS_WINDOW_S = 7 * 24 * 60 * 60;

function withinNewsWindow(stories: ClassifiedStory[]): ClassifiedStory[] {
  const cutoff = Math.floor(Date.now() / 1000) - NEWS_WINDOW_S;
  return stories.filter((s) => s.datetime >= cutoff);
}

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

export class NewsService {
  constructor(
    private readonly providers: {
      finnhub?: INewsProvider;
      polygon?: INewsProvider;
      newsapi?: INewsProvider;
    },
    private readonly classifier: IClassifier,
    private readonly cache: ICache
  ) {}

  invalidateTicker(ticker: string): void {
    this.cache.delete(ticker);
  }

  getCachedNews(ticker: string): ClassifiedStory[] | null {
    return this.cache.get<ClassifiedStory[]>(ticker);
  }

  patchCachedStory(ticker: string, url: string, patch: Partial<ClassifiedStory>): void {
    const cached = this.cache.get<ClassifiedStory[]>(ticker);
    if (!cached) return;
    const updated = cached.map((s) => (s.url === url ? { ...s, ...patch } : s));
    this.cache.set(ticker, updated, NEWS_CACHE_TTL_MS);
  }

  async getNewsForTicker(ticker: string, sector?: string): Promise<ClassifiedStory[]> {
    const cached = this.cache.get<ClassifiedStory[]>(ticker);
    if (cached) return cached;

    const companyName = await getCompanyName(ticker);

    // Polygon's free-tier rate limit serializes calls behind a 13s queue
    // (lib/polygon.ts), so for an N-ticker dashboard the floor is (N-1)*13s.
    // We fetch only Finnhub + NewsAPI on the synchronous path and let
    // Polygon enrich the cache in the background.
    const [finnhubItems, newsapiItems] = await Promise.all([
      this.providers.finnhub
        ? this.providers.finnhub.fetchNews(ticker).catch((err) => {
            console.error(`[news] Finnhub error for ${ticker}:`, err);
            return [];
          })
        : [],
      this.providers.newsapi
        ? this.providers.newsapi.fetchNews(ticker, companyName).catch((err) => {
            console.error(`[news] NewsAPI error for ${ticker}:`, err);
            return [];
          })
        : [],
    ]);

    const totalRealStories = finnhubItems.length + newsapiItems.length;

    if (totalRealStories === 0) {
      if (MOCK_VERDICTS?.[ticker]) {
        const deduped = dedupeStories(MOCK_VERDICTS[ticker], companyName);
        const data = withinNewsWindow(deduped);
        this.cache.set(ticker, data, NEWS_CACHE_TTL_MS);
        this.kickOffPolygonEnrichment(ticker, companyName);
        return data;
      }

      const mockStories = MOCK_NEWS[ticker] ?? [];
      const classified: ClassifiedStory[] = [];
      for (const s of mockStories) {
        if (s.reason) { classified.push(s); continue; }
        const cls = await this.classifier.classify(s.ticker, s.headline, s.summary ?? "", s.url);
        classified.push({ ...s, ...cls });
      }
      const pending = MOCK_PENDING[ticker] || [];
      const deduped = dedupeStories(classified, companyName);
      const filtered = withinNewsWindow(deduped);
      const allResult = [...pending, ...filtered];
      this.cache.set(ticker, allResult, NEWS_CACHE_TTL_MS);
      this.kickOffPolygonEnrichment(ticker, companyName);
      return allResult;
    }

    const cutoff = Math.floor(Date.now() / 1000) - NEWS_WINDOW_S;
    const allItems = [
      ...finnhubItems.map((a) => ({ ticker, ...a, source: "finnhub" as const })),
      ...newsapiItems.map((a) => ({ ticker, ...a, source: "newsapi" as const })),
    ].filter((s) => s.datetime >= cutoff);

    const classified: ClassifiedStory[] = [];
    // classifier.classify is now vault-lookup + keyword only (no MLX), so it's safe to call for all.
    // This ensures vault verdicts from prior agent runs are surfaced across the full article list.
    for (const s of allItems) {
      const cls = await this.classifier.classify(s.ticker, s.headline, s.summary ?? "", s.url);
      classified.push({ ...s, ...cls });
    }

    const pending = MOCK_PENDING[ticker] || [];
    const vaultStories = await getVaultStoriesForTicker(ticker, 7);
    const allClassified = [...classified, ...vaultStories];
    const deduped = dedupeStories(allClassified, companyName);
    const recent = withinNewsWindow(deduped).sort((a, b) => b.datetime - a.datetime);
    const allRecent = [...pending, ...recent];

    this.cache.set(ticker, allRecent, NEWS_CACHE_TTL_MS);
    this.kickOffPolygonEnrichment(ticker, companyName);
    return allRecent;
  }

  private kickOffPolygonEnrichment(ticker: string, companyName: string): void {
    if (!this.providers.polygon) return;
    void this.enrichWithPolygon(ticker, companyName).catch((err) => {
      console.error(`[news] Polygon enrichment failed for ${ticker}:`, err);
    });
  }

  private async enrichWithPolygon(ticker: string, companyName: string): Promise<void> {
    const polygonItems = await this.providers.polygon!.fetchNews(ticker, companyName).catch((err) => {
      console.error(`[news] Polygon news error for ${ticker}:`, err);
      return [] as Awaited<ReturnType<INewsProvider["fetchNews"]>>;
    });
    if (polygonItems.length === 0) return;

    const cached = this.cache.get<ClassifiedStory[]>(ticker);
    if (!cached) return;

    const cachedUrls = new Set(cached.map((s) => s.url));
    const cutoff = Math.floor(Date.now() / 1000) - NEWS_WINDOW_S;

    const fresh = polygonItems
      .map((a) => ({ ticker, ...a, source: "polygon" as const }))
      .filter((s) => s.datetime >= cutoff && !cachedUrls.has(s.url));

    if (fresh.length === 0) return;

    const newClassified: ClassifiedStory[] = [];
    for (const s of fresh) {
      const cls = await this.classifier.classify(s.ticker, s.headline, s.summary ?? "", s.url);
      newClassified.push({ ...s, ...cls });
    }

    // Pending mock items are statically derived per ticker; preserve them
    // unchanged on the front of the merged list rather than dedupe-merging.
    const pending = MOCK_PENDING[ticker] || [];
    const pendingUrls = new Set(pending.map((s) => s.url));
    const realCached = cached.filter((s) => !pendingUrls.has(s.url));

    const merged = dedupeStories([...realCached, ...newClassified], companyName);
    const recent = withinNewsWindow(merged).sort((a, b) => b.datetime - a.datetime);
    this.cache.set(ticker, [...pending, ...recent], NEWS_CACHE_TTL_MS);
  }
}
