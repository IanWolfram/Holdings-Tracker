import fs from "fs";
import path from "path";
import type { INewsProvider } from "@/src/domain/interfaces/INewsProvider";
import type { IClassifier } from "@/src/domain/interfaces/IClassifier";
import type { ICache } from "@/src/domain/interfaces/ICache";
import type { ClassifiedStory } from "@/types/news.types";
import { MOCK_NEWS, MOCK_PENDING } from "@/lib/mock-news";
import { getCompanyName } from "@/lib/company-names";
import { NEWS_CACHE_TTL_MS } from "@/lib/constants";
import { keywordClassify } from "@/lib/classifier";

const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

function withinThirtyDays(stories: ClassifiedStory[]): ClassifiedStory[] {
  const cutoff = Math.floor(Date.now() / 1000) - THIRTY_DAYS_S;
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
        const data = withinThirtyDays(MOCK_VERDICTS[ticker]);
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
      const filtered = withinThirtyDays(classified);
      const allResult = [...pending, ...filtered];
      this.cache.set(ticker, allResult, NEWS_CACHE_TTL_MS);
      return allResult;
    }

    const cutoff = Math.floor(Date.now() / 1000) - THIRTY_DAYS_S;
    const allItems = [
      ...finnhubItems.map((a) => ({ ticker, ...a, source: "finnhub" as const })),
      ...redditItems.map((a) => ({ ticker, ...a, source: "reddit" as const })),
      ...newsapiItems.map((a) => ({ ticker, ...a, source: "newsapi" as const })),
    ].filter((s) => s.datetime >= cutoff);

    const classified: ClassifiedStory[] = [];
    // Only deep-analyze the first 3 stories to avoid timeouts and save tokens/time
    // The rest will use keyword/default logic from the classifier
    for (let i = 0; i < allItems.length; i++) {
      const s = allItems[i];
      if (i < 3) {
        const cls = await this.classifier.classify(s.ticker, s.headline, s.summary ?? "", s.url);
        classified.push({ ...s, ...cls });
      } else {
        const cls = keywordClassify(s.headline, s.summary ?? "");
        classified.push({ ...s, ...cls });
      }
    }

    const pending = MOCK_PENDING[ticker] || [];
    const recent = withinThirtyDays(classified).sort((a, b) => b.datetime - a.datetime);
    const allRecent = [...pending, ...recent];
    
    this.cache.set(ticker, allRecent, NEWS_CACHE_TTL_MS);
    return allRecent;
  }
}
