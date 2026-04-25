import fs from "fs";
import path from "path";
import type { INewsProvider } from "@/src/domain/interfaces/INewsProvider";
import type { IClassifier } from "@/src/domain/interfaces/IClassifier";
import type { ICache } from "@/src/domain/interfaces/ICache";
import type { ClassifiedStory } from "@/types/news.types";
import { MOCK_NEWS, MOCK_PENDING } from "@/lib/mock-news";
import { getCompanyName } from "@/lib/company-names";
import { NEWS_CACHE_TTL_MS } from "@/lib/constants";

const NEWS_WINDOW_S = 14 * 24 * 60 * 60;

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
      reddit: INewsProvider;
      newsapi?: INewsProvider;
    },
    private readonly classifier: IClassifier,
    private readonly cache: ICache
  ) {}

  invalidateTicker(ticker: string): void {
    this.cache.delete(ticker);
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

    const [finnhubItems, redditItems, newsapiItems] = await Promise.all([
      this.providers.finnhub
        ? this.providers.finnhub.fetchNews(ticker).catch((err) => {
            console.error(`[news] Finnhub error for ${ticker}:`, err);
            return [];
          })
        : [],
      this.providers.reddit.fetchNews(ticker, companyName, sector).catch((err) => {
        console.error(`[news] Reddit error for ${ticker}:`, err);
        return [];
      }),
      this.providers.newsapi
        ? this.providers.newsapi.fetchNews(ticker, companyName).catch((err) => {
            console.error(`[news] NewsAPI error for ${ticker}:`, err);
            return [];
          })
        : [],
    ]);

    const totalRealStories =
      finnhubItems.length + redditItems.length + newsapiItems.length;

    if (totalRealStories === 0) {
      if (MOCK_VERDICTS?.[ticker]) {
        const data = withinNewsWindow(MOCK_VERDICTS[ticker]);
        this.cache.set(ticker, data, NEWS_CACHE_TTL_MS);
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
      const filtered = withinNewsWindow(classified);
      const allResult = [...pending, ...filtered];
      this.cache.set(ticker, allResult, NEWS_CACHE_TTL_MS);
      return allResult;
    }

    const cutoff = Math.floor(Date.now() / 1000) - NEWS_WINDOW_S;
    const allItems = [
      ...finnhubItems.map((a) => ({ ticker, ...a, source: "finnhub" as const })),
      ...redditItems.map((a) => ({ ticker, ...a, source: "reddit" as const })),
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
    const recent = withinNewsWindow(classified).sort((a, b) => b.datetime - a.datetime);
    const allRecent = [...pending, ...recent];
    
    this.cache.set(ticker, allRecent, NEWS_CACHE_TTL_MS);
    return allRecent;
  }
}
