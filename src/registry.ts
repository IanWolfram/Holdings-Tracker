import { buildConfig } from "@/src/config";
import { MapCache } from "@/src/infrastructure/cache/MapCache";
import { DiskCache } from "@/src/infrastructure/cache/DiskCache";
import { NullBrokerProvider } from "@/src/infrastructure/providers/NullBrokerProvider";
import { FinnhubProvider } from "@/src/infrastructure/providers/FinnhubProvider";
import { PolygonProvider } from "@/src/infrastructure/providers/PolygonProvider";
import { NewsAPIProvider } from "@/src/infrastructure/providers/NewsAPIProvider";
import { SupabaseAccountInfoProvider } from "@/src/infrastructure/providers/SupabaseAccountInfoProvider";
import { ClassifierService } from "@/src/services/ClassifierService";
import { PortfolioService } from "@/src/services/PortfolioService";
import { NewsService } from "@/src/services/NewsService";
import { MAX_ANALYZED_AGE_DAYS } from "@/lib/analyzedAge";
import type { INewsProvider } from "@/src/domain/interfaces/INewsProvider";
import type { IAccountInfoProvider } from "@/src/domain/interfaces/IAccountInfoProvider";
import type { IBrokerProvider } from "@/src/domain/interfaces/IBrokerProvider";

export type Services = {
  portfolioService: PortfolioService;
  newsService: NewsService;
  accountInfo: IAccountInfoProvider;
};

// Lazily-initialized module-level singleton so all caches and provider instances
// persist for the lifetime of the Node.js process (same behaviour as the lib/ Map caches).
let _services: Services | null = null;

function wire(): Services {
  const cfg = buildConfig();

  const portfolioCache = new MapCache();
  // Disk-backed so cache survives Next.js HMR / worker restarts. Without this,
  // every dev-server reload sends users back through the cold-fetch path.
  const newsCache = new DiskCache("news");

  // The global singleton has no per-user SnapTrade context, so it carries an
  // empty portfolio. Per-user broker data is wired in buildServicesForUser().
  const portfolioService = new PortfolioService(new NullBrokerProvider(), portfolioCache, {
    hasOAuthTokens: false,
    newsTtlMs: cfg.cache.newsTtlMs,
    accountTtlMs: cfg.cache.accountTtlMs,
  });

  const classifier = new ClassifierService(cfg.ai);

  const newsProviders: { finnhub?: INewsProvider; polygon?: INewsProvider; newsapi?: INewsProvider } = {
    ...(cfg.finnhub.apiKey ? { finnhub: new FinnhubProvider(cfg.finnhub.apiKey) } : {}),
    ...(cfg.polygon.apiKey ? { polygon: new PolygonProvider() } : {}),
    ...(cfg.newsapi.apiKey ? { newsapi: new NewsAPIProvider(cfg.newsapi.apiKey) } : {}),
  };

  const newsService = new NewsService(newsProviders, classifier, newsCache);
  const accountInfo: IAccountInfoProvider = new SupabaseAccountInfoProvider();

  return { portfolioService, newsService, accountInfo };
}

/** Singleton used by internal services (world-data, agent) for news/classification. */
export function getServices(): Services {
  if (!_services) _services = wire();
  return _services;
}

// ── Per-user services ──
// In multi-tenant mode each user gets their own broker provider (SnapTrade when
// linked) but shares global news providers and classifier. Caches are scoped by key prefix.

/**
 * LRU-capped per-user services map. The Map keeps insertion order and we
 * re-insert on each hit to mark recency, so the oldest entry is always the
 * first one Map iteration yields. This bounds memory in multi-tenant mode.
 */
const USER_SERVICES_MAX = Number(process.env.PULSE_USER_SERVICES_MAX ?? 256);
const _userServices = new Map<string, Services>();
// In-flight builds, so concurrent callers share one token-load instead of
// each triggering their own (which produced duplicate [registry] log lines
// and N redundant Supabase reads per dashboard refresh).
const _userServicesPending = new Map<string, Promise<Services>>();

/** Call this after a user's brokerage link changes so the next request rebuilds with fresh credentials. */
export function invalidateUserServices(userId: string): void {
  _userServices.delete(userId);
  _userServicesPending.delete(userId);
}

