import type { INewsProvider } from "@/src/domain/interfaces/INewsProvider";
import type { IClassifier } from "@/src/domain/interfaces/IClassifier";
import type { ICache } from "@/src/domain/interfaces/ICache";
import type { ClassifiedStory } from "@/types/news.types";
import { getCompanyName } from "@/lib/company-names";
import { NEWS_CACHE_TTL_MS, SYSTEM_USER_ID } from "@/lib/constants";
import { dedupeStories } from "@/lib/utils/dedupeStories";
import { getVaultStoriesForTicker } from "@/lib/vault-stories";

const NEWS_WINDOW_S = 7 * 24 * 60 * 60;
const DEFAULT_VAULT_WINDOW_DAYS = 7;

function withinWindow(stories: ClassifiedStory[], windowS: number): ClassifiedStory[] {
  const cutoff = Math.floor(Date.now() / 1000) - windowS;
  return stories.filter((s) => s.datetime >= cutoff);
}

export class NewsService {
  private readonly _revalidationLocks = new Map<string, Promise<void>>();

  constructor(
    private readonly providers: {
      finnhub?: INewsProvider;
      polygon?: INewsProvider;
      newsapi?: INewsProvider;
    },
    private readonly classifier: IClassifier,
    private readonly cache: ICache,
    private readonly userId: string = SYSTEM_USER_ID,
    // Window (days) for analyzed/vault stories. The per-user service caches the
    // largest selectable window so pages/api/news.ts can trim to the user's
    // chosen age at response time without a cache miss. Internal callers
    // (agent, world-data) keep the default 7-day window.
    private readonly vaultWindowDays: number = DEFAULT_VAULT_WINDOW_DAYS,
  ) {}

  /** Final merged-list window: wide enough to retain vault stories up to
   *  vaultWindowDays while provider stories remain bounded to NEWS_WINDOW_S. */
  private get _windowS(): number {
    return Math.max(NEWS_WINDOW_S, this.vaultWindowDays * 24 * 60 * 60);
  }

  invalidateTicker(ticker: string): void {
    this.cache.delete(ticker);
  }

  getCachedNews(ticker: string): ClassifiedStory[] | null {
    return this.cache.get<ClassifiedStory[]>(ticker);
  }

  /** Returns cached news with staleness metadata for SWR. */
  getCachedNewsWithMeta(ticker: string): { value: ClassifiedStory[]; isStale: boolean } | null {
    return this.cache.getWithMeta<ClassifiedStory[]>(ticker);
  }

  patchCachedStory(ticker: string, url: string, patch: Partial<ClassifiedStory>): void {
    const cached = this.cache.get<ClassifiedStory[]>(ticker);
    if (!cached) return;
    const updated = cached.map((s) => (s.url === url ? { ...s, ...patch } : s));
    this.cache.set(ticker, updated, NEWS_CACHE_TTL_MS);
  }

  async getNewsForTicker(ticker: string, sector?: string): Promise<ClassifiedStory[]> {
    // SWR: serve stale data immediately, trigger background revalidation
    const entry = this.cache.getWithMeta<ClassifiedStory[]>(ticker);
    if (entry) {
      if (entry.isStale && !this._isRevalidating(ticker)) {
        this._kickOffRevalidation(ticker, sector);
      }
      if (!entry.isStale) return entry.value;
      // Stale — return it, revalidation is running in background
      return entry.value;
    }

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
      // Finnhub + NewsAPI came back empty. Polygon often has stories the others
      // miss, but its free-tier queue can stall well past the API deadline, so
      // we must keep it OFF the synchronous path (see note above). Return vault
      // stories immediately and let Polygon enrich the cache in the background;
      // the short TTL makes the next poll pick up whatever enrichment lands.
      const vaultStories = await getVaultStoriesForTicker(ticker, this.vaultWindowDays, this.userId);
      const recent = withinWindow(dedupeStories(vaultStories, companyName), this._windowS)
        .sort((a, b) => b.datetime - a.datetime);
      this.cache.set(ticker, recent, NEWS_CACHE_TTL_MS / 6);
      this.kickOffPolygonEnrichment(ticker, companyName);
      return recent;
    }

    const cutoff = Math.floor(Date.now() / 1000) - NEWS_WINDOW_S;
    const allItems = [
      ...finnhubItems.map((a) => ({ ticker, ...a, source: "finnhub" as const })),
      ...newsapiItems.map((a) => ({ ticker, ...a, source: "newsapi" as const })),
    ].filter((s) => s.datetime >= cutoff);

    const classified: ClassifiedStory[] = [];
    // classifier.classify is now vault-lookup + keyword only (no AI call), so it's safe to call for all.
    // This ensures vault verdicts from prior agent runs are surfaced across the full article list.
    for (const s of allItems) {
      const cls = await this.classifier.classify(s.ticker, s.headline, s.summary ?? "", s.url);
      classified.push({ ...s, ...cls });
    }

    const vaultStories = await getVaultStoriesForTicker(ticker, this.vaultWindowDays, this.userId);
    const allClassified = [...classified, ...vaultStories];
    const deduped = dedupeStories(allClassified, companyName);
    const recent = withinWindow(deduped, this._windowS).sort((a, b) => b.datetime - a.datetime);
    const allRecent = recent;

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

    // Tolerate an expired/missing entry: the synchronous path may have used a
    // short TTL that lapsed while Polygon waited behind its rate-limit queue.
    // Merging onto [] still surfaces the Polygon stories rather than dropping
    // them; any Finnhub/NewsAPI/vault stories are re-added on the next fetch.
    const cached = this.cache.get<ClassifiedStory[]>(ticker) ?? [];

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

    const merged = dedupeStories([...cached, ...newClassified], companyName);
    const recent = withinWindow(merged, this._windowS).sort((a, b) => b.datetime - a.datetime);
    this.cache.set(ticker, recent, NEWS_CACHE_TTL_MS);
  }

  /** Check if a background revalidation is already in flight for this ticker. */
  private _isRevalidating(ticker: string): boolean {
    return this._revalidationLocks.has(ticker);
  }

  /** Kick off a background revalidation for a stale ticker. */
  private _kickOffRevalidation(ticker: string, sector?: string): void {
    if (this._revalidationLocks.has(ticker)) return;
    const p = this._revalidateTicker(ticker, sector)
      .catch((err) => console.error(`[news] SWR revalidation failed for ${ticker}:`, err))
      .finally(() => this._revalidationLocks.delete(ticker));
    this._revalidationLocks.set(ticker, p);
  }

  /** Internal: re-fetch and re-cache a single ticker. */
  private async _revalidateTicker(ticker: string, sector?: string): Promise<void> {
    // Delete the stale entry so getNewsForTicker does a fresh fetch next time
    this.cache.delete(ticker);
    await this.getNewsForTicker(ticker, sector);
  }
}