function touchUserServices(userId: string, services: Services): void {
  _userServices.delete(userId);
  _userServices.set(userId, services);
  while (_userServices.size > USER_SERVICES_MAX) {
    const oldestKey = _userServices.keys().next().value;
    if (oldestKey === undefined) break;
    _userServices.delete(oldestKey);
  }
}

/**
 * Build (or return cached) services for a specific user.
 * - Brokerage data is sourced from SnapTrade when the user has a linked broker.
 * - Caches are scoped with `u:<userId>:` prefix to avoid cross-user data leaks.
 * - News providers and classifier are shared globally (they have no per-user state).
 */
export async function getServicesForUser(userId: string): Promise<Services> {
  const cached = _userServices.get(userId);
  if (cached) {
    touchUserServices(userId, cached);
    return cached;
  }
  const pending = _userServicesPending.get(userId);
  if (pending) return pending;

  const build = (async (): Promise<Services> => {
    const services = await buildServicesForUser(userId);
    touchUserServices(userId, services);
    return services;
  })().finally(() => {
    _userServicesPending.delete(userId);
  });
  _userServicesPending.set(userId, build);
  return build;
}

async function buildServicesForUser(userId: string): Promise<Services> {
  const cfg = buildConfig();

  const portfolioCache = new MapCache(); // per-user cache
  const newsCache = new DiskCache(`news-${userId}`);

  // Brokerage data comes from SnapTrade when the user has a *linked* brokerage;
  // otherwise the portfolio is empty (NullBrokerProvider). SnapTrade modules are
  // imported dynamically so they load only when configured.
  let brokerProvider: IBrokerProvider = new NullBrokerProvider();
  let hasBrokerTokens = false;

  try {
    const { isSnapTradeConfigured, getSnapTradeClient } = await import("@/lib/snaptrade/client");
    if (isSnapTradeConfigured()) {
      const { loadSnapTradeUser } = await import("@/lib/snaptrade/users");
      const st = await loadSnapTradeUser(userId);
      if (st) {
        // Timeout-guarded: this runs on every cache-miss build for a SnapTrade
        // user — even for unrelated (e.g. news) requests — so a slow SnapTrade
        // must not stall service construction. NOTE: revisit before ~256 active
        // users (shares SnapTrade's 250 req/min limit with real broker traffic).
        const accts = await getSnapTradeClient().accountInformation.listUserAccounts(
          { userId: st.snapTradeUserId, userSecret: st.userSecret },
          { timeout: 4000 },
        );
        if ((accts.data ?? []).length > 0) {
          const { SnapTradeProvider } = await import("@/src/infrastructure/providers/SnapTradeProvider");
          brokerProvider = new SnapTradeProvider({
            snapTradeUserId: st.snapTradeUserId,
            userSecret: st.userSecret,
          });
          hasBrokerTokens = true;
          console.info("[registry] using SnapTrade broker provider", {
            userId,
            accounts: accts.data?.length ?? 0,
          });
        }
      }
    }
  } catch (err) {
    console.warn("[registry] SnapTrade provider selection failed — empty portfolio:", err);
  }

  const portfolioService = new PortfolioService(brokerProvider, portfolioCache, {
    hasOAuthTokens: hasBrokerTokens,
    newsTtlMs: cfg.cache.newsTtlMs,
    accountTtlMs: cfg.cache.accountTtlMs,
  });

  // News providers are global (no per-user state) — reuse the singleton's if available
  const classifier = new ClassifierService(cfg.ai, userId);

  const newsProviders: { finnhub?: INewsProvider; polygon?: INewsProvider; newsapi?: INewsProvider } = {
    ...(cfg.finnhub.apiKey ? { finnhub: new FinnhubProvider(cfg.finnhub.apiKey) } : {}),
    ...(cfg.polygon.apiKey ? { polygon: new PolygonProvider() } : {}),
    ...(cfg.newsapi.apiKey ? { newsapi: new NewsAPIProvider(cfg.newsapi.apiKey) } : {}),
  };

  // Cache the largest selectable analyzed-age window so /api/news can trim to
  // each user's chosen age at response time without forcing a cache miss.
  const newsService = new NewsService(
    newsProviders,
    classifier,
    newsCache,
    userId,
    MAX_ANALYZED_AGE_DAYS,
  );

  const accountInfo: IAccountInfoProvider = new SupabaseAccountInfoProvider();

  const services: Services = { portfolioService, newsService, accountInfo };
  return services;
}